import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bookmark, Save, Trash2, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { RecipientMode, StudentFilters } from './types';

interface Preset {
  id: string;
  name: string;
  template_name: string;
  filters: StudentFilters;
  custom_subject: string | null;
  custom_message: string | null;
  recipient_mode: RecipientMode;
  template_data: Record<string, string>;
}

interface Props {
  current: {
    templateName: string;
    filters: StudentFilters;
    customSubject: string;
    customMessage: string;
    recipientMode: RecipientMode;
    templateData: Record<string, string>;
  };
  onLoad: (p: Preset) => void;
  disabled?: boolean;
}

export function PresetsManager({ current, onLoad, disabled }: Props) {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    const { data } = await supabase
      .from('bulk_reminder_presets')
      .select('id, name, template_name, filters, custom_subject, custom_message, recipient_mode, template_data')
      .order('created_at', { ascending: false });
    setPresets((data as any) ?? []);
  };

  const handleSave = async () => {
    if (!name.trim() || !user) return;
    setSaving(true);
    const { error } = await supabase.from('bulk_reminder_presets').insert({
      name: name.trim(),
      template_name: current.templateName,
      filters: current.filters as any,
      custom_subject: current.customSubject || null,
      custom_message: current.customMessage || null,
      recipient_mode: current.recipientMode,
      template_data: current.templateData,
      created_by: user.id,
    });
    setSaving(false);
    if (error) {
      toast({ title: isRTL ? 'فشل الحفظ' : 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: isRTL ? 'تم الحفظ' : 'Saved', description: name });
    setName('');
    setSaveOpen(false);
    void load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('bulk_reminder_presets').delete().eq('id', id);
    if (error) {
      toast({ title: isRTL ? 'فشل الحذف' : 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    if (selectedId === id) setSelectedId('');
    void load();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Bookmark className="h-4 w-4 text-muted-foreground" />
      <Select
        value={selectedId}
        onValueChange={(v) => {
          setSelectedId(v);
          const p = presets.find((x) => x.id === v);
          if (p) onLoad(p);
        }}
        disabled={disabled || presets.length === 0}
      >
        <SelectTrigger className="w-56 h-9">
          <SelectValue
            placeholder={isRTL ? (presets.length === 0 ? 'لا توجد قوالب محفوظة' : 'تحميل قالب محفوظ') : (presets.length === 0 ? 'No saved presets' : 'Load preset')}
          />
        </SelectTrigger>
        <SelectContent>
          {presets.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <div className="flex items-center gap-2">
                <span>{p.name}</span>
                <span className="text-[10px] text-muted-foreground">({p.template_name})</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedId && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-destructive"
          onClick={() => handleDelete(selectedId)}
          disabled={disabled}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2" disabled={disabled || !current.templateName}>
            <Save className="h-3.5 w-3.5" />
            {isRTL ? 'حفظ كقالب' : 'Save preset'}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? 'حفظ كقالب جاهز' : 'Save as preset'}</DialogTitle>
            <DialogDescription>
              {isRTL
                ? 'احفظ الإعدادات الحالية (القالب + الفلاتر + المحتوى المخصص) لاستخدامها لاحقاً.'
                : 'Save current settings (template + filters + custom content) for later reuse.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{isRTL ? 'اسم القالب' : 'Preset name'}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isRTL ? 'مثال: تذكير شهري بالأقساط' : 'e.g. Monthly payment reminder'}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)} disabled={saving}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {isRTL ? 'حفظ' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
