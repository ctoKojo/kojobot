import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, Send, Bell } from 'lucide-react';

interface CatalogEvent {
  event_key: string;
  category: string;
  display_name_en: string;
  display_name_ar: string;
}

interface Pref {
  event_key: string;
  email_enabled: boolean;
  telegram_enabled: boolean;
}

const CATEGORY_LABELS: Record<string, { en: string; ar: string }> = {
  sessions: { en: 'Sessions', ar: 'السيشنات' },
  attendance: { en: 'Attendance', ar: 'الحضور' },
  finance: { en: 'Finance', ar: 'المالية' },
  academic: { en: 'Academic', ar: 'أكاديمي' },
  lifecycle: { en: 'Account', ar: 'الحساب' },
  general: { en: 'General', ar: 'عام' },
};

export function NotificationChannelPreferences() {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [hasTelegram, setHasTelegram] = useState(false);
  const [events, setEvents] = useState<CatalogEvent[]>([]);
  const [prefs, setPrefs] = useState<Record<string, Pref>>({});

  const load = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }

    const [evRes, prefRes, linkRes] = await Promise.all([
      supabase
        .from('email_event_catalog')
        .select('event_key, category, display_name_en, display_name_ar')
        .eq('is_active', true)
        .order('category')
        .order('event_key'),
      supabase
        .from('notification_channel_preferences')
        .select('event_key, email_enabled, telegram_enabled')
        .eq('user_id', userData.user.id),
      supabase
        .from('telegram_links')
        .select('id')
        .eq('user_id', userData.user.id)
        .eq('is_active', true)
        .maybeSingle(),
    ]);

    setEvents((evRes.data ?? []) as CatalogEvent[]);
    const map: Record<string, Pref> = {};
    (prefRes.data ?? []).forEach((p: any) => {
      map[p.event_key] = p;
    });
    setPrefs(map);
    setHasTelegram(!!linkRes.data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const updatePref = async (eventKey: string, channel: 'email' | 'telegram', enabled: boolean) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const existing = prefs[eventKey] ?? { event_key: eventKey, email_enabled: true, telegram_enabled: true };
    const updated = {
      ...existing,
      [`${channel}_enabled`]: enabled,
    };
    setPrefs((prev) => ({ ...prev, [eventKey]: updated }));

    const { error } = await supabase
      .from('notification_channel_preferences')
      .upsert(
        {
          user_id: userData.user.id,
          event_key: eventKey,
          email_enabled: updated.email_enabled,
          telegram_enabled: updated.telegram_enabled,
        },
        { onConflict: 'user_id,event_key' },
      );

    if (error) {
      toast({
        title: isRTL ? 'فشل الحفظ' : 'Save failed',
        description: error.message,
        variant: 'destructive',
      });
      void load();
    }
  };

  const grouped = useMemo(() => {
    const g: Record<string, CatalogEvent[]> = {};
    events.forEach((e) => {
      if (!g[e.category]) g[e.category] = [];
      g[e.category].push(e);
    });
    return g;
  }, [events]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-primary/10 p-2">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>{isRTL ? 'تفضيلات الإشعارات' : 'Notification Preferences'}</CardTitle>
            <CardDescription>
              {isRTL
                ? 'اختر القناة المفضلة لكل نوع من الإشعارات'
                : 'Choose your preferred channel for each notification type'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Channel header legend */}
        <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-4 items-center pb-2 border-b text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span>{isRTL ? 'الإشعار' : 'Event'}</span>
          <span className="flex items-center gap-1 w-20 justify-center">
            <Mail className="h-3 w-3" /> {isRTL ? 'إيميل' : 'Email'}
          </span>
          <span className="flex items-center gap-1 w-20 justify-center">
            <Send className="h-3 w-3" /> Telegram
          </span>
        </div>

        {Object.entries(grouped).map(([category, categoryEvents]) => (
          <div key={category} className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground">
              {CATEGORY_LABELS[category]?.[isRTL ? 'ar' : 'en'] ?? category}
            </h4>
            <div className="space-y-2">
              {categoryEvents.map((event) => {
                const pref = prefs[event.event_key] ?? {
                  event_key: event.event_key,
                  email_enabled: true,
                  telegram_enabled: true,
                };
                return (
                  <div
                    key={event.event_key}
                    className="grid grid-cols-[1fr_auto_auto] gap-4 items-center p-3 rounded-md border hover:bg-muted/30 transition-colors"
                  >
                    <div className="text-sm font-medium">
                      {isRTL ? event.display_name_ar : event.display_name_en}
                    </div>
                    <div className="flex items-center gap-2 w-20 justify-center">
                      <Switch
                        checked={pref.email_enabled}
                        onCheckedChange={(v) => updatePref(event.event_key, 'email', v)}
                      />
                    </div>
                    <div className="flex items-center gap-2 w-20 justify-center">
                      <Switch
                        checked={pref.telegram_enabled && hasTelegram}
                        disabled={!hasTelegram}
                        onCheckedChange={(v) => updatePref(event.event_key, 'telegram', v)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {!hasTelegram && (
          <div className="text-sm text-muted-foreground text-center p-4 rounded-md bg-muted/30">
            {isRTL
              ? '💡 اربط حسابك بـ Telegram من الكارت فوق عشان تقدر تستقبل إشعارات عليه'
              : '💡 Link your Telegram account from the card above to enable Telegram notifications'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
