import { useState, useEffect } from 'react';
import { Award, Settings2, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CertificateConfig {
  name_y_percent: number;
  font_size: number;
  font_color_hex: string;
}

const DEFAULT_CONFIG: CertificateConfig = {
  name_y_percent: 59,
  font_size: 22,
  font_color_hex: '#1B2A4A',
};

export function CertificateConfigDialog({ levelId, levelName }: { levelId: string; levelName: string }) {
  const { isRTL } = useLanguage();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<CertificateConfig>(DEFAULT_CONFIG);
  const [templatePath, setTemplatePath] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) loadConfig();
  }, [open, levelId]);

  const loadConfig = async () => {
    const { data } = await supabase
      .from('levels')
      .select('certificate_config, certificate_template_path')
      .eq('id', levelId)
      .single();

    if (data) {
      const raw = (data as any).certificate_config || {};
      setConfig({
        name_y_percent: raw.name_y_percent ?? DEFAULT_CONFIG.name_y_percent,
        font_size: raw.font_size ?? DEFAULT_CONFIG.font_size,
        font_color_hex: raw.font_color_hex ?? DEFAULT_CONFIG.font_color_hex,
      });
      setTemplatePath((data as any).certificate_template_path || '');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('levels')
      .update({
        certificate_config: config as any,
        certificate_template_path: templatePath || null,
      })
      .eq('id', levelId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isRTL ? 'تم حفظ الإعدادات' : 'Settings saved');
      setOpen(false);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Award className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{isRTL ? 'إعدادات الشهادة' : 'Certificate'}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            {isRTL ? `إعدادات شهادة ${levelName}` : `${levelName} Certificate Settings`}
          </DialogTitle>
          <DialogDescription>
            {isRTL
              ? 'ظبط مكان وشكل اسم الطالب على الشهادة'
              : 'Configure student name placement and style on the certificate'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{isRTL ? 'مسار التيمبلت في التخزين' : 'Template Storage Path'}</Label>
            <Input
              value={templatePath}
              onChange={(e) => setTemplatePath(e.target.value)}
              placeholder="templates/LEVEL1.pdf"
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isRTL ? 'موضع الاسم (% من الأسفل)' : 'Name Y Position (% from bottom)'}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={config.name_y_percent}
                onChange={(e) => setConfig({ ...config, name_y_percent: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                {isRTL ? 'القيمة الافتراضية: 59 (41% من الأعلى)' : 'Default: 59 (41% from top)'}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{isRTL ? 'حجم الخط' : 'Font Size'}</Label>
              <Input
                type="number"
                min={8}
                max={72}
                value={config.font_size}
                onChange={(e) => setConfig({ ...config, font_size: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                {isRTL ? 'الافتراضي: 22' : 'Default: 22'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{isRTL ? 'لون الخط' : 'Font Color'}</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={config.font_color_hex}
                onChange={(e) => setConfig({ ...config, font_color_hex: e.target.value })}
                className="h-9 w-14 rounded border cursor-pointer"
              />
              <Input
                value={config.font_color_hex}
                onChange={(e) => setConfig({ ...config, font_color_hex: e.target.value })}
                className="flex-1 font-mono"
                dir="ltr"
                maxLength={7}
              />
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium">{isRTL ? 'ملاحظة:' : 'Note:'}</p>
            <p>{isRTL
              ? 'بعد التعديل، اعمل "إعادة توليد" للشهادات الموجودة من بروفايل الطالب علشان التغييرات تطبق'
              : 'After changes, use "Regenerate" on existing certificates from student profile to apply'}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isRTL ? 'حفظ' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
