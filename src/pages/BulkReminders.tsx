import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
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
import { Send, CheckCircle2, XCircle, Loader2, Users, Eye, Download } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { sendEmail } from '@/lib/emailService';
import { toast } from '@/hooks/use-toast';
import { TemplatePicker } from '@/components/bulk-reminders/TemplatePicker';
import { StudentFiltersPanel } from '@/components/bulk-reminders/StudentFilters';
import { QuickSelects } from '@/components/bulk-reminders/QuickSelects';
import { EmailPreviewDialog } from '@/components/bulk-reminders/EmailPreviewDialog';
import { PresetsManager } from '@/components/bulk-reminders/PresetsManager';
import { fetchEnrichedStudents } from '@/components/bulk-reminders/studentLoader';
import {
  resolveRecipients,
  buildAutoTemplateData,
  resultsToCsv,
} from '@/components/bulk-reminders/recipientResolver';
import type {
  RecipientMode,
  StudentFilters,
  StudentRow,
  SendResult,
} from '@/components/bulk-reminders/types';
import { DEFAULT_FILTERS } from '@/components/bulk-reminders/types';

function interpolate(tpl: string, data: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => {
    const v = data[k];
    return v === undefined || v === null ? '' : String(v);
  });
}

export default function BulkReminders() {
  const { isRTL } = useLanguage();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [templateName, setTemplateName] = useState<string>('payment-due');
  const [templateData, setTemplateData] = useState<Record<string, string>>({});
  const [customSubject, setCustomSubject] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('smart');

  const [filters, setFilters] = useState<StudentFilters>(DEFAULT_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [sending, setSending] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<SendResult[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await fetchEnrichedStudents(isRTL);
      setStudents(rows);
    } catch (e: any) {
      toast({
        title: isRTL ? 'فشل تحميل الطلاب' : 'Failed to load students',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return students.filter((s) => {
      if (q) {
        const hay = [
          s.full_name,
          s.email ?? '',
          s.phone ?? '',
          s.group_name ?? '',
          ...s.parents.flatMap((p) => [p.full_name, p.email ?? '']),
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.groupIds.length > 0 && (!s.group_id || !filters.groupIds.includes(s.group_id))) return false;
      if (filters.levelIds.length > 0 && (!s.level_id || !filters.levelIds.includes(s.level_id))) return false;
      if (filters.ageGroupIds.length > 0 && (!s.age_group_id || !filters.ageGroupIds.includes(s.age_group_id))) return false;
      if (filters.subscriptionStatuses.length > 0) {
        const matches = filters.subscriptionStatuses.some((st) => {
          if (st === 'needs_renewal') {
            if (!s.subscription_end_date) return false;
            const end = new Date(s.subscription_end_date);
            const days = (end.getTime() - Date.now()) / 86400000;
            return s.subscription_status === 'active' && days <= 7 && days >= 0;
          }
          if (st === 'none') return s.subscription_status === 'none' || s.subscription_status == null;
          return s.subscription_status === st;
        });
        if (!matches) return false;
      }
      if (filters.noParent && s.parents.length > 0) return false;
      if (filters.hideNoEmail) {
        const hasAny = Boolean(s.email) || s.parents.some((p) => p.email);
        if (!hasAny) return false;
      }
      return true;
    });
  }, [students, filters]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selectedIds.has(s.user_id));
  const someFilteredSelected = filtered.some((s) => selectedIds.has(s.user_id));

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

  // Compute recipient totals for the summary
  const recipientPlan = useMemo(() => {
    const targets = students.filter((s) => selectedIds.has(s.user_id));
    let total = 0;
    let skipped = 0;
    for (const s of targets) {
      const r = resolveRecipients(s, recipientMode, isRTL);
      total += r.recipients.length;
      skipped += r.skipped.length;
    }
    return { totalStudents: targets.length, totalRecipients: total, skippedStudents: skipped };
  }, [students, selectedIds, recipientMode, isRTL]);

  const handleSend = async () => {
    if (selectedIds.size === 0) {
      toast({ title: isRTL ? 'اختر طالب على الأقل' : 'Select at least one student', variant: 'destructive' });
      return;
    }
    if (!templateName) {
      toast({ title: isRTL ? 'اختر قالب' : 'Select a template', variant: 'destructive' });
      return;
    }

    const targets = students.filter((s) => selectedIds.has(s.user_id));
    type Job = { student: StudentRow; recipient: ReturnType<typeof resolveRecipients>['recipients'][number] | null; skipReason?: string };
    const jobs: Job[] = [];
    for (const s of targets) {
      const r = resolveRecipients(s, recipientMode, isRTL);
      if (r.recipients.length === 0) {
        jobs.push({ student: s, recipient: null, skipReason: r.skipped[0]?.reason });
      } else {
        for (const rec of r.recipients) jobs.push({ student: s, recipient: rec });
      }
    }

    setSending(true);
    setCancelRequested(false);
    setResults([]);
    setProgress({ done: 0, total: jobs.length });
    const out: SendResult[] = [];
    const stamp = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < jobs.length; i++) {
      if (cancelRequested) break;
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
        const data = buildAutoTemplateData(recipient, s, templateData);
        const idKey = `bulk-${templateName}-${recipient.recipientType}-${recipient.parentId ?? recipient.studentId}-${s.user_id}-${stamp}-${i}`;
        const r = await sendEmail({
          to: recipient.email,
          templateName,
          idempotencyKey: idKey,
          templateData: data as any,
          customSubject: customSubject || undefined,
          customBody: customMessage || undefined,
        });
        out.push({
          studentId: s.user_id,
          studentName: s.full_name,
          recipientType: recipient.recipientType,
          recipientName: recipient.recipientName,
          email: recipient.email,
          status: r.success ? (r.skipped ? 'skipped' : 'success') : 'failed',
          message: r.skipped || r.error,
        });
      }
      setResults([...out]);
      setProgress({ done: i + 1, total: jobs.length });
    }

    setSending(false);
    const ok = out.filter((r) => r.status === 'success').length;
    const fail = out.filter((r) => r.status === 'failed').length;
    const skip = out.filter((r) => r.status === 'skipped').length;
    toast({
      title: cancelRequested
        ? (isRTL ? 'تم الإيقاف' : 'Cancelled')
        : (isRTL ? 'اكتمل الإرسال' : 'Sending complete'),
      description: isRTL
        ? `نجح: ${ok} | فشل: ${fail} | تم تخطي: ${skip}`
        : `Sent: ${ok} | Failed: ${fail} | Skipped: ${skip}`,
    });
  };

  const downloadCsv = () => {
    const csv = resultsToCsv(results.map((r) => ({
      studentName: r.studentName,
      recipientType: r.recipientType,
      recipientName: r.recipientName,
      email: r.email,
      status: r.status,
      message: r.message,
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk-reminders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Build a sample preview using a real selected student, or a fake one.
  const previewData = useMemo(() => {
    const sample = students.find((s) => selectedIds.has(s.user_id)) ?? students[0];
    const fakeRec = sample
      ? { studentId: sample.user_id, studentName: sample.full_name, recipientType: 'parent' as const, recipientName: sample.parents[0]?.full_name ?? sample.full_name, email: sample.parents[0]?.email ?? sample.email ?? 'preview@example.com', parentId: sample.parents[0]?.parent_id }
      : null;
    const data = sample && fakeRec ? buildAutoTemplateData(fakeRec, sample, templateData) : { recipientName: 'Sample', studentName: 'Sample Student' };
    const subject = customSubject ? interpolate(customSubject, data) : (isRTL ? '— سيتم استخدام موضوع القالب الافتراضي —' : '— Default template subject will be used —');
    const body = customMessage
      ? interpolate(customMessage, data)
      : (isRTL
        ? '<p style="color:#666">سيتم استخدام جسم القالب الافتراضي. أضف <code>customMessage</code> هنا للمعاينة.</p>'
        : '<p style="color:#666">The default template body will be used. Add a custom message to preview it here.</p>');
    return {
      subject,
      body,
      label: sample ? `${fakeRec?.recipientName} → ${sample.full_name}` : 'Sample',
    };
  }, [students, selectedIds, templateData, customSubject, customMessage, isRTL]);

  const recipientModeOptions: Array<{ value: RecipientMode; label: string; label_ar: string; desc: string; desc_ar: string }> = [
    { value: 'smart', label: 'Smart', label_ar: 'ذكي', desc: 'Parent if available, else student', desc_ar: 'ولي الأمر لو موجود، يفول-باك للطالب' },
    { value: 'parent', label: 'Parent only', label_ar: 'ولي الأمر فقط', desc: 'Skip if no parent has email', desc_ar: 'تخطي لو ولي الأمر مش موجود' },
    { value: 'student', label: 'Student only', label_ar: 'الطالب فقط', desc: 'Use student email', desc_ar: 'إيميل الطالب من بروفايله' },
    { value: 'both', label: 'Both', label_ar: 'الاتنين', desc: 'Send to both — parent & student', desc_ar: 'يبعت لولي الأمر وللطالب' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title={isRTL ? 'تذكيرات جماعية' : 'Bulk Reminders'}
          subtitle={isRTL
            ? 'أرسل أي قالب إيميل لمجموعة طلاب أو أولياء أمور بشكل مرن مع فلاتر متقدمة وتخصيص'
            : 'Send any email template to a flexible audience with advanced filters and customization'}
          icon={Send}
        />

        {/* Step 1: Template */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-lg">
                  <span className="text-primary me-2">1.</span>
                  {isRTL ? 'القالب والمحتوى' : 'Template & content'}
                </CardTitle>
                <CardDescription>
                  {isRTL ? 'اختر قالب من القائمة وعدّل المحتوى لو محتاج' : 'Pick a template and customize content if needed'}
                </CardDescription>
              </div>
              <PresetsManager
                current={{ templateName, filters, customSubject, customMessage, recipientMode, templateData }}
                onLoad={(p) => {
                  setTemplateName(p.template_name);
                  setFilters({ ...DEFAULT_FILTERS, ...(p.filters as any) });
                  setCustomSubject(p.custom_subject ?? '');
                  setCustomMessage(p.custom_message ?? '');
                  setRecipientMode(p.recipient_mode);
                  setTemplateData((p.template_data as any) ?? {});
                  toast({ title: isRTL ? 'تم تحميل القالب' : 'Preset loaded', description: p.name });
                }}
                disabled={sending}
              />
            </div>
          </CardHeader>
          <CardContent>
            <TemplatePicker
              templateName={templateName}
              onTemplateChange={setTemplateName}
              templateData={templateData}
              onTemplateDataChange={setTemplateData}
              customSubject={customSubject}
              onCustomSubjectChange={setCustomSubject}
              customMessage={customMessage}
              onCustomMessageChange={setCustomMessage}
              disabled={sending}
            />
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} disabled={!templateName}>
                <Eye className="h-4 w-4 me-2" />
                {isRTL ? 'معاينة' : 'Preview'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Recipient mode */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <span className="text-primary me-2">2.</span>
              {isRTL ? 'وضع المستلم' : 'Recipient mode'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'حدد لمن يذهب الإيميل لكل طالب مختار' : 'Choose who receives the email per selected student'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={recipientMode}
              onValueChange={(v) => setRecipientMode(v as RecipientMode)}
              disabled={sending}
              className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"
            >
              {recipientModeOptions.map((opt) => (
                <Label
                  key={opt.value}
                  htmlFor={`rm-${opt.value}`}
                  className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors ${
                    recipientMode === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value={opt.value} id={`rm-${opt.value}`} />
                    <span className="font-medium">{isRTL ? opt.label_ar : opt.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground ms-6">
                    {isRTL ? opt.desc_ar : opt.desc}
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Step 3: Students */}
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span className="text-primary me-1">3.</span>
                  <Users className="h-5 w-5" />
                  {isRTL ? 'اختيار الطلاب' : 'Select students'}
                </CardTitle>
                <CardDescription>
                  {isRTL
                    ? `${selectedIds.size} مختار من ${filtered.length} معروض (${students.length} كلي)`
                    : `${selectedIds.size} selected of ${filtered.length} shown (${students.length} total)`}
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Button
                  size="lg"
                  onClick={handleSend}
                  disabled={sending || selectedIds.size === 0 || !templateName}
                  className="gap-2"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {sending
                    ? (isRTL ? `جارٍ الإرسال ${progress.done}/${progress.total}` : `Sending ${progress.done}/${progress.total}`)
                    : (isRTL
                        ? `إرسال (${recipientPlan.totalRecipients} مستلم)`
                        : `Send (${recipientPlan.totalRecipients} recipients)`)}
                </Button>
                {sending && (
                  <Button variant="outline" size="sm" onClick={() => setCancelRequested(true)} disabled={cancelRequested}>
                    {isRTL ? 'إلغاء الإرسال' : 'Cancel sending'}
                  </Button>
                )}
                {!sending && recipientPlan.skippedStudents > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {isRTL
                      ? `سيتم تخطي ${recipientPlan.skippedStudents} طالب (لا يوجد مستلم)`
                      : `${recipientPlan.skippedStudents} students will be skipped (no recipient)`}
                  </p>
                )}
              </div>
            </div>

            <StudentFiltersPanel filters={filters} onFiltersChange={setFilters} disabled={sending} />
            <QuickSelects students={filtered} onSelect={setSelectedIds} disabled={sending} />

            {sending && (
              <Progress value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0} className="h-2" />
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <TableSkeleton columns={5} rows={6} />
            ) : (
              <ScrollArea className="h-[420px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allFilteredSelected ? true : someFilteredSelected ? 'indeterminate' : false}
                          onCheckedChange={(c) => toggleAllFiltered(Boolean(c))}
                          disabled={sending || filtered.length === 0}
                        />
                      </TableHead>
                      <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                      <TableHead>{isRTL ? 'المجموعة / المستوى' : 'Group / Level'}</TableHead>
                      <TableHead>{isRTL ? 'الاشتراك' : 'Subscription'}</TableHead>
                      <TableHead>{isRTL ? 'الإيميلات' : 'Emails'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          {isRTL ? 'لا يوجد طلاب مطابقين للفلاتر' : 'No students match filters'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((s) => {
                        const noEmails = !s.email && s.parents.every((p) => !p.email);
                        return (
                          <TableRow key={s.user_id} className={noEmails ? 'opacity-60' : ''}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(s.user_id)}
                                onCheckedChange={() => toggleOne(s.user_id)}
                                disabled={sending}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{s.full_name}</div>
                              {s.phone && <div className="text-xs text-muted-foreground">{s.phone}</div>}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{s.group_name || '—'}</div>
                              <div className="text-xs text-muted-foreground">{s.level_name || '—'}</div>
                            </TableCell>
                            <TableCell>
                              {s.subscription_status === 'active' && (
                                <Badge variant="default" className="text-xs">{isRTL ? 'نشط' : 'Active'}</Badge>
                              )}
                              {s.subscription_status === 'expired' && (
                                <Badge variant="destructive" className="text-xs">{isRTL ? 'منتهي' : 'Expired'}</Badge>
                              )}
                              {s.subscription_status === 'suspended' && (
                                <Badge variant="secondary" className="text-xs">{isRTL ? 'موقف' : 'Suspended'}</Badge>
                              )}
                              {(!s.subscription_status || s.subscription_status === 'none') && (
                                <Badge variant="outline" className="text-xs">—</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1 text-xs">
                                {s.email && (
                                  <span><Badge variant="outline" className="text-[10px] me-1">{isRTL ? 'طالب' : 'Student'}</Badge>{s.email}</span>
                                )}
                                {s.parents.map((p) => (
                                  <span key={p.parent_id}>
                                    <Badge variant="outline" className="text-[10px] me-1 border-primary/40 text-primary">
                                      {isRTL ? 'ولي أمر' : 'Parent'}
                                    </Badge>
                                    {p.full_name}
                                    {p.email
                                      ? <span className="text-muted-foreground"> — {p.email}</span>
                                      : <span className="text-destructive"> ({isRTL ? 'بدون بريد' : 'no email'})</span>}
                                  </span>
                                ))}
                                {!s.email && s.parents.length === 0 && (
                                  <span className="text-destructive">{isRTL ? 'لا توجد إيميلات' : 'No emails'}</span>
                                )}
                              </div>
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

        {/* Results */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{isRTL ? 'نتائج الإرسال' : 'Send results'}</CardTitle>
                  <CardDescription>
                    {(() => {
                      const ok = results.filter((r) => r.status === 'success').length;
                      const fail = results.filter((r) => r.status === 'failed').length;
                      const skip = results.filter((r) => r.status === 'skipped').length;
                      return (
                        <span className="flex gap-3 mt-2">
                          <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {ok}</Badge>
                          <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {fail}</Badge>
                          <Badge variant="secondary" className="gap-1">{isRTL ? 'تم تخطيه' : 'Skipped'}: {skip}</Badge>
                        </span>
                      );
                    })()}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={downloadCsv}>
                  <Download className="h-4 w-4 me-2" />
                  {isRTL ? 'تصدير CSV' : 'Export CSV'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                      <TableHead>{isRTL ? 'نوع المستلم' : 'Recipient'}</TableHead>
                      <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                      <TableHead>{isRTL ? 'البريد' : 'Email'}</TableHead>
                      <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead>{isRTL ? 'ملاحظة' : 'Note'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r, idx) => (
                      <TableRow key={`${r.studentId}-${r.email}-${idx}`}>
                        <TableCell className="font-medium">{r.studentName}</TableCell>
                        <TableCell>
                          {r.recipientType === 'parent' && (
                            <Badge variant="outline" className="border-primary/40 text-primary">{isRTL ? 'ولي أمر' : 'Parent'}</Badge>
                          )}
                          {r.recipientType === 'student' && (
                            <Badge variant="outline">{isRTL ? 'الطالب' : 'Student'}</Badge>
                          )}
                          {r.recipientType === 'none' && <Badge variant="secondary">—</Badge>}
                        </TableCell>
                        <TableCell>{r.recipientName}</TableCell>
                        <TableCell className="text-xs font-mono">{r.email}</TableCell>
                        <TableCell>
                          {r.status === 'success' && <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {isRTL ? 'تم' : 'Sent'}</Badge>}
                          {r.status === 'failed' && <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {isRTL ? 'فشل' : 'Failed'}</Badge>}
                          {r.status === 'skipped' && <Badge variant="secondary">{isRTL ? 'تخطي' : 'Skipped'}</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-md">{r.message || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        <EmailPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          subject={previewData.subject}
          bodyHtml={previewData.body}
          recipientLabel={previewData.label}
        />
      </div>
    </DashboardLayout>
  );
}
