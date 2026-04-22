import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
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
import { Mail, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle, Send } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { sendEmail } from '@/lib/emailService';
import { toast } from '@/hooks/use-toast';

interface EmailLogRow {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  metadata: any | null;
  created_at: string;
}

interface DedupedRow extends EmailLogRow {
  // The latest row per message_id
}

interface DetailDialogState {
  open: boolean;
  loading: boolean;
  row: DedupedRow | null;
  history: EmailLogRow[];
}

const STATUS_CONFIG: Record<string, { label: string; labelAr: string; variant: 'default' | 'destructive' | 'secondary' | 'outline'; icon: any }> = {
  sent: { label: 'Sent', labelAr: 'تم الإرسال', variant: 'default', icon: CheckCircle2 },
  pending: { label: 'Pending', labelAr: 'قيد الإرسال', variant: 'secondary', icon: Clock },
  failed: { label: 'Failed', labelAr: 'فشل', variant: 'destructive', icon: XCircle },
  dlq: { label: 'Dead Letter', labelAr: 'فشل نهائي', variant: 'destructive', icon: AlertTriangle },
};

const TEMPLATE_LABELS: Record<string, { ar: string; en: string }> = {
  'session-reminder': { ar: 'تذكير بحصة', en: 'Session reminder' },
  'payment-due': { ar: 'تذكير قسط', en: 'Payment due' },
  'password-reset': { ar: 'استعادة كلمة المرور', en: 'Password reset' },
  auth_emails: { ar: 'إيميلات المصادقة', en: 'Auth emails' },
};

