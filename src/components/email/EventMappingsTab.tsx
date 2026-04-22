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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Code2, Database, Users, GraduationCap, UserCog, Shield } from 'lucide-react';
import type { EmailTemplateRow } from './TemplateEditorDialog';

type AudienceKey = 'student' | 'parent' | 'instructor' | 'admin' | 'reception';

interface CatalogEvent {
  event_key: string;
  category: string;
  display_name_en: string;
  display_name_ar: string;
  description: string | null;
  supported_audiences: string[];
}

interface Mapping {
  id: string;
  event_key: string;
  audience: AudienceKey;
  template_id: string | null;
  use_db_template: boolean;
  is_enabled: boolean;
  send_to: string;
  trigger_offset_minutes: number | null;
  admin_channel_override: 'user_choice' | 'email_only' | 'telegram_only' | 'both' | 'none';
}

const CHANNEL_LABELS: Record<string, { en: string; ar: string }> = {
  user_choice: { en: 'User chooses', ar: 'اليوزر يختار' },
  email_only:  { en: 'Email only',   ar: 'إيميل فقط' },
  telegram_only: { en: 'Telegram only', ar: 'تيليجرام فقط' },
  both:        { en: 'Email + Telegram', ar: 'إيميل + تيليجرام' },
  none:        { en: 'Disabled',     ar: 'موقوف' },
};

const AUDIENCE_LABELS: Record<AudienceKey, { en: string; ar: string; icon: any }> = {
  student:    { en: 'Students',    ar: 'الطلاب',         icon: GraduationCap },
  parent:     { en: 'Parents',     ar: 'أولياء الأمور',  icon: Users },
  instructor: { en: 'Instructors', ar: 'المدربين',       icon: UserCog },
  admin:      { en: 'Admins',      ar: 'الإدارة',        icon: Shield },
  reception:  { en: 'Reception',   ar: 'الاستقبال',      icon: Shield },
};

interface Props {
  templates: EmailTemplateRow[];
}

const CATEGORY_LABELS: Record<string, { en: string; ar: string }> = {
  sessions: { en: 'Sessions', ar: 'السيشنات' },
  attendance: { en: 'Attendance', ar: 'الحضور' },
  finance: { en: 'Finance & Subscriptions', ar: 'المالية والاشتراكات' },
  academic: { en: 'Academic', ar: 'أكاديمي' },
  lifecycle: { en: 'Lifecycle', ar: 'دورة حياة الحساب' },
  instructor_ops: { en: 'Instructor — Operations', ar: 'المدرب — التشغيل' },
  instructor_attendance: { en: 'Instructor — Attendance', ar: 'المدرب — الحضور' },
  instructor_academic: { en: 'Instructor — Academic', ar: 'المدرب — الأكاديمي' },
  instructor_quality: { en: 'Instructor — Quality', ar: 'المدرب — الجودة' },
  staff_ops: { en: 'Staff — Operations', ar: 'الستاف — التشغيل' },
};

