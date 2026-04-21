import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bell, Clock, Calendar, Search, Settings as SettingsIcon, AlertCircle } from 'lucide-react';

interface CatalogEvent {
  event_key: string;
  category: string;
  display_name_en: string;
  display_name_ar: string;
  description: string | null;
}

interface Mapping {
  id?: string;
  event_key: string;
  template_id: string | null;
  use_db_template: boolean;
  is_enabled: boolean;
  send_to: string;
  trigger_offset_minutes: number | null;
}

interface TemplateRow {
  id: string;
  name: string;
  is_active: boolean;
}

const CATEGORY_LABELS: Record<string, { en: string; ar: string; icon?: string }> = {
  sessions: { en: 'Sessions', ar: 'السيشنات' },
  attendance: { en: 'Attendance', ar: 'الحضور' },
  finance: { en: 'Finance & Subscriptions', ar: 'المالية والاشتراكات' },
  academic: { en: 'Academic', ar: 'أكاديمي' },
  lifecycle: { en: 'Lifecycle', ar: 'دورة حياة الحساب' },
};

const SESSION_REMINDER_KEYS = ['session-reminder-1h', 'session-reminder-1day'];

export default function NotificationSettings() {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CatalogEvent[]>([]);
  const [mappings, setMappings] = useState<Record<string, Mapping>>({});
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const [evRes, mapRes, tplRes] = await Promise.all([
      supabase
        .from('email_event_catalog')
        .select('event_key, category, display_name_en, display_name_ar, description')
        .eq('is_active', true)
        .order('category')
        .order('event_key'),
      supabase.from('email_event_mappings').select('*'),
      supabase.from('email_templates').select('id, name, is_active').eq('is_active', true).order('name'),
    ]);

    if (evRes.error || mapRes.error || tplRes.error) {
      toast({
        title: isRTL ? 'فشل التحميل' : 'Load failed',
        description: evRes.error?.message ?? mapRes.error?.message ?? tplRes.error?.message,
        variant: 'destructive',
      });
    } else {
      setEvents((evRes.data ?? []) as CatalogEvent[]);
      const map: Record<string, Mapping> = {};
      (mapRes.data ?? []).forEach((m: any) => {
        map[m.event_key] = m as Mapping;
      });
      setMappings(map);
      setTemplates((tplRes.data ?? []) as TemplateRow[]);
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
    // Optimistic update
    setMappings((prev) => ({ ...prev, [eventKey]: { ...payload } as Mapping }));

    const { data, error } = await supabase
      .from('email_event_mappings')
      .upsert(payload, { onConflict: 'event_key' })
      .select()
      .maybeSingle();
    if (error) {
      toast({
        title: isRTL ? 'فشل الحفظ' : 'Save failed',
        description: error.message,
        variant: 'destructive',
      });
      // Revert on error
      void load();
      return;
    }
    if (data) {
      setMappings((prev) => ({ ...prev, [eventKey]: data as Mapping }));
    }
  };

  // Auto-pick template if user enables DB but template_id is empty (when only one template available)
  const handleTemplatePick = (eventKey: string, templateId: string) => {
    void upsertMapping(eventKey, {
      template_id: templateId,
      use_db_template: true,
      is_enabled: true,
    });
  };

  const sessionReminders = useMemo(
    () => events.filter((e) => SESSION_REMINDER_KEYS.includes(e.event_key)),
    [events],
  );

  const otherEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = events.filter((e) => !SESSION_REMINDER_KEYS.includes(e.event_key));
    if (!q) return list;
    return list.filter(
      (e) =>
        e.event_key.toLowerCase().includes(q) ||
        e.display_name_en.toLowerCase().includes(q) ||
        e.display_name_ar.includes(search.trim()),
    );
  }, [events, search]);

  const groupedOther = useMemo(() => {
    const g: Record<string, CatalogEvent[]> = {};
    otherEvents.forEach((e) => {
      if (!g[e.category]) g[e.category] = [];
      g[e.category].push(e);
    });
    return g;
  }, [otherEvents]);

  const enabledCount = useMemo(
    () => Object.values(mappings).filter((m) => m.is_enabled).length,
    [mappings],
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          icon={Bell}
          title={isRTL ? 'إعدادات الإشعارات' : 'Notification Settings'}
          subtitle={
            isRTL
              ? 'فعّل التذكيرات والإشعارات عبر الإيميل واختر القوالب المناسبة لكل حدث'
              : 'Enable email reminders and notifications, and pick the right template for each event'
          }
        />

        {/* Quick stats + link to templates */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-md bg-primary/10 p-2">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{enabledCount}</div>
                <div className="text-xs text-muted-foreground">
                  {isRTL ? 'إشعار مفعّل' : 'Enabled notifications'}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-md bg-primary/10 p-2">
                <SettingsIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{templates.length}</div>
                <div className="text-xs text-muted-foreground">
                  {isRTL ? 'قالب جاهز' : 'Active templates'}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">
                  {isRTL ? 'إدارة القوالب' : 'Manage templates'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {isRTL ? 'إنشاء وتعديل القوالب' : 'Create and edit templates'}
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/email-templates">{isRTL ? 'فتح' : 'Open'}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Session reminders — featured section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              {isRTL ? 'تذكيرات السيشن' : 'Session reminders'}
            </CardTitle>
            <CardDescription>
              {isRTL
                ? 'فعّل إرسال تذكيرات للطلاب قبل بداية السيشن واختر القالب المناسب'
                : 'Enable reminders sent before each session and pick which template to use'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            ) : (
              sessionReminders.map((ev) => (
                <ReminderRow
                  key={ev.event_key}
                  event={ev}
                  mapping={mappings[ev.event_key]}
                  templates={templates}
                  isRTL={isRTL}
                  onToggle={(enabled) => upsertMapping(ev.event_key, { is_enabled: enabled })}
                  onTemplate={(id) => handleTemplatePick(ev.event_key, id)}
                />
              ))
            )}
            {!loading && templates.length === 0 && (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  {isRTL
                    ? 'لا توجد قوالب جاهزة بعد. أنشئ قالب أولاً من صفحة قوالب الإيميل.'
                    : 'No templates yet. Create one first from the Email Templates page.'}{' '}
                  <Link to="/email-templates" className="underline text-primary">
                    {isRTL ? 'فتح القوالب' : 'Open templates'}
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* All other notifications — grouped */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  {isRTL ? 'باقي الإشعارات' : 'All other notifications'}
                </CardTitle>
                <CardDescription>
                  {isRTL
                    ? 'تحكّم في كل حدث بشكل مستقل: تفعيل + اختيار قالب'
                    : 'Control each event independently: enable + pick template'}
                </CardDescription>
              </div>
              <div className="relative">
                <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={isRTL ? 'بحث...' : 'Search...'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="ps-8 w-full sm:w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <>
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </>
            ) : Object.keys(groupedOther).length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-sm">
                {isRTL ? 'لا توجد نتائج' : 'No results'}
              </div>
            ) : (
              Object.entries(groupedOther).map(([category, evs]) => (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">
                      {CATEGORY_LABELS[category]
                        ? isRTL
                          ? CATEGORY_LABELS[category].ar
                          : CATEGORY_LABELS[category].en
                        : category}
                    </h3>
                    <Badge variant="outline">{evs.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {evs.map((ev) => (
                      <ReminderRow
                        key={ev.event_key}
                        event={ev}
                        mapping={mappings[ev.event_key]}
                        templates={templates}
                        isRTL={isRTL}
                        compact
                        onToggle={(enabled) => upsertMapping(ev.event_key, { is_enabled: enabled })}
                        onTemplate={(id) => handleTemplatePick(ev.event_key, id)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

interface ReminderRowProps {
  event: CatalogEvent;
  mapping?: Mapping;
  templates: TemplateRow[];
  isRTL: boolean;
  compact?: boolean;
  onToggle: (enabled: boolean) => void;
  onTemplate: (templateId: string) => void;
}

function ReminderRow({ event, mapping, templates, isRTL, compact, onToggle, onTemplate }: ReminderRowProps) {
  const enabled = mapping?.is_enabled ?? true;
  const templateId = mapping?.template_id ?? '';
  const useDb = mapping?.use_db_template ?? false;

  return (
    <div
      className={`border rounded-lg ${compact ? 'p-3' : 'p-4'} grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-card`}
    >
      <div className="md:col-span-5">
        <div className={`font-medium ${compact ? 'text-sm' : 'text-base'}`}>
          {isRTL ? event.display_name_ar : event.display_name_en}
        </div>
        {event.description && !compact && (
          <div className="text-xs text-muted-foreground mt-1">{event.description}</div>
        )}
        <code className="text-[10px] text-muted-foreground" dir="ltr">
          {event.event_key}
        </code>
      </div>

      <div className="md:col-span-3 flex items-center gap-2">
        <Switch checked={enabled} onCheckedChange={onToggle} id={`switch-${event.event_key}`} />
        <Label htmlFor={`switch-${event.event_key}`} className="text-xs cursor-pointer">
          {enabled ? (
            <Badge variant="default" className="text-[10px]">
              {isRTL ? 'مفعّل' : 'Enabled'}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">
              {isRTL ? 'موقوف' : 'Off'}
            </Badge>
          )}
        </Label>
      </div>

      <div className="md:col-span-4">
        <Select value={templateId} onValueChange={onTemplate} disabled={!enabled || templates.length === 0}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue
              placeholder={
                templates.length === 0
                  ? isRTL ? 'لا توجد قوالب' : 'No templates'
                  : useDb
                  ? isRTL ? 'اختر قالب' : 'Pick template'
                  : isRTL ? 'القالب الافتراضي (كود)' : 'Default (built-in)'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
