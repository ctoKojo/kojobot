import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Pencil, Trash2, Plus, Power, RotateCcw, Upload, Copy } from 'lucide-react';

interface AuditRow {
  id: string;
  template_id: string | null;
  template_name: string | null;
  actor_id: string | null;
  action: string;
  changes: Record<string, any>;
  created_at: string;
}

interface ProfileLite {
  user_id: string;
  full_name: string | null;
}

interface Props {
  templateId: string;
}

const ACTION_META: Record<string, { icon: typeof Activity; en: string; ar: string; cls: string }> = {
  created:     { icon: Plus, en: 'Created', ar: 'تم الإنشاء', cls: 'text-emerald-600' },
  updated:     { icon: Pencil, en: 'Updated', ar: 'تم التعديل', cls: 'text-blue-600' },
  deleted:     { icon: Trash2, en: 'Deleted', ar: 'تم الحذف', cls: 'text-destructive' },
  activated:   { icon: Power, en: 'Activated', ar: 'تم التفعيل', cls: 'text-emerald-600' },
  deactivated: { icon: Power, en: 'Deactivated', ar: 'تم التعطيل', cls: 'text-amber-600' },
  restored:    { icon: RotateCcw, en: 'Restored', ar: 'تم الاستعادة', cls: 'text-blue-600' },
  imported:    { icon: Upload, en: 'Imported', ar: 'تم الاستيراد', cls: 'text-purple-600' },
  duplicated:  { icon: Copy, en: 'Duplicated', ar: 'تم النسخ', cls: 'text-indigo-600' },
};

export function TemplateHistoryTab({ templateId }: Props) {
  const { isRTL } = useLanguage();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('email_template_audit_log')
        .select('id, template_id, template_name, actor_id, action, changes, created_at')
        .eq('template_id', templateId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (cancelled) return;
      const list = (data ?? []) as AuditRow[];
      setRows(list);
      const userIds = Array.from(new Set(list.map((r) => r.actor_id).filter(Boolean))) as string[];
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);
        const map: Record<string, ProfileLite> = {};
        (profs ?? []).forEach((p: any) => { map[p.user_id] = p; });
        if (!cancelled) setProfiles(map);
      }
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [templateId]);

  if (loading) {
    return <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>;
  }

  if (rows.length === 0) {
    return <div className="text-center text-muted-foreground text-sm py-8">{isRTL ? 'مفيش سجل بعد' : 'No history yet'}</div>;
  }

  return (
    <ScrollArea className="max-h-[400px]">
      <div className="space-y-2">
        {rows.map((r) => {
          const meta = ACTION_META[r.action] ?? ACTION_META.updated;
          const Icon = meta.icon;
          const author = r.actor_id ? profiles[r.actor_id]?.full_name : null;
          const fields = Object.keys(r.changes ?? {});
          return (
            <div key={r.id} className="border rounded-md p-3 flex items-start gap-3">
              <div className={`shrink-0 size-8 rounded-md bg-muted flex items-center justify-center ${meta.cls}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{isRTL ? meta.ar : meta.en}</span>
                  {author && <Badge variant="outline" className="text-[10px]">{author}</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {new Date(r.created_at).toLocaleString(isRTL ? 'ar-EG' : 'en-US')}
                </div>
                {fields.length > 0 && (
                  <div className="text-xs mt-1 flex flex-wrap gap-1">
                    {fields.slice(0, 6).map((f) => (
                      <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
                    ))}
                    {fields.length > 6 && <span className="text-muted-foreground">+{fields.length - 6}</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