export function EventMappingsTab({ templates }: Props) {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [events, setEvents] = useState<CatalogEvent[]>([]);
  // mappings keyed by `${event_key}:${audience}`
  const [mappings, setMappings] = useState<Record<string, Mapping>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [audienceFilter, setAudienceFilter] = useState<AudienceKey>('student');

  const load = async () => {
    setLoading(true);
    const [evRes, mapRes] = await Promise.all([
      supabase
        .from('email_event_catalog')
        .select('event_key, category, display_name_en, display_name_ar, description, supported_audiences')
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
        map[`${m.event_key}:${m.audience}`] = m as Mapping;
      });
      setMappings(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const upsertMapping = async (eventKey: string, audience: AudienceKey, patch: Partial<Mapping>) => {
    const key = `${eventKey}:${audience}`;
    const existing = mappings[key];
    const payload = {
      event_key: eventKey,
      audience,
      template_id: existing?.template_id ?? null,
      use_db_template: existing?.use_db_template ?? false,
      is_enabled: existing?.is_enabled ?? false,
      send_to: existing?.send_to ?? audience,
      trigger_offset_minutes: existing?.trigger_offset_minutes ?? null,
      admin_channel_override: existing?.admin_channel_override ?? 'user_choice',
      ...patch,
    };
    const { data, error } = await supabase
      .from('email_event_mappings')
      .upsert(payload, { onConflict: 'event_key,audience' })
      .select()
      .maybeSingle();
    if (error) {
      toast({ title: isRTL ? 'فشل الحفظ' : 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    if (data) {
      setMappings((prev) => ({ ...prev, [key]: data as Mapping }));
    }
  };

  // Events that support the currently selected audience
  const eventsForAudience = useMemo(
    () => events.filter((e) => (e.supported_audiences ?? []).includes(audienceFilter)),
    [events, audienceFilter],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return eventsForAudience;
    return eventsForAudience.filter(
      (e) =>
        e.event_key.toLowerCase().includes(q) ||
        e.display_name_en.toLowerCase().includes(q) ||
        e.display_name_ar.includes(search.trim()) ||
        (e.description || '').toLowerCase().includes(q),
    );
  }, [eventsForAudience, search]);

  const grouped = useMemo(() => {
    const g: Record<string, CatalogEvent[]> = {};
    filtered.forEach((e) => {
      if (!g[e.category]) g[e.category] = [];
      g[e.category].push(e);
    });
    return g;
  }, [filtered]);

  // Templates for currently selected audience (or generic ones with no audience set yet)
  const audienceTemplates = useMemo(
    () => templates.filter((t) => t.is_active && ((t as any).audience === audienceFilter || !(t as any).audience)),
    [templates, audienceFilter],
  );

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
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>{isRTL ? 'ربط القوالب بالأحداث' : 'Map templates to events'}</CardTitle>
              <CardDescription>
                {isRTL
                  ? 'اختر فئة المستلم، ثم لكل حدث: فعّل الإرسال، حدد القناة، واختر القالب'
                  : 'Pick the audience, then for each event: enable sending, choose channel and template'}
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
        <CardContent>
          <Tabs value={audienceFilter} onValueChange={(v) => setAudienceFilter(v as AudienceKey)}>
            <TabsList className="grid grid-cols-5 w-full max-w-2xl">
              {(['student', 'parent', 'instructor', 'admin', 'reception'] as AudienceKey[]).map((a) => {
                const Icon = AUDIENCE_LABELS[a].icon;
                return (
                  <TabsTrigger key={a} value={a} className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-xs">{isRTL ? AUDIENCE_LABELS[a].ar : AUDIENCE_LABELS[a].en}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </CardContent>
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
              const m = mappings[`${ev.event_key}:${audienceFilter}`];
              const useDb = m?.use_db_template ?? false;
              const enabled = m?.is_enabled ?? false;
              const templateId = m?.template_id ?? '';
              const channelOverride = m?.admin_channel_override ?? 'user_choice';

              return (
                <div
                  key={ev.event_key}
                  className="border rounded-md p-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
                >
                  <div className="md:col-span-3">
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
                      onCheckedChange={(c) => upsertMapping(ev.event_key, audienceFilter, { is_enabled: c })}
                    />
                    <Label className="text-xs">
                      {enabled
                        ? isRTL ? 'مفعّل' : 'Enabled'
                        : isRTL ? 'موقوف' : 'Disabled'}
                    </Label>
                  </div>

                  {/* Admin channel override (highest priority) */}
                  <div className="md:col-span-3">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 block">
                      {isRTL ? 'القناة (الأدمن)' : 'Channel (admin)'}
                    </Label>
                    <Select
                      value={channelOverride}
                      onValueChange={(v) =>
                        upsertMapping(ev.event_key, audienceFilter, { admin_channel_override: v as Mapping['admin_channel_override'] })
                      }
                      disabled={!enabled}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {isRTL ? v.ar : v.en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={useDb}
                        onCheckedChange={(c) => upsertMapping(ev.event_key, audienceFilter, { use_db_template: c })}
                        disabled={!enabled}
                      />
                      <Label className="text-xs flex items-center gap-1">
                        {useDb ? (
                          <><Database className="h-3 w-3" /> DB</>
                        ) : (
                          <><Code2 className="h-3 w-3" /> {isRTL ? 'كود' : 'Code'}</>
                        )}
                      </Label>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    {useDb && (
                      <Select
                        value={templateId}
                        onValueChange={(v) => upsertMapping(ev.event_key, audienceFilter, { template_id: v })}
                        disabled={!enabled}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder={isRTL ? 'قالب' : 'Template'} />
                        </SelectTrigger>
                        <SelectContent>
                          {audienceTemplates.length === 0 ? (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">
                              {isRTL ? 'لا توجد قوالب لهذه الفئة' : 'No templates for this audience'}
                            </div>
                          ) : (
                            audienceTemplates.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name}
                              </SelectItem>
                            ))
                          )}
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

      {eventsForAudience.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {isRTL ? 'لا توجد أحداث لهذه الفئة' : 'No events for this audience'}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
