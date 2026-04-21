import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Code2, Database } from 'lucide-react';
import type { EmailTemplateRow } from './TemplateEditorDialog';

interface CatalogEvent {
  event_key: string;
  category: string;
  display_name_en: string;
  display_name_ar: string;
  description: string | null;
}

interface Mapping {
  id: string;
  event_key: string;
  template_id: string | null;
  use_db_template: boolean;
  is_enabled: boolean;
  send_to: string;
  trigger_offset_minutes: number | null;
}

interface Props {
  templates: EmailTemplateRow[];
}

const CATEGORY_LABELS: Record<string, { en: string; ar: string }> = {
  sessions: { en: 'Sessions', ar: 'السيشنات' },
  attendance: { en: 'Attendance', ar: 'الحضور' },
  finance: { en: 'Finance & Subscriptions', ar: 'المالية والاشتراكات' },
  academic: { en: 'Academic', ar: 'أكاديمي' },
  lifecycle: { en: 'Lifecycle', ar: 'دورة حياة الحساب' },
};

export function EventMappingsTab({ templates }: Props) {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [events, setEvents] = useState<CatalogEvent[]>([]);
  const [mappings, setMappings] = useState<Record<string, Mapping>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const [evRes, mapRes] = await Promise.all([
      supabase
        .from('email_event_catalog')
        .select('event_key, category, display_name_en, display_name_ar, description')
        .eq('is_active', true)
        .order('category')
        .order('event_key'),
      supabase.from('email_event_mappings').select('*'),
    ]);
    if (evRes.error || mapRes.error) {
      toast({
        title: isRTL ? 'فشل التحميل' : 'Load failed',
        description: evRes.error?.message ?? mapRes.error?.message,
        variant: 'destructive',
      });
    } else {
      setEvents((evRes.data ?? []) as CatalogEvent[]);
      const map: Record<string, Mapping> = {};
      (mapRes.data ?? []).forEach((m: any) => {
        map[m.event_key] = m as Mapping;
      });
      setMappings(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const upsertMapping = async (eventKey: string, patch: Partial<Mapping>) => {
    const existing = mappings[eventKey];
    const payload = {
      event_key: eventKey,
      template_id: existing?.template_id ?? null,
      use_db_template: existing?.use_db_template ?? false,
      is_enabled: existing?.is_enabled ?? true,
      send_to: existing?.send_to ?? 'student',
      trigger_offset_minutes: existing?.trigger_offset_minutes ?? null,
      ...patch,
    };
    const { data, error } = await supabase
      .from('email_event_mappings')
      .upsert(payload, { onConflict: 'event_key' })
      .select()
      .maybeSingle();
    if (error) {
      toast({ title: isRTL ? 'فشل الحفظ' : 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    if (data) {
      setMappings((prev) => ({ ...prev, [eventKey]: data as Mapping }));
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        e.event_key.toLowerCase().includes(q) ||
        e.display_name_en.toLowerCase().includes(q) ||
        e.display_name_ar.includes(search.trim()) ||
        (e.description || '').toLowerCase().includes(q),
    );
  }, [events, search]);

  const grouped = useMemo(() => {
    const g: Record<string, CatalogEvent[]> = {};
    filtered.forEach((e) => {
      if (!g[e.category]) g[e.category] = [];
      g[e.category].push(e);
    });
    return g;
  }, [filtered]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{isRTL ? 'ربط القوالب بالأحداث' : 'Map templates to events'}</CardTitle>
              <CardDescription>
                {isRTL
                  ? 'لكل حدث: اختر إذا تستخدم قالب DB أو القالب المدمج، وفعّل/عطّل الإرسال'
                  : 'For each event: pick a DB template or use the built-in code template, enable/disable sending'}
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={isRTL ? 'بحث...' : 'Search...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-8 w-64"
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {Object.entries(grouped).map(([category, evs]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-base">
              {CATEGORY_LABELS[category]
                ? isRTL
                  ? CATEGORY_LABELS[category].ar
                  : CATEGORY_LABELS[category].en
                : category}
              <Badge variant="outline" className="ms-2">{evs.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {evs.map((ev) => {
              const m = mappings[ev.event_key];
              const useDb = m?.use_db_template ?? false;
              const enabled = m?.is_enabled ?? true;
              const templateId = m?.template_id ?? '';
              const sendTo = m?.send_to ?? 'student';

              return (
                <div
                  key={ev.event_key}
                  className="border rounded-md p-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
                >
                  <div className="md:col-span-4">
                    <div className="font-medium text-sm">
                      {isRTL ? ev.display_name_ar : ev.display_name_en}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <code className="text-[10px]">{ev.event_key}</code>
                    </div>
                    {ev.description && (
                      <div className="text-xs text-muted-foreground mt-1">{ev.description}</div>
                    )}
                  </div>

                  <div className="md:col-span-2 flex items-center gap-2">
                    <Switch
                      checked={enabled}
                      onCheckedChange={(c) => upsertMapping(ev.event_key, { is_enabled: c })}
                    />
                    <Label className="text-xs">
                      {enabled
                        ? isRTL ? 'مفعّل' : 'Enabled'
                        : isRTL ? 'موقوف' : 'Disabled'}
                    </Label>
                  </div>

                  <div className="md:col-span-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={useDb}
                        onCheckedChange={(c) => upsertMapping(ev.event_key, { use_db_template: c })}
                        disabled={!enabled}
                      />
                      <Label className="text-xs flex items-center gap-1">
                        {useDb ? (
                          <><Database className="h-3 w-3" /> {isRTL ? 'قالب DB' : 'DB template'}</>
                        ) : (
                          <><Code2 className="h-3 w-3" /> {isRTL ? 'كود مدمج' : 'Code template'}</>
                        )}
                      </Label>
                    </div>
                  </div>

                  <div className="md:col-span-3">
                    {useDb && (
                      <Select
                        value={templateId}
                        onValueChange={(v) => upsertMapping(ev.event_key, { template_id: v })}
                        disabled={!enabled}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder={isRTL ? 'اختر قالب' : 'Pick template'} />
                        </SelectTrigger>
                        <SelectContent>
                          {templates
                            .filter((t) => t.is_active)
                            .map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {events.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {isRTL ? 'لا توجد أحداث' : 'No events configured'}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