export default function EmailLogs() {
  const { language } = useLanguage();
  const [rows, setRows] = useState<DedupedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, pending: 0 });
  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testTemplate, setTestTemplate] = useState<'session-reminder' | 'payment-due' | 'password-reset'>('session-reminder');
  const [testSending, setTestSending] = useState(false);
  const [detail, setDetail] = useState<DetailDialogState>({ open: false, loading: false, row: null, history: [] });

  const isArabic = language === 'ar';

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Fetch latest 500 rows; dedupe client-side by message_id
      const { data, error } = await supabase
        .from('email_send_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      // Dedupe: keep only latest row per message_id
      const seen = new Set<string>();
      const deduped: DedupedRow[] = [];
      for (const row of data ?? []) {
        const key = row.message_id || row.id;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(row);
      }

      setRows(deduped);

      // Compute stats
      const newStats = { total: deduped.length, sent: 0, failed: 0, pending: 0 };
      for (const r of deduped) {
        if (r.status === 'sent') newStats.sent++;
        else if (r.status === 'failed' || r.status === 'dlq') newStats.failed++;
        else if (r.status === 'pending') newStats.pending++;
      }
      setStats(newStats);
    } catch (err) {
      console.error('Failed to fetch email logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Apply filters
  const filteredRows = rows.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (templateFilter !== 'all' && r.template_name !== templateFilter) return false;
    if (search && !r.recipient_email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Distinct templates for filter dropdown
  const distinctTemplates = Array.from(new Set(rows.map((r) => r.template_name)));

  const buildTestData = (tpl: string) => {
    const now = new Date();
    const dateStr = format(now, 'yyyy-MM-dd');
    if (tpl === 'session-reminder') {
      return {
        studentName: 'طالب تجريبي',
        sessionTitle: 'حصة اختبارية',
        sessionDate: dateStr,
        sessionTime: '18:00',
        groupName: 'مجموعة اختبار',
        joinUrl: 'https://kojobot.com',
        recipientType: 'student' as const,
      };
    }
    if (tpl === 'payment-due') {
      return {
        studentName: 'طالب تجريبي',
        amount: 500,
        currency: 'EGP',
        dueDate: dateStr,
        invoiceUrl: 'https://kojobot.com/my-finances',
      };
    }
    // password-reset
    return {
      userName: 'مستخدم تجريبي',
      newPassword: 'TempPass#1234',
      loginUrl: 'https://kojobot.com/auth',
    };
  };

  const handleSendTest = async () => {
    if (!testEmail || !/.+@.+\..+/.test(testEmail)) {
      toast({
        title: isArabic ? 'بريد غير صحيح' : 'Invalid email',
        description: isArabic ? 'أدخل عنوان بريد إلكتروني صحيح' : 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }
    setTestSending(true);
    const idempotencyKey = `test-${testTemplate}-${testEmail}-${Date.now()}`;
    const result = await sendEmail({
      to: testEmail,
      templateName: testTemplate,
      templateData: buildTestData(testTemplate),
      idempotencyKey,
    });
    setTestSending(false);

    if (result.success) {
      toast({
        title: isArabic ? 'تم الإرسال' : 'Email sent',
        description: isArabic
          ? `تم إرسال إيميل الاختبار إلى ${testEmail}`
          : `Test email sent to ${testEmail}`,
      });
      setTestOpen(false);
      // Refresh logs after a brief delay
      setTimeout(fetchLogs, 1000);
    } else {
      toast({
        title: isArabic ? 'فشل الإرسال' : 'Send failed',
        description: result.error || (isArabic ? 'حدث خطأ غير معروف' : 'Unknown error'),
        variant: 'destructive',
      });
    }
  };

  const openDetail = async (row: DedupedRow) => {
    setDetail({ open: true, loading: true, row, history: [] });
    if (!row.message_id) {
      setDetail({ open: true, loading: false, row, history: [row] });
      return;
    }
    const { data, error } = await supabase
      .from('email_send_log')
      .select('*')
      .eq('message_id', row.message_id)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Failed to fetch email detail history:', error);
      setDetail({ open: true, loading: false, row, history: [row] });
      return;
    }
    setDetail({ open: true, loading: false, row, history: (data ?? []) as EmailLogRow[] });
  };

  // Compute timing info for the detail dialog
  const detailTiming = (() => {
    if (!detail.row || detail.history.length === 0) return null;
    const sorted = [...detail.history].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    const enqueuedAt = sorted.find((r) => r.status === 'pending')?.created_at ?? sorted[0].created_at;
    const finalRow = [...sorted].reverse().find((r) => r.status !== 'pending') ?? sorted[sorted.length - 1];
    const finalAt = finalRow.created_at;
    const durationMs = +new Date(finalAt) - +new Date(enqueuedAt);
    return { enqueuedAt, finalAt, finalStatus: finalRow.status, durationMs };
  })();

  return (
    <DashboardLayout>
      <PageHeader
        title={isArabic ? 'سجل الإيميلات' : 'Email Logs'}
        subtitle={
          isArabic
            ? 'متابعة حالة الإيميلات المرسلة من النظام'
            : 'Monitor outbound emails sent from the system'
        }
        icon={Mail}
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setTestOpen(true)} variant="default">
              <Send className={`h-4 w-4 ${isArabic ? 'ml-2' : 'mr-2'}`} />
              {isArabic ? 'إرسال اختبار' : 'Send test'}
            </Button>
            <Button onClick={fetchLogs} variant="outline" disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''} ${isArabic ? 'ml-2' : 'mr-2'}`} />
              {isArabic ? 'تحديث' : 'Refresh'}
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {isArabic ? 'الإجمالي' : 'Total'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {isArabic ? 'تم الإرسال' : 'Sent'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.sent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {isArabic ? 'فشل' : 'Failed'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.failed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {isArabic ? 'قيد الإرسال' : 'Pending'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-3">
            <Input
              placeholder={isArabic ? 'البحث بالبريد الإلكتروني...' : 'Search by email...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="md:max-w-xs"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="md:w-48">
                <SelectValue placeholder={isArabic ? 'الحالة' : 'Status'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isArabic ? 'كل الحالات' : 'All statuses'}</SelectItem>
                <SelectItem value="sent">{isArabic ? 'تم الإرسال' : 'Sent'}</SelectItem>
                <SelectItem value="failed">{isArabic ? 'فشل' : 'Failed'}</SelectItem>
                <SelectItem value="pending">{isArabic ? 'قيد الإرسال' : 'Pending'}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={templateFilter} onValueChange={setTemplateFilter}>
              <SelectTrigger className="md:w-56">
                <SelectValue placeholder={isArabic ? 'نوع الإيميل' : 'Email type'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isArabic ? 'كل الأنواع' : 'All types'}</SelectItem>
                {distinctTemplates.map((t) => (
                  <SelectItem key={t} value={t}>
                    {isArabic ? TEMPLATE_LABELS[t]?.ar || t : TEMPLATE_LABELS[t]?.en || t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <TableSkeleton rows={6} columns={5} />
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>{isArabic ? 'لا توجد إيميلات حالياً' : 'No emails to display'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isArabic ? 'النوع' : 'Type'}</TableHead>
                    <TableHead>{isArabic ? 'المستلم' : 'Recipient'}</TableHead>
                    <TableHead>{isArabic ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead>{isArabic ? 'الوقت' : 'Time'}</TableHead>
                    <TableHead>{isArabic ? 'الخطأ' : 'Error'}</TableHead>
                    <TableHead className="text-end">{isArabic ? 'تفاصيل' : 'Details'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => {
                    const statusCfg = STATUS_CONFIG[row.status] || STATUS_CONFIG.pending;
                    const StatusIcon = statusCfg.icon;
                    const tplLabel = isArabic
                      ? TEMPLATE_LABELS[row.template_name]?.ar || row.template_name
                      : TEMPLATE_LABELS[row.template_name]?.en || row.template_name;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{tplLabel}</TableCell>
                        <TableCell className="text-sm font-mono">{row.recipient_email}</TableCell>
                        <TableCell>
                          <Badge variant={statusCfg.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {isArabic ? statusCfg.labelAr : statusCfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(row.created_at), 'PPp', {
                            locale: isArabic ? ar : undefined,
                          })}
                        </TableCell>
                        <TableCell className="text-sm text-destructive max-w-xs truncate" title={row.error_message || ''}>
                          {row.error_message || '—'}
                        </TableCell>
                        <TableCell className="text-end">
                          <Button variant="ghost" size="sm" onClick={() => openDetail(row)}>
                            {isArabic ? 'عرض' : 'View'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isArabic ? 'إرسال إيميل اختبار' : 'Send test email'}</DialogTitle>
            <DialogDescription>
              {isArabic
                ? 'اختر القالب وأدخل عنوان البريد لاستقبال نسخة تجريبية ببيانات وهمية.'
                : 'Pick a template and recipient to receive a sample email with dummy data.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{isArabic ? 'القالب' : 'Template'}</Label>
              <Select value={testTemplate} onValueChange={(v: any) => setTestTemplate(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="session-reminder">
                    {isArabic ? TEMPLATE_LABELS['session-reminder'].ar : TEMPLATE_LABELS['session-reminder'].en}
                  </SelectItem>
                  <SelectItem value="payment-due">
                    {isArabic ? TEMPLATE_LABELS['payment-due'].ar : TEMPLATE_LABELS['payment-due'].en}
                  </SelectItem>
                  <SelectItem value="password-reset">
                    {isArabic ? TEMPLATE_LABELS['password-reset'].ar : TEMPLATE_LABELS['password-reset'].en}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? 'البريد الإلكتروني للاستقبال' : 'Recipient email'}</Label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)} disabled={testSending}>
              {isArabic ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleSendTest} disabled={testSending}>
              {testSending ? (
                <RefreshCw className={`h-4 w-4 animate-spin ${isArabic ? 'ml-2' : 'mr-2'}`} />
              ) : (
                <Send className={`h-4 w-4 ${isArabic ? 'ml-2' : 'mr-2'}`} />
              )}
              {isArabic ? 'إرسال' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={detail.open} onOpenChange={(o) => setDetail((d) => ({ ...d, open: o }))}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isArabic ? 'تفاصيل الإيميل' : 'Email details'}</DialogTitle>
            <DialogDescription>
              {detail.row?.recipient_email}
            </DialogDescription>
          </DialogHeader>

          {detail.loading ? (
            <div className="py-8 text-center text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto" />
            </div>
          ) : detail.row ? (
            <div className="space-y-5 py-2">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs mb-1">{isArabic ? 'النوع' : 'Template'}</div>
                  <div className="font-medium">
                    {isArabic
                      ? TEMPLATE_LABELS[detail.row.template_name]?.ar || detail.row.template_name
                      : TEMPLATE_LABELS[detail.row.template_name]?.en || detail.row.template_name}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs mb-1">{isArabic ? 'الحالة النهائية' : 'Final status'}</div>
                  <div>
                    {(() => {
                      const cfg = STATUS_CONFIG[detail.row.status] || STATUS_CONFIG.pending;
                      const I = cfg.icon;
                      return (
                        <Badge variant={cfg.variant} className="gap-1">
                          <I className="h-3 w-3" />
                          {isArabic ? cfg.labelAr : cfg.label}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs mb-1">{isArabic ? 'وقت الإرسال (الدخول للطابور)' : 'Enqueued at'}</div>
                  <div className="font-mono text-xs">
                    {detailTiming
                      ? format(new Date(detailTiming.enqueuedAt), 'PPpp', { locale: isArabic ? ar : undefined })
                      : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs mb-1">{isArabic ? 'وقت الحالة النهائية' : 'Finalized at'}</div>
                  <div className="font-mono text-xs">
                    {detailTiming
                      ? format(new Date(detailTiming.finalAt), 'PPpp', { locale: isArabic ? ar : undefined })
                      : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs mb-1">{isArabic ? 'مدة المعالجة' : 'Processing time'}</div>
                  <div className="font-mono text-xs">
                    {detailTiming ? `${(detailTiming.durationMs / 1000).toFixed(2)}s` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Resend ID</div>
                  <div className="font-mono text-xs break-all">
                    {detail.row.metadata?.resend_id || '—'}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-muted-foreground text-xs mb-1">{isArabic ? 'مفتاح منع التكرار' : 'Idempotency key'}</div>
                  <div className="font-mono text-xs break-all bg-muted/40 rounded px-2 py-1">
                    {detail.row.message_id || '—'}
                  </div>
                </div>
              </div>

              {/* Error if any */}
              {detail.history.some((h) => h.error_message) && (
                <div>
                  <div className="text-sm font-semibold mb-2">{isArabic ? 'سبب الفشل' : 'Failure reason'}</div>
                  <div className="text-xs font-mono bg-destructive/10 text-destructive border border-destructive/20 rounded p-3 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                    {detail.history.find((h) => h.error_message)?.error_message}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div>
                <div className="text-sm font-semibold mb-2">{isArabic ? 'سجل الأحداث' : 'Event timeline'}</div>
                <div className="space-y-2">
                  {detail.history.map((h) => {
                    const cfg = STATUS_CONFIG[h.status] || STATUS_CONFIG.pending;
                    const I = cfg.icon;
                    return (
                      <div key={h.id} className="flex items-start gap-3 text-sm border-l-2 border-border pl-3 py-1">
                        <Badge variant={cfg.variant} className="gap-1 mt-0.5 shrink-0">
                          <I className="h-3 w-3" />
                          {isArabic ? cfg.labelAr : cfg.label}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-muted-foreground font-mono">
                            {format(new Date(h.created_at), 'PPpp', { locale: isArabic ? ar : undefined })}
                          </div>
                          {h.error_message && (
                            <div className="text-xs text-destructive mt-1 break-all line-clamp-2">
                              {h.error_message}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail((d) => ({ ...d, open: false }))}>
              {isArabic ? 'إغلاق' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
