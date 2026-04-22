import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Send, CheckCircle2, XCircle, Loader2, Users, Megaphone, Search, Mail, MessageCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { sendEmail } from '@/lib/emailService';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { fetchEnrichedStudents } from '@/components/bulk-reminders/studentLoader';
import { resolveRecipients, buildAutoTemplateData } from '@/components/bulk-reminders/recipientResolver';
import type { StudentRow, SendResult, SendChannel } from '@/components/bulk-reminders/types';

interface CatalogTemplate {
  event_key: string;
  display_name_en: string;
  display_name_ar: string;
  category: string;
}

const ANNOUNCEMENT_KEY = 'announcement';

export default function BulkReminders() {
  const { isRTL } = useLanguage();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [templates, setTemplates] = useState<CatalogTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [templateName, setTemplateName] = useState<string>(ANNOUNCEMENT_KEY);
  const [announcementSubject, setAnnouncementSubject] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');

  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [channel, setChannel] = useState<SendChannel>('email');

  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<SendResult[]>([]);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [rows, tmplRes] = await Promise.all([
        fetchEnrichedStudents(isRTL),
        supabase
          .from('email_event_catalog')
          .select('event_key, display_name_en, display_name_ar, category')
          .eq('is_active', true)
          .order('category')
          .order('event_key'),
      ]);
      setStudents(rows);
      setTemplates((tmplRes.data as CatalogTemplate[]) ?? []);
    } catch (e: any) {
      toast({
        title: isRTL ? 'فشل التحميل' : 'Failed to load',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const hay = [
        s.full_name,
        s.email ?? '',
        s.phone ?? '',
        s.group_name ?? '',
        ...s.parents.flatMap((p) => [p.full_name, p.email ?? '']),
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [students, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selectedIds.has(s.user_id));

  const toggleAllFiltered = (checked: boolean) => {
    const next = new Set(selectedIds);
    filtered.forEach((s) => {
      if (checked) next.add(s.user_id);
      else next.delete(s.user_id);
    });
    setSelectedIds(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const isAnnouncement = templateName === ANNOUNCEMENT_KEY;
  const grouped = useMemo(() => {
    return templates.reduce<Record<string, CatalogTemplate[]>>((acc, t) => {
      (acc[t.category] ||= []).push(t);
      return acc;
    }, {});
  }, [templates]);

  const handleSend = async () => {
    if (selectedIds.size === 0) {
      toast({ title: isRTL ? 'اختر طالب على الأقل' : 'Select at least one student', variant: 'destructive' });
      return;
    }
    if (isAnnouncement) {
      if (!announcementSubject.trim() || !announcementBody.trim()) {
        toast({
          title: isRTL ? 'اكمل الإعلان' : 'Complete the announcement',
          description: isRTL ? 'لازم تكتب الموضوع والرسالة' : 'Subject and message are required',
          variant: 'destructive',
        });
        return;
      }
    }

    const targets = students.filter((s) => selectedIds.has(s.user_id));
    type Job = {
      student: StudentRow;
      recipient: ReturnType<typeof resolveRecipients>['recipients'][number] | null;
      skipReason?: string;
    };
    const jobs: Job[] = [];
    for (const s of targets) {
      // Smart recipient mode: parent if available, otherwise student
      const r = resolveRecipients(s, 'smart', isRTL);
      if (r.recipients.length === 0) {
        jobs.push({ student: s, recipient: null, skipReason: r.skipped[0]?.reason });
      } else {
        for (const rec of r.recipients) jobs.push({ student: s, recipient: rec });
      }
    }

    setSending(true);
    setResults([]);
    setProgress({ done: 0, total: jobs.length });
    const out: SendResult[] = [];
    const stamp = new Date().toISOString().slice(0, 10);

    const wantEmail = channel === 'email' || channel === 'both';
    const wantTelegram = channel === 'telegram' || channel === 'both';

    for (let i = 0; i < jobs.length; i++) {
      const { student: s, recipient, skipReason } = jobs[i];

      if (!recipient) {
        out.push({
          studentId: s.user_id,
          studentName: s.full_name,
          recipientType: 'none',
          recipientName: '—',
          email: '—',
          status: 'skipped',
          message: skipReason ?? (isRTL ? 'لا يوجد مستلم' : 'No recipient'),
        });
      } else {
        const data = buildAutoTemplateData(recipient, s, {});
        const recipientUserId = recipient.parentId ?? recipient.studentId;
        const baseIdKey = `bulk-${templateName}-${recipient.recipientType}-${recipientUserId}-${s.user_id}-${stamp}-${i}`;

        // EMAIL
        if (wantEmail) {
          const r = await sendEmail({
            to: recipient.email,
            templateName: isAnnouncement ? 'announcement' : templateName,
            idempotencyKey: `${baseIdKey}-email`,
            templateData: data as any,
            customSubject: isAnnouncement ? announcementSubject : undefined,
            customBody: isAnnouncement ? announcementBody : undefined,
          });
          out.push({
            studentId: s.user_id,
            studentName: s.full_name,
            recipientType: recipient.recipientType,
            recipientName: recipient.recipientName,
            email: recipient.email,
            channel: 'email',
            status: r.success ? (r.skipped ? 'skipped' : 'success') : 'failed',
            message: r.skipped || r.error,
          });
        }

        // TELEGRAM
        if (wantTelegram) {
          try {
            const { data: tgRes, error: tgErr } = await supabase.functions.invoke('send-telegram', {
              body: {
                userId: recipientUserId,
                templateName: isAnnouncement ? 'announcement' : templateName,
                templateData: data,
                customMessage: isAnnouncement ? `<b>${announcementSubject}</b>\n\n${announcementBody}` : undefined,
                idempotencyKey: `${baseIdKey}-tg`,
                bypassPreferences: true, // admin-driven bulk overrides user prefs
              },
            });
            if (tgErr) {
              out.push({
                studentId: s.user_id, studentName: s.full_name,
                recipientType: recipient.recipientType, recipientName: recipient.recipientName,
                email: recipient.email, channel: 'telegram',
                status: 'failed', message: tgErr.message,
              });
            } else if (tgRes?.skipped) {
              out.push({
                studentId: s.user_id, studentName: s.full_name,
                recipientType: recipient.recipientType, recipientName: recipient.recipientName,
                email: recipient.email, channel: 'telegram',
                status: 'skipped',
                message: tgRes.reason === 'no_telegram_link'
                  ? (isRTL ? 'غير مربوط بتيليجرام' : 'Telegram not linked')
                  : tgRes.reason,
              });
            } else {
              out.push({
                studentId: s.user_id, studentName: s.full_name,
                recipientType: recipient.recipientType, recipientName: recipient.recipientName,
                email: recipient.email, channel: 'telegram',
                status: tgRes?.success ? 'success' : 'failed',
                message: tgRes?.error,
              });
            }
          } catch (e: any) {
            out.push({
              studentId: s.user_id, studentName: s.full_name,
              recipientType: recipient.recipientType, recipientName: recipient.recipientName,
              email: recipient.email, channel: 'telegram',
              status: 'failed', message: e.message,
            });
          }
        }
      }
      setResults([...out]);
      setProgress({ done: i + 1, total: jobs.length });
    }

    setSending(false);
    const ok = out.filter((r) => r.status === 'success').length;
    const fail = out.filter((r) => r.status === 'failed').length;
    const skip = out.filter((r) => r.status === 'skipped').length;
    toast({
      title: isRTL ? 'اكتمل الإرسال' : 'Sending complete',
      description: isRTL
        ? `نجح: ${ok} | فشل: ${fail} | تم تخطي: ${skip}`
        : `Sent: ${ok} | Failed: ${fail} | Skipped: ${skip}`,
    });
  };

  const selectedTemplate = templates.find((t) => t.event_key === templateName);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title={isRTL ? 'تذكيرات جماعية' : 'Bulk Reminders'}
          subtitle={
            isRTL
              ? 'ابعت قالب جاهز أو إعلان حر لمجموعة طلاب أو أولياء أمور'
              : 'Send a ready template or a custom announcement to multiple students/parents'
          }
          icon={Send}
        />

        {/* Step 1: Pick template or announcement */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <span className="text-primary me-2">1.</span>
              {isRTL ? 'اختر القالب' : 'Pick template'}
            </CardTitle>
            <CardDescription>
              {isRTL
                ? 'اختر قالب جاهز للإرسال اليدوي، أو "إعلان عام" لو هتكتبه بنفسك'
                : 'Pick a ready template, or "Announcement" to write your own subject & message'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{isRTL ? 'القالب' : 'Template'}</Label>
              <Select value={templateName} onValueChange={setTemplateName} disabled={sending}>
                <SelectTrigger>
                  <SelectValue placeholder={isRTL ? 'اختر قالب...' : 'Select a template...'} />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {/* Announcement first - highlighted */}
                  <SelectGroup>
                    <SelectLabel>{isRTL ? '✍️ كتابة حرة' : '✍️ Custom'}</SelectLabel>
                    <SelectItem value={ANNOUNCEMENT_KEY}>
                      <div className="flex items-center gap-2">
                        <Megaphone className="h-4 w-4 text-primary" />
                        <span className="font-medium">
                          {isRTL ? 'إعلان عام (تكتبه بنفسك)' : 'General Announcement (you write it)'}
                        </span>
                      </div>
                    </SelectItem>
                  </SelectGroup>

                  {Object.entries(grouped).map(([category, items]) => {
                    const visible = items.filter((t) => t.event_key !== ANNOUNCEMENT_KEY);
                    if (visible.length === 0) return null;
                    return (
                      <SelectGroup key={category}>
                        <SelectLabel className="capitalize">{category}</SelectLabel>
                        {visible.map((t) => (
                          <SelectItem key={t.event_key} value={t.event_key}>
                            {isRTL ? t.display_name_ar : t.display_name_en}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Announcement form */}
            {isAnnouncement && (
              <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Megaphone className="h-4 w-4" />
                  {isRTL ? 'محتوى الإعلان' : 'Announcement content'}
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? 'الموضوع' : 'Subject'} *</Label>
                  <Input
                    value={announcementSubject}
                    onChange={(e) => setAnnouncementSubject(e.target.value)}
                    placeholder={
                      isRTL ? 'مثال: تأجيل حصص يوم الجمعة' : 'e.g. Friday classes postponed'
                    }
                    disabled={sending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? 'الرسالة' : 'Message'} *</Label>
                  <Textarea
                    value={announcementBody}
                    onChange={(e) => setAnnouncementBody(e.target.value)}
                    placeholder={
                      isRTL
                        ? 'اكتب نص الإعلان هنا... يمكنك استخدام {{recipientName}} أو {{studentName}}'
                        : 'Type the announcement here... you can use {{recipientName}} or {{studentName}}'
                    }
                    rows={8}
                    disabled={sending}
                  />
                  <p className="text-xs text-muted-foreground">
                    {isRTL
                      ? 'متغيرات اختيارية: {{recipientName}} (المستلم), {{studentName}} (اسم الطالب)'
                      : 'Optional variables: {{recipientName}}, {{studentName}}'}
                  </p>
                </div>
              </div>
            )}

            {!isAnnouncement && selectedTemplate && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {selectedTemplate.category}
                  </Badge>
                  <span className="font-medium">
                    {isRTL ? selectedTemplate.display_name_ar : selectedTemplate.display_name_en}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {isRTL
                    ? 'هيتم استخدام نص القالب الجاهز كما هو. لو محتاج رسالة مخصصة، اختر "إعلان عام" بدل ده.'
                    : 'The ready template content will be used as-is. For custom content, pick "General Announcement" instead.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Select students */}
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span className="text-primary me-1">2.</span>
                  <Users className="h-5 w-5" />
                  {isRTL ? 'اختيار المستلمين' : 'Select recipients'}
                </CardTitle>
                <CardDescription>
                  {isRTL
                    ? `${selectedIds.size} مختار من ${filtered.length} (${students.length} كلي) — هيُرسل لولي الأمر لو موجود، يتحول للطالب لو مفيش`
                    : `${selectedIds.size} selected of ${filtered.length} (${students.length} total) — sends to parent if available, falls back to student`}
                </CardDescription>
              </div>
              <Button
                size="lg"
                onClick={handleSend}
                disabled={
                  sending ||
                  selectedIds.size === 0 ||
                  (isAnnouncement && (!announcementSubject.trim() || !announcementBody.trim()))
                }
                className="md:self-start"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    {isRTL ? 'جاري الإرسال...' : 'Sending...'}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 me-2" />
                    {isRTL ? `إرسال (${selectedIds.size})` : `Send (${selectedIds.size})`}
                  </>
                )}
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  isRTL
                    ? 'ابحث بالاسم، الإيميل، التليفون، أو اسم المجموعة...'
                    : 'Search by name, email, phone, or group...'
                }
                className="pl-9"
                disabled={sending}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <TableSkeleton rows={6} columns={4} />
            ) : (
              <ScrollArea className="h-[420px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allFilteredSelected}
                          onCheckedChange={(c) => toggleAllFiltered(!!c)}
                          disabled={sending || filtered.length === 0}
                        />
                      </TableHead>
                      <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                      <TableHead>{isRTL ? 'المجموعة' : 'Group'}</TableHead>
                      <TableHead>{isRTL ? 'ولي الأمر / الإيميل' : 'Parent / Email'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-12 text-sm">
                          {isRTL ? 'لا توجد نتائج' : 'No results'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((s) => {
                        const parent = s.parents[0];
                        const willSendTo = parent?.email || s.email || '—';
                        const recipientLabel = parent?.email ? parent.full_name : (s.email ? s.full_name : '—');
                        return (
                          <TableRow key={s.user_id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(s.user_id)}
                                onCheckedChange={() => toggleOne(s.user_id)}
                                disabled={sending}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-sm">{s.full_name}</div>
                              {s.phone && (
                                <div className="text-xs text-muted-foreground">{s.phone}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {s.group_name ?? '—'}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{recipientLabel}</div>
                              <div className="text-xs text-muted-foreground">{willSendTo}</div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Progress + results */}
        {(sending || results.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {sending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                )}
                {isRTL ? 'حالة الإرسال' : 'Sending status'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {progress.total > 0 && (
                <>
                  <Progress value={(progress.done / progress.total) * 100} />
                  <div className="text-sm text-muted-foreground">
                    {progress.done} / {progress.total}
                  </div>
                </>
              )}
              {results.length > 0 && (
                <ScrollArea className="h-60 rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                        <TableHead>{isRTL ? 'إلى' : 'To'}</TableHead>
                        <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{r.studentName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.recipientName} • {r.email}
                          </TableCell>
                          <TableCell>
                            {r.status === 'success' && (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 border gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                {isRTL ? 'تم' : 'Sent'}
                              </Badge>
                            )}
                            {r.status === 'failed' && (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="h-3 w-3" />
                                {r.message?.slice(0, 40) ?? (isRTL ? 'فشل' : 'Failed')}
                              </Badge>
                            )}
                            {r.status === 'skipped' && (
                              <Badge variant="secondary" className="gap-1">
                                {isRTL ? 'متخطى' : 'Skipped'}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
