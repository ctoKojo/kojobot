import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Activity, AlertTriangle, Beaker, CheckCircle2, Clock, Mail, MessageCircle,
  PlayCircle, RefreshCw, XCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Link } from 'react-router-dom';

type Channel = 'email' | 'telegram';
type Window = '24h' | '7d' | '30d';

interface UnifiedLog {
  id: string;
  channel: Channel;
  message_id: string | null;
  template_name: string;
  recipient: string;
  status: string;
  error_message: string | null;
  created_at: string;
  metadata: any;
  is_smoke_test: boolean;
}

interface E2EReport {
  event_key: string;
  audience: string;
  status: 'ok' | 'missing_template' | 'render_error' | 'disabled' | 'error' | 'no_recipient';
  message?: string;
  has_mapping: boolean;
  has_template: boolean;
  resolved_via?: string;
}

const WINDOW_HOURS: Record<Window, number> = { '24h': 24, '7d': 168, '30d': 720 };

export default function NotificationsHealth() {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const dateLocale = isRTL ? ar : enUS;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [windowSize, setWindowSize] = useState<Window>('24h');
  const [channelFilter, setChannelFilter] = useState<'all' | Channel>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'production' | 'smoke'>('production');

  // E2E state
  const [runningE2E, setRunningE2E] = useState(false);
  const [e2eReports, setE2EReports] = useState<E2EReport[] | null>(null);
  const [e2eSummary, setE2ESummary] = useState<any | null>(null);

  const sinceISO = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - WINDOW_HOURS[windowSize]);
    return d.toISOString();
  }, [windowSize]);

  // Fetch unified logs (email + telegram). Smoke flag is computed client-side.
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['notifications-health-logs', windowSize],
    queryFn: async (): Promise<UnifiedLog[]> => {
      const [emailRes, tgRes] = await Promise.all([
        supabase
          .from('email_send_log')
          .select('id, message_id, template_name, recipient_email, status, error_message, created_at, metadata')
          .gte('created_at', sinceISO)
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase
          .from('telegram_send_log')
          .select('id, template_name, chat_id, status, error_message, created_at, metadata')
          .gte('created_at', sinceISO)
          .order('created_at', { ascending: false })
          .limit(1000),
      ]);

      const isSmoke = (md: any, status: string) =>
        status === 'dry_run' || (md && (md.smoke_test === true || md.dry_run === true));

      const emailRows: UnifiedLog[] = (emailRes.data ?? []).map((r: any) => ({
        id: r.id,
        channel: 'email' as Channel,
        message_id: r.message_id,
        template_name: r.template_name,
        recipient: r.recipient_email,
        status: r.status,
        error_message: r.error_message,
        created_at: r.created_at,
        metadata: r.metadata,
        is_smoke_test: isSmoke(r.metadata, r.status),
      }));

      const tgRows: UnifiedLog[] = (tgRes.data ?? []).map((r: any) => ({
        id: r.id,
        channel: 'telegram' as Channel,
        message_id: null,
        template_name: r.template_name,
        recipient: String(r.chat_id ?? ''),
        status: r.status,
        error_message: r.error_message,
        created_at: r.created_at,
        metadata: r.metadata,
        is_smoke_test: isSmoke(r.metadata, r.status),
      }));

      // Dedup email by message_id (keep latest)
      const seen = new Set<string>();
      const dedupedEmail = emailRows.filter((r) => {
        if (!r.message_id) return true;
        if (seen.has(r.message_id)) return false;
        seen.add(r.message_id);
        return true;
      });

      return [...dedupedEmail, ...tgRows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    refetchInterval: 30_000,
  });

  // Realtime subscription
  useEffect(() => {
    const ch = supabase
      .channel('notif-health-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'email_send_log' }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications-health-logs'] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'email_send_log' }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications-health-logs'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'telegram_send_log' }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications-health-logs'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  // Production-only stats (dry_run / smoke_test ALWAYS excluded)
  const stats = useMemo(() => {
    const list = (logs ?? []).filter((r) => !r.is_smoke_test);
    const by = (channel: Channel | 'all', status?: string) =>
      list.filter((r) => (channel === 'all' || r.channel === channel) && (!status || r.status === status)).length;

    const totalEmail = by('email');
    const totalTg = by('telegram');
    const sentEmail = by('email', 'sent');
    const sentTg = by('telegram', 'sent');
    const failedEmail = by('email', 'failed');
    const failedTg = by('telegram', 'failed');
    const pendingEmail = by('email', 'pending');

    const lastHourFailures = list.filter(
      (r) => r.status === 'failed' && new Date(r.created_at).getTime() > Date.now() - 3600_000
    ).length;

    return {
      totalEmail, totalTg, sentEmail, sentTg, failedEmail, failedTg, pendingEmail,
      successRateEmail: totalEmail ? Math.round((sentEmail / totalEmail) * 100) : 0,
      successRateTg: totalTg ? Math.round((sentTg / totalTg) * 100) : 0,
      lastHourFailures,
    };
  }, [logs]);

  const productionLogs = useMemo(() => (logs ?? []).filter((r) => !r.is_smoke_test), [logs]);
  const smokeLogs = useMemo(() => (logs ?? []).filter((r) => r.is_smoke_test), [logs]);

  const filterRows = (source: UnifiedLog[]) =>
    source.filter((r) => {
      if (channelFilter !== 'all' && r.channel !== channelFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.template_name?.toLowerCase().includes(q) &&
          !r.recipient?.toLowerCase().includes(q) &&
          !(r.error_message ?? '').toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });

  const filteredProduction = useMemo(() => filterRows(productionLogs), [productionLogs, channelFilter, statusFilter, search]);
  const filteredSmoke = useMemo(() => filterRows(smokeLogs), [smokeLogs, channelFilter, statusFilter, search]);

  const handleRetry = async (row: UnifiedLog) => {
    setRetryingId(row.id);
    const newKey = `retry-${row.id}-${Date.now()}`;
    try {
      if (row.channel === 'email') {
        const { error } = await supabase.functions.invoke('send-email', {
          body: {
            to: row.recipient,
            templateName: row.template_name,
            templateData: {},
            idempotencyKey: newKey,
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.functions.invoke('send-telegram', {
          body: {
            chatId: Number(row.recipient),
            templateName: row.template_name,
            templateData: {},
            idempotencyKey: newKey,
          },
        });
        if (error) throw error;
      }
      toast({ title: isRTL ? 'تمت إعادة المحاولة' : 'Retry triggered', description: row.template_name });
      setTimeout(() => refetch(), 2000);
    } catch (e: any) {
      toast({
        title: isRTL ? 'فشلت إعادة المحاولة' : 'Retry failed',
        description: e?.message ?? 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setRetryingId(null);
    }
  };

  const runE2E = async () => {
    setRunningE2E(true);
    setE2EReports(null);
    setE2ESummary(null);
    try {
      const { data, error } = await supabase.functions.invoke('notifications-e2e-test', {
        body: {},
      });
      if (error) throw error;
      const res = data as { summary: any; reports: E2EReport[] };
      setE2EReports(res.reports);
      setE2ESummary(res.summary);
      toast({
        title: isRTL ? 'اكتمل الاختبار' : 'E2E test completed',
        description: `${res.summary.ok}/${res.summary.total} ${isRTL ? 'نجحت' : 'passing'}`,
      });
      setTimeout(() => refetch(), 1500);
    } catch (e: any) {
      toast({
        title: isRTL ? 'فشل الاختبار' : 'E2E test failed',
        description: e?.message ?? 'Unknown',
        variant: 'destructive',
      });
    } finally {
      setRunningE2E(false);
    }
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, { color: string; icon: any }> = {
      sent: { color: 'bg-success/10 text-success', icon: CheckCircle2 },
      failed: { color: 'bg-destructive/10 text-destructive', icon: XCircle },
      pending: { color: 'bg-warning/10 text-warning-foreground', icon: Clock },
      retrying: { color: 'bg-primary/10 text-primary', icon: RefreshCw },
      skipped: { color: 'bg-muted text-muted-foreground', icon: Activity },
      dry_run: { color: 'bg-primary/10 text-primary', icon: Beaker },
    };
    const v = variants[status] ?? variants.skipped;
    const Icon = v.icon;
    return (
      <Badge variant="outline" className={v.color}>
        <Icon className="h-3 w-3 me-1" />
        {status}
      </Badge>
    );
  };

  const e2eStatusColor = (s: E2EReport['status']) => {
    switch (s) {
      case 'ok': return 'bg-success/10 text-success';
      case 'missing_template': return 'bg-warning/10 text-warning-foreground';
      case 'disabled': return 'bg-muted text-muted-foreground';
      default: return 'bg-destructive/10 text-destructive';
    }
  };

  const renderLogsTable = (rows: UnifiedLog[], emptyHint: string) => (
    <Card>
      <CardContent className="overflow-x-auto pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{isRTL ? 'القناة' : 'Channel'}</TableHead>
              <TableHead>{isRTL ? 'القالب' : 'Template'}</TableHead>
              <TableHead>{isRTL ? 'المستلم' : 'Recipient'}</TableHead>
              <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
              <TableHead>{isRTL ? 'الوقت' : 'Time'}</TableHead>
              <TableHead>{isRTL ? 'إجراء' : 'Action'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {isLoading ? (isRTL ? 'جاري التحميل...' : 'Loading...') : emptyHint}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={`${row.channel}-${row.id}`}>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      {row.channel === 'email' ? <Mail className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />}
                      {row.channel}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs max-w-[200px] truncate" title={row.template_name}>
                    {row.template_name}
                  </TableCell>
                  <TableCell className="text-xs max-w-[180px] truncate" title={row.recipient}>
                    {row.recipient}
                  </TableCell>
                  <TableCell>
                    {statusBadge(row.status)}
                    {row.error_message && (
                      <p className="text-xs text-destructive mt-1 max-w-[260px] truncate" title={row.error_message}>
                        {row.error_message}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(row.created_at), { addSuffix: true, locale: dateLocale })}
                  </TableCell>
                  <TableCell>
                    {row.status === 'failed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRetry(row)}
                        disabled={retryingId === row.id}
                      >
                        <RefreshCw className={`h-3 w-3 me-1 ${retryingId === row.id ? 'animate-spin' : ''}`} />
                        {isRTL ? 'إعادة' : 'Retry'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <PageHeader
          title={isRTL ? 'صحة الإشعارات' : 'Notifications Health'}
          subtitle={isRTL ? 'مراقبة موحدة لقنوات الإيميل والتيليجرام' : 'Unified monitoring for Email & Telegram channels'}
          icon={Activity}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="/notifications-smoke-test">
                <Beaker className="h-4 w-4 me-2" />
                {isRTL ? 'اختبار قالب' : 'Smoke Test'}
              </Link>
            </Button>
          }
        />

        {/* Critical alert banner (production only) */}
        {stats.lastHourFailures > 5 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">
                  {isRTL ? `${stats.lastHourFailures} فشل في آخر ساعة` : `${stats.lastHourFailures} failures in the last hour`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'افحص السجلات الفاشلة بالأسفل' : 'Check the failed entries below'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Window selector */}
        <Tabs value={windowSize} onValueChange={(v) => setWindowSize(v as Window)}>
          <TabsList>
            <TabsTrigger value="24h">{isRTL ? 'آخر 24 ساعة' : 'Last 24h'}</TabsTrigger>
            <TabsTrigger value="7d">{isRTL ? 'آخر 7 أيام' : 'Last 7d'}</TabsTrigger>
            <TabsTrigger value="30d">{isRTL ? 'آخر 30 يوم' : 'Last 30d'}</TabsTrigger>
          </TabsList>

          <TabsContent value={windowSize} className="space-y-4 mt-4">
            {/* Production stats — excludes dry_run/smoke_test always */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatsCard
                icon={Mail}
                label={isRTL ? 'إيميل - مُرسلة' : 'Email Sent'}
                value={stats.sentEmail}
                sub={`${stats.successRateEmail}% ${isRTL ? 'نجاح' : 'success'}`}
                tone="success"
              />
              <StatsCard
                icon={Mail}
                label={isRTL ? 'إيميل - فشل' : 'Email Failed'}
                value={stats.failedEmail}
                sub={`${stats.pendingEmail} ${isRTL ? 'معلق' : 'pending'}`}
                tone={stats.failedEmail > 0 ? 'danger' : 'muted'}
              />
              <StatsCard
                icon={MessageCircle}
                label={isRTL ? 'تيليجرام - مُرسلة' : 'Telegram Sent'}
                value={stats.sentTg}
                sub={`${stats.successRateTg}% ${isRTL ? 'نجاح' : 'success'}`}
                tone="success"
              />
              <StatsCard
                icon={MessageCircle}
                label={isRTL ? 'تيليجرام - فشل' : 'Telegram Failed'}
                value={stats.failedTg}
                sub={`${stats.totalTg} ${isRTL ? 'إجمالي' : 'total'}`}
                tone={stats.failedTg > 0 ? 'danger' : 'muted'}
              />
            </div>

            {/* E2E Test Results card (separate, in-page) */}
            <Card className="border-primary/30">
              <CardHeader>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <PlayCircle className="h-5 w-5 text-primary" />
                      {isRTL ? 'اختبار End-to-End' : 'End-to-End Test'}
                    </CardTitle>
                    <CardDescription>
                      {isRTL
                        ? 'يختبر كل الأحداث في الكتالوج (dry-run، آمن تماماً)'
                        : 'Tests every catalog event with a dry-run (safe, no real sends)'}
                    </CardDescription>
                  </div>
                  <Button onClick={runE2E} disabled={runningE2E}>
                    <PlayCircle className={`h-4 w-4 me-2 ${runningE2E ? 'animate-pulse' : ''}`} />
                    {runningE2E
                      ? (isRTL ? 'جاري التشغيل...' : 'Running...')
                      : (isRTL ? 'تشغيل الاختبار' : 'Run E2E Test')}
                  </Button>
                </div>
              </CardHeader>
              {e2eSummary && (
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div className="rounded-md border p-3">
                      <p className="text-2xl font-bold">{e2eSummary.total}</p>
                      <p className="text-xs text-muted-foreground">{isRTL ? 'إجمالي' : 'Total'}</p>
                    </div>
                    <div className="rounded-md border border-success/30 bg-success/5 p-3">
                      <p className="text-2xl font-bold text-success">{e2eSummary.ok}</p>
                      <p className="text-xs text-muted-foreground">{isRTL ? 'نجح' : 'OK'}</p>
                    </div>
                    <div className="rounded-md border border-warning/30 bg-warning/5 p-3">
                      <p className="text-2xl font-bold text-warning-foreground">{e2eSummary.missing_template}</p>
                      <p className="text-xs text-muted-foreground">{isRTL ? 'قالب ناقص' : 'Missing'}</p>
                    </div>
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                      <p className="text-2xl font-bold text-destructive">{e2eSummary.errors}</p>
                      <p className="text-xs text-muted-foreground">{isRTL ? 'أخطاء' : 'Errors'}</p>
                    </div>
                  </div>
                  {e2eReports && e2eReports.length > 0 && (
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto rounded-md border">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background">
                          <TableRow>
                            <TableHead>{isRTL ? 'الحدث' : 'Event'}</TableHead>
                            <TableHead>{isRTL ? 'الجمهور' : 'Audience'}</TableHead>
                            <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                            <TableHead>{isRTL ? 'مصدر' : 'Source'}</TableHead>
                            <TableHead>{isRTL ? 'تفاصيل' : 'Details'}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {e2eReports.map((r, i) => (
                            <TableRow key={`${r.event_key}-${i}`}>
                              <TableCell className="font-mono text-xs">{r.event_key}</TableCell>
                              <TableCell className="text-xs">{r.audience}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={e2eStatusColor(r.status)}>
                                  {r.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{r.resolved_via ?? '-'}</TableCell>
                              <TableCell className="text-xs max-w-[300px] truncate" title={r.message}>
                                {r.message ?? '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>

            {/* Filters */}
            <Card>
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
                <Input
                  placeholder={isRTL ? 'بحث: قالب، مستلم، خطأ...' : 'Search: template, recipient, error...'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isRTL ? 'كل القنوات' : 'All channels'}</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="telegram">Telegram</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isRTL ? 'كل الحالات' : 'All statuses'}</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="skipped">Skipped</SelectItem>
                    <SelectItem value="dry_run">Dry-run</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 me-2 ${isLoading ? 'animate-spin' : ''}`} />
                  {isRTL ? 'تحديث' : 'Refresh'}
                </Button>
              </CardContent>
            </Card>

            {/* Production vs Smoke tabs */}
            <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'production' | 'smoke')}>
              <TabsList>
                <TabsTrigger value="production">
                  {isRTL ? 'الإنتاج' : 'Production'} ({filteredProduction.length})
                </TabsTrigger>
                <TabsTrigger value="smoke">
                  <Beaker className="h-3 w-3 me-1" />
                  {isRTL ? 'اختبارات Smoke' : 'Smoke Tests'} ({filteredSmoke.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="production" className="mt-4">
                {renderLogsTable(
                  filteredProduction,
                  isRTL ? 'لا توجد سجلات إنتاج' : 'No production logs',
                )}
              </TabsContent>
              <TabsContent value="smoke" className="mt-4">
                <div className="text-xs text-muted-foreground mb-2 px-1">
                  {isRTL
                    ? 'هذه السجلات لا تُحسب في معدلات النجاح/الفشل بالأعلى.'
                    : 'These rows are excluded from the production success/failure stats above.'}
                </div>
                {renderLogsTable(
                  filteredSmoke,
                  isRTL ? 'لا توجد اختبارات smoke في هذه الفترة' : 'No smoke tests in this window',
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function StatsCard({
  icon: Icon, label, value, sub, tone,
}: {
  icon: any;
  label: string;
  value: number;
  sub?: string;
  tone: 'success' | 'danger' | 'muted';
}) {
  const tones: Record<string, string> = {
    success: 'text-success',
    danger: 'text-destructive',
    muted: 'text-muted-foreground',
  };
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${tones[tone]}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <Icon className={`h-5 w-5 ${tones[tone]}`} />
        </div>
      </CardContent>
    </Card>
  );
}
