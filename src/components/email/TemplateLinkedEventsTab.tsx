import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Link2, ExternalLink } from 'lucide-react';
import { useTemplatePermissions } from '@/hooks/useTemplatePermissions';

interface MappingRow {
  id: string;
  event_key: string;
  audience: string;
  is_enabled: boolean;
  admin_channel_override: string;
}

interface CatalogEntry {
  event_key: string;
  display_name_en: string;
  display_name_ar: string;
  category: string;
}

interface Props {
  templateId: string;
}

const AUDIENCE_LABELS: Record<string, { en: string; ar: string }> = {
  student:    { en: 'Students',    ar: 'الطلاب' },
  parent:     { en: 'Parents',     ar: 'أولياء الأمور' },
  instructor: { en: 'Instructors', ar: 'المدربين' },
  admin:      { en: 'Admins',      ar: 'الإدارة' },
  reception:  { en: 'Reception',   ar: 'الاستقبال' },
};

export function TemplateLinkedEventsTab({ templateId }: Props) {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const { permissions } = useTemplatePermissions();
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [catalog, setCatalog] = useState<Record<string, CatalogEntry>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [mapRes, catRes] = await Promise.all([
        supabase
          .from('email_event_mappings')
          .select('id, event_key, audience, is_enabled, admin_channel_override')
          .eq('template_id', templateId),
        supabase
          .from('email_event_catalog')
          .select('event_key, display_name_en, display_name_ar, category'),
      ]);
      if (cancelled) return;
      setRows((mapRes.data ?? []) as MappingRow[]);
      const map: Record<string, CatalogEntry> = {};
      (catRes.data ?? []).forEach((c: any) => { map[c.event_key] = c; });
      setCatalog(map);
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [templateId]);

  const toggleEnabled = async (id: string, next: boolean) => {
    const { error } = await supabase.from('email_event_mappings').update({ is_enabled: next }).eq('id', id);
    if (error) {
      toast({ title: isRTL ? 'فشل التحديث' : 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    setRows((p) => p.map((r) => (r.id === id ? { ...r, is_enabled: next } : r)));
  };

  if (loading) return <div className="space-y-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>;

  if (rows.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm py-8">
        <Link2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
        {isRTL ? 'القالب ده مش مربوط بأي حدث. روح تبويب «ربط الأحداث» عشان تربطه.' : 'This template is not linked to any event yet. Use the "Event Mappings" tab to link it.'}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        {isRTL
          ? `هذا القالب مربوط بـ ${rows.length} حدث`
          : `This template is wired to ${rows.length} event${rows.length === 1 ? '' : 's'}`}
      </div>
      {rows.map((r) => {
        const cat = catalog[r.event_key];
        return (
          <div key={r.id} className="border rounded-md p-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">
                  {cat ? (isRTL ? cat.display_name_ar : cat.display_name_en) : r.event_key}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {AUDIENCE_LABELS[r.audience]?.[isRTL ? 'ar' : 'en'] ?? r.audience}
                </Badge>
              </div>
              <code className="text-[10px] text-muted-foreground">{r.event_key}</code>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={r.is_enabled}
                onCheckedChange={(c) => toggleEnabled(r.id, c)}
                disabled={!permissions.canEdit}
              />
              <span className="text-xs text-muted-foreground w-16">
                {r.is_enabled ? (isRTL ? 'مفعّل' : 'Enabled') : (isRTL ? 'موقوف' : 'Disabled')}
              </span>
            </div>
          </div>
        );
      })}
      <div className="text-[10px] text-muted-foreground pt-2 flex items-center gap-1">
        <ExternalLink className="h-3 w-3" />
        {isRTL ? 'لإضافة ربط جديد، استخدم تبويب «ربط الأحداث» الرئيسي' : 'To add a new mapping, use the main "Event Mappings" tab'}
      </div>
    </div>
  );
}
