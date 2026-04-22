import { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Beaker, Send, AlertTriangle, CheckCircle2, Mail, MessageCircle, FormInput, Code } from 'lucide-react';
import { EventVariablesForm } from '@/components/notifications/EventVariablesForm';
import type { EventVariable } from '@/lib/templateValidation';

type Audience = 'student' | 'parent' | 'instructor' | 'admin' | 'reception' | 'staff';

/**
 * Merge defaults: preview_data takes priority, then sample values for any
 * keys that aren't covered by preview_data.
 */
function mergeDefaults(
  variables: EventVariable[],
  previewData: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  (variables ?? []).forEach((v) => {
    if (v.sample !== undefined && v.sample !== null && v.sample !== '') {
      out[v.key] = v.sample;
    }
  });
  if (previewData && typeof previewData === 'object') {
    Object.entries(previewData).forEach(([k, val]) => {
      if (val !== undefined && val !== null && val !== '') out[k] = val;
    });
  }
  return out;
}

export default function NotificationsSmokeTest() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRTL = language === 'ar';
  const { toast } = useToast();

  const [eventKey, setEventKey] = useState<string>('');
  const [audience, setAudience] = useState<Audience>('student');
  const [recipientEmail, setRecipientEmail] = useState<string>(user?.email ?? '');
  const [variablesJson, setVariablesJson] = useState<string>('{}');
  const [liveMode, setLiveMode] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailPreview, setEmailPreview] = useState<{ subject: string; html: string } | null>(null);
  const [telegramPreview, setTelegramPreview] = useState<{ text: string } | null>(null);
  const [includeTelegram, setIncludeTelegram] = useState(false);

  // Load events catalog
  const { data: events } = useQuery({
    queryKey: ['smoke-test-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_event_catalog')
        .select('event_key, display_name_en, display_name_ar, category, supported_audiences, preview_data, available_variables')
        .eq('is_active', true)
        .order('category')
        .order('event_key');
      if (error) throw error;
      return data ?? [];
    },
  });

  const selectedEvent = useMemo(
    () => events?.find((e) => e.event_key === eventKey),
    [events, eventKey],
  );

  const eventVariables = useMemo<EventVariable[]>(
    () => ((selectedEvent?.available_variables as unknown as EventVariable[]) ?? []),
    [selectedEvent],
  );

  // When user picks an event, auto-populate preview vars + audience
  useEffect(() => {
    if (selectedEvent) {
      const supported = (selectedEvent.supported_audiences as string[]) ?? [];
      if (supported.length > 0 && !supported.includes(audience)) {
        setAudience(supported[0] as Audience);
      }
      const merged = mergeDefaults(
        eventVariables,
        selectedEvent.preview_data as Record<string, unknown> | null | undefined,
      );
      setVariablesJson(JSON.stringify(merged, null, 2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvent]);

  const parsedVars = useMemo(() => {
    try { return JSON.parse(variablesJson || '{}'); } catch { return null; }
  }, [variablesJson]);

  const varsValid = parsedVars !== null;

  const groupedEvents = useMemo(() => {
    const groups: Record<string, typeof events> = {};
    (events ?? []).forEach((e) => {
      const cat = (e as any).category ?? 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat]!.push(e);
    });
    return groups;
  }, [events]);

  const handleSend = async () => {
    if (!eventKey || !recipientEmail || !varsValid) return;

    if (liveMode) {
      setConfirmOpen(true);
      return;
    }
    await runSend(false);
  };

  const runSend = async (live: boolean) => {
    setSending(true);
    setEmailPreview(null);
    setTelegramPreview(null);

    const idempotencyKey = `smoke-${live ? 'live' : 'dry'}-${eventKey}-${Date.now()}`;
    try {
      // Email
      const { data: emailData, error: emailErr } = await supabase.functions.invoke('send-email', {
        body: {
          to: recipientEmail,
          templateName: eventKey,
          templateData: parsedVars,
          audience,
          idempotencyKey,
          dryRun: !live,
          smokeTest: true,
          skipTelegramFanout: true,
        },
      });
      if (emailErr) throw emailErr;
      const er = emailData as any;
      if (er?.subject) {
        setEmailPreview({ subject: er.subject, html: er.htmlPreview ?? '' });
      } else if (er?.skipped) {
        toast({
          title: isRTL ? 'تم التخطي' : 'Skipped',
          description: er.skipped,
        });
      }

      // Telegram (optional, only if user has telegram link or smoke chat config)
      if (includeTelegram && user?.id) {
        const { data: tgData, error: tgErr } = await supabase.functions.invoke('send-telegram', {
          body: {
            userId: user.id,
            templateName: eventKey,
            templateData: parsedVars,
            audience,
            idempotencyKey: `${idempotencyKey}-tg`,
            dryRun: !live,
            smokeTest: true,
            bypassPreferences: true,
          },
        });
        if (tgErr) console.warn('Telegram dry-run error', tgErr);
        const tr = tgData as any;
        if (tr?.text) setTelegramPreview({ text: tr.text });
      }

      toast({
        title: live
          ? (isRTL ? 'تم الإرسال الحقيقي' : 'Live send completed')
          : (isRTL ? 'اكتمل الـ Dry-run' : 'Dry-run completed'),
        description: isRTL ? 'تحقق من المعاينة بالأسفل' : 'Check the preview below',
      });
    } catch (e: any) {
      toast({
        title: isRTL ? 'فشل الاختبار' : 'Test failed',
        description: e?.message ?? 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
      setConfirmOpen(false);
    }
  };

  const liveCount = 1 + (includeTelegram ? 1 : 0);

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-6xl">
        <PageHeader
          title={isRTL ? 'اختبار الإشعارات (Smoke Test)' : 'Notifications Smoke Test'}
          subtitle={isRTL
            ? 'تجربة قوالب الإشعارات قبل الإرسال الفعلي — Dry-run افتراضي'
            : 'Test notification templates safely — Dry-run by default'}
          icon={Beaker}
        />

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                {isRTL ? 'إعداد الاختبار' : 'Test Configuration'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{isRTL ? 'الحدث (Event)' : 'Event'}</Label>
                <Select value={eventKey} onValueChange={setEventKey}>
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? 'اختر حدث...' : 'Pick an event...'} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[400px]">
                    {Object.entries(groupedEvents).map(([cat, items]) => (
                      <div key={cat}>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                          {cat}
                        </div>
                        {items?.map((ev) => (
                          <SelectItem key={ev.event_key} value={ev.event_key}>
                            <span className="font-mono text-xs me-2">{ev.event_key}</span>
                            <span className="text-muted-foreground">
                              {isRTL ? ev.display_name_ar : ev.display_name_en}
                            </span>
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{isRTL ? 'الجمهور (Audience)' : 'Audience'}</Label>
                <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['student', 'parent', 'instructor', 'admin', 'reception', 'staff'] as Audience[]).map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{isRTL ? 'المستلم (Email)' : 'Recipient Email'}</Label>
                <Input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="test@example.com"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {isRTL
                    ? 'في Dry-run لن يتم إرسال شيء فعلياً.'
                    : 'In Dry-run, no real email is sent.'}
                </p>
              </div>

              <div>
                <Label className="flex items-center justify-between">
                  <span>{isRTL ? 'المتغيرات (JSON)' : 'Variables (JSON)'}</span>
                  <div className="flex items-center gap-2">
                    {selectedEvent && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => {
                          try {
                            setVariablesJson(JSON.stringify(selectedEvent.preview_data ?? {}, null, 2));
                          } catch {
                            setVariablesJson('{}');
                          }
                        }}
                      >
                        {isRTL ? 'إعادة تعبئة' : 'Reset to defaults'}
                      </Button>
                    )}
                    {!varsValid && (
                      <Badge variant="destructive" className="text-xs">
                        {isRTL ? 'JSON غير صالح' : 'Invalid JSON'}
                      </Badge>
                    )}
                  </div>
                </Label>
                <Textarea
                  value={variablesJson}
                  onChange={(e) => setVariablesJson(e.target.value)}
                  rows={10}
                  className="font-mono text-xs"
                  placeholder={
                    selectedEvent
                      ? JSON.stringify(selectedEvent.preview_data ?? { example: 'value' }, null, 2)
                      : isRTL
                        ? 'اختر حدث أولاً لتعبئة المتغيرات تلقائياً\n\nمثال:\n{\n  "student_name": "أحمد",\n  "session_title": "الدرس الأول"\n}'
                        : 'Select an event first to auto-fill variables\n\nExample:\n{\n  "student_name": "Ahmed",\n  "session_title": "Lesson 1"\n}'
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedEvent
                    ? (isRTL
                      ? '✓ تمت التعبئة من preview_data — عدّل القيم حسب الحاجة'
                      : '✓ Auto-filled from preview_data — edit values as needed')
                    : (isRTL
                      ? 'سيتم تعبئة الحقول تلقائياً عند اختيار الحدث'
                      : 'Fields will auto-fill when you pick an event')}
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="cursor-pointer">{isRTL ? 'تضمين Telegram' : 'Include Telegram'}</Label>
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? 'يحتاج حساب Telegram مرتبط' : 'Requires linked Telegram account'}
                  </p>
                </div>
                <Switch checked={includeTelegram} onCheckedChange={setIncludeTelegram} />
              </div>

              <div className="flex items-center justify-between rounded-lg border-2 border-warning/40 bg-warning/5 p-3">
                <div>
                  <Label className="cursor-pointer flex items-center gap-2 text-warning-foreground font-semibold">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    {isRTL ? 'الوضع الحقيقي (Live Mode)' : 'Live Mode'}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isRTL
                      ? 'سيتم الإرسال الفعلي للمستلم. يتطلب تأكيد.'
                      : 'Sends a real notification. Requires confirmation.'}
                  </p>
                </div>
                <Switch checked={liveMode} onCheckedChange={setLiveMode} />
              </div>

              <Button
                onClick={handleSend}
                disabled={!eventKey || !recipientEmail || !varsValid || sending}
                className="w-full"
                variant={liveMode ? 'destructive' : 'default'}
              >
                <Send className="h-4 w-4 me-2" />
                {sending
                  ? (isRTL ? 'جاري التنفيذ...' : 'Running...')
                  : liveMode
                    ? (isRTL ? 'إرسال حقيقي' : 'Send Live')
                    : (isRTL ? 'تشغيل Dry-run' : 'Run Dry-run')}
              </Button>
            </CardContent>
          </Card>

          {/* Right: preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                {isRTL ? 'المعاينة' : 'Preview'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="email">
                <TabsList>
                  <TabsTrigger value="email">
                    <Mail className="h-4 w-4 me-1" /> Email
                  </TabsTrigger>
                  <TabsTrigger value="telegram">
                    <MessageCircle className="h-4 w-4 me-1" /> Telegram
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="email" className="mt-4 space-y-3">
                  {emailPreview ? (
                    <>
                      <div>
                        <Label className="text-xs text-muted-foreground">{isRTL ? 'الموضوع' : 'Subject'}</Label>
                        <div className="rounded-md border bg-muted p-2 text-sm font-medium">
                          {emailPreview.subject}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{isRTL ? 'المحتوى' : 'Body'}</Label>
                        <div
                          className="rounded-md border bg-background p-4 max-h-[400px] overflow-auto prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: emailPreview.html }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-muted-foreground text-sm py-12">
                      {isRTL ? 'شغّل Dry-run لرؤية المعاينة' : 'Run Dry-run to see preview'}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="telegram" className="mt-4">
                  {telegramPreview ? (
                    <div className="rounded-md border bg-muted p-4 whitespace-pre-wrap text-sm">
                      {telegramPreview.text}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground text-sm py-12">
                      {includeTelegram
                        ? (isRTL ? 'شغّل Dry-run لرؤية معاينة Telegram' : 'Run Dry-run to see Telegram preview')
                        : (isRTL ? 'فعّل "تضمين Telegram" أولاً' : 'Enable "Include Telegram" first')}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Live confirmation */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                {isRTL ? 'تأكيد الإرسال الحقيقي' : 'Confirm Live Send'}
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2 pt-2">
                <span className="block">
                  {isRTL
                    ? `سيتم إرسال ${liveCount} رسالة فعلية إلى:`
                    : `${liveCount} real notification(s) will be sent to:`}
                </span>
                <span className="block font-mono font-semibold text-foreground bg-muted px-2 py-1 rounded">
                  {recipientEmail}
                </span>
                <span className="block text-xs">
                  {isRTL ? 'الحدث:' : 'Event:'} <span className="font-mono">{eventKey}</span>
                </span>
                <span className="block text-warning-foreground">
                  {isRTL ? '⚠️ هذا إجراء لا يمكن التراجع عنه.' : '⚠️ This action cannot be undone.'}
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => runSend(true)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isRTL ? 'تأكيد الإرسال' : 'Confirm & Send'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
