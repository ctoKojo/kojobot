import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Activity, AlertTriangle, CheckCircle2, Clock, Mail, MessageCircle, RefreshCw, XCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

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

  const sinceISO = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - WINDOW_HOURS[windowSize]);
    return d.toISOString();
  }, [windowSize]);

  // Fetch unified logs (email + telegram)
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['notifications-health-logs', windowSize],
    queryFn: async (): Promise<UnifiedLog[]> => {
      const [emailRes, tgRes] = await Promise.all([
        supabase
          .from('email_send_log')
          .select('id, message_id, template_name, recipient_email, status, error_message, created_at, metadata')
          .gte('created_at', sinceISO)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('telegram_send_log')
          .select('id, template_name, chat_id, status, error_message, created_at, metadata')
          .gte('created_at', sinceISO)
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

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

  // Realtime subscription for failed events
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

  const stats = useMemo(() => {
    const list = logs ?? [];
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

  const filtered = useMemo(() => {
    return (logs ?? []).filter((r) => {
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
  }, [logs, channelFilter, statusFilter, search]);

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

  const statusBadge = (status: string) => {
    const variants: Record<string, { color: string; icon: any }> = {
      sent: { color: 'bg-green-500/10 text-green-700 dark:text-green-400', icon: CheckCircle2 },
      failed: { color: 'bg-red-500/10 text-red-700 dark:text-red-400', icon: XCircle },
      pending: { color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400', icon: Clock },
      retrying: { color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400', icon: RefreshCw },
      skipped: { color: 'bg-muted text-muted-foreground', icon: Activity },
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

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <PageHeader
          title={isRTL ? 'صحة الإشعارات' : 'Notifications Health'}
          description={isRTL ? 'مراقبة موحدة لقنوات الإيميل والتيليجرام' : 'Unified monitoring for Email & Telegram channels'}
          icon={Activity}
        />

        {/* Critical alert banner */}
        {stats.lastHourFailures > 5 && (
          <Card className="border-red-500/50 bg-red-500/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-semibold text-red-700 dark:text-red-400">
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
            {/* Stats cards */}
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
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 me-2 ${isLoading ? 'animate-spin' : ''}`} />
                  {isRTL ? 'تحديث' : 'Refresh'}
                </Button>
              </CardContent>
            </Card>

            {/* Logs table */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {isRTL ? `السجلات (${filtered.length})` : `Logs (${filtered.length})`}
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
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
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          {isLoading ? (isRTL ? 'جاري التحميل...' : 'Loading...') : (isRTL ? 'لا توجد سجلات' : 'No logs')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((row) => (
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
                              <p className="text-xs text-red-600 dark:text-red-400 mt-1 max-w-[260px] truncate" title={row.error_message}>
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
    success: 'text-green-600 dark:text-green-400',
    danger: 'text-red-600 dark:text-red-400',
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
