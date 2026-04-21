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
import { Mail, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface EmailLogRow {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface DedupedRow extends EmailLogRow {
  // The latest row per message_id
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
          <Button onClick={fetchLogs} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''} ${isArabic ? 'ml-2' : 'mr-2'}`} />
            {isArabic ? 'تحديث' : 'Refresh'}
          </Button>
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
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(row.created_at), 'PPp', {
                            locale: isArabic ? ar : undefined,
                          })}
                        </TableCell>
                        <TableCell className="text-sm text-destructive max-w-xs truncate" title={row.error_message || ''}>
                          {row.error_message || '—'}
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
    </DashboardLayout>
  );
}
