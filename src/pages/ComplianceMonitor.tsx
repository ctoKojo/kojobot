import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Download, RefreshCcw, AlertTriangle, History, Activity, FileText, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

type ScanRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  execution_time_ms: number | null;
  sessions_scanned: number | null;
  warnings_created: number | null;
  warnings_auto_resolved: number | null;
  warnings_skipped: number | null;
  metadata: { trace_id?: string; settings_version?: number } | null;
  scan_type: string;
};

type Anomaly = {
  id: string;
  issue_type: string;
  entity_id: string;
  entity_table: string;
  details: Record<string, unknown> & { trace_id?: string };
  detected_at: string;
  status: string;
};

type DedupRow = {
  id: string;
  attempted_at: string;
  trace_id: string | null;
  fingerprint: string;
  existing_warning_id: string | null;
  reason: string;
  attempted_payload: Record<string, unknown>;
};

export default function ComplianceMonitor() {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const locale = isRTL ? ar : enUS;

  const [runs, setRuns] = useState<ScanRun[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [dedups, setDedups] = useState<DedupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescanning, setRescanning] = useState(false);
  const [exportingTrace, setExportingTrace] = useState<string | null>(null);
  const [anomalyTypeFilter, setAnomalyTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const loadAll = async () => {
    setLoading(true);
    const [runsRes, anomRes, dedupRes] = await Promise.all([
      supabase
        .from('compliance_scan_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50),
      supabase
        .from('data_quality_issues')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(200),
      supabase
        .from('warning_dedup_log')
        .select('*')
        .order('attempted_at', { ascending: false })
        .limit(100),
    ]);
    if (runsRes.data) setRuns(runsRes.data as ScanRun[]);
    if (anomRes.data) setAnomalies(anomRes.data as Anomaly[]);
    if (dedupRes.data) setDedups(dedupRes.data as DedupRow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const triggerRescan = async () => {
    setRescanning(true);
    try {
      const { error } = await supabase.functions.invoke('compliance-monitor');
      if (error) throw error;
      toast.success(isRTL ? 'تم بدء فحص جديد' : 'Scan triggered');
      setTimeout(loadAll, 2500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'unknown';
      toast.error(isRTL ? `فشل بدء الفحص: ${msg}` : `Scan failed: ${msg}`);
    } finally {
      setRescanning(false);
    }
  };

  const exportRunPdf = async (traceId: string) => {
    setExportingTrace(traceId);
    try {
      const { data, error } = await supabase.functions.invoke('export-compliance-report', {
        body: { trace_id: traceId },
      });
      if (error) throw error;
      const blob = data instanceof Blob ? data : new Blob([data as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-report-${traceId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(isRTL ? 'تم تنزيل التقرير' : 'Report downloaded');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'unknown';
      toast.error(isRTL ? `فشل التصدير: ${msg}` : `Export failed: ${msg}`);
    } finally {
      setExportingTrace(null);
    }
  };

  const anomalyTypes = useMemo(
    () => Array.from(new Set(anomalies.map((a) => a.issue_type))),
    [anomalies],
  );

  const filteredAnomalies = useMemo(() => {
    return anomalies.filter((a) => {
      if (anomalyTypeFilter !== 'all' && a.issue_type !== anomalyTypeFilter) return false;
      if (search && !a.entity_id.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [anomalies, anomalyTypeFilter, search]);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              {isRTL ? 'مراقبة الالتزام' : 'Compliance Monitor'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isRTL
                ? 'تتبع كامل لعمليات الفحص والشذوذ ومحاولات التكرار'
                : 'Full visibility into scan runs, anomalies, and duplicate attempts'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {isRTL ? 'تحديث' : 'Refresh'}
            </Button>
            <Button size="sm" onClick={triggerRescan} disabled={rescanning}>
              {rescanning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Activity className="h-4 w-4 mr-2" />
              )}
              {isRTL ? 'فحص فوري' : 'Run scan now'}
            </Button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <StatCard
            icon={<History className="h-4 w-4" />}
            label={isRTL ? 'آخر 50 فحص' : 'Recent runs'}
            value={runs.length}
          />
          <StatCard
            icon={<AlertTriangle className="h-4 w-4 text-warning" />}
            label={isRTL ? 'شذوذ غير محلول' : 'Open anomalies'}
            value={anomalies.filter((a) => a.status === 'open').length}
          />
          <StatCard
            icon={<FileText className="h-4 w-4 text-info" />}
            label={isRTL ? 'محاولات تكرار' : 'Dedup attempts'}
            value={dedups.length}
          />
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label={isRTL ? 'متوسط زمن الفحص' : 'Avg scan ms'}
            value={
              runs.length
                ? Math.round(
                    runs.reduce((s, r) => s + (r.execution_time_ms ?? 0), 0) / runs.length,
                  )
                : 0
            }
          />
        </div>

        <Tabs defaultValue="runs">
          <TabsList>
            <TabsTrigger value="runs">{isRTL ? 'سجل الفحوصات' : 'Scan timeline'}</TabsTrigger>
            <TabsTrigger value="anomalies">{isRTL ? 'الشذوذ' : 'Anomalies'}</TabsTrigger>
            <TabsTrigger value="dedup">{isRTL ? 'سجل التكرار' : 'Dedup log'}</TabsTrigger>
          </TabsList>

          {/* Scan Timeline */}
          <TabsContent value="runs">
            <Card>
              <CardHeader>
                <CardTitle>{isRTL ? 'الجدول الزمني للفحوصات' : 'Scan Run Timeline'}</CardTitle>
                <CardDescription>
                  {isRTL
                    ? 'كل فحص له trace_id وإصدار إعدادات قابلين للتتبع'
                    : 'Each run carries a trace_id and settings version for full audit'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto my-8" />
                ) : runs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    {isRTL ? 'لا توجد فحوصات' : 'No runs yet'}
                  </p>
                ) : (
                  <ScrollArea className="h-[520px]">
                    <ol className="relative border-s ms-3 space-y-4 pe-2">
                      {runs.map((r) => {
                        const traceId = r.metadata?.trace_id ?? null;
                        const duration = r.finished_at
                          ? new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()
                          : null;
                        return (
                          <li key={r.id} className="ms-4">
                            <div className="absolute w-3 h-3 bg-primary rounded-full -start-1.5 mt-1.5 border border-background" />
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium">
                                    {new Date(r.started_at).toLocaleString(isRTL ? 'ar-EG' : 'en-GB')}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {r.scan_type}
                                  </Badge>
                                  {r.metadata?.settings_version != null && (
                                    <Badge variant="secondary" className="text-xs">
                                      v{r.metadata.settings_version}
                                    </Badge>
                                  )}
                                  {!r.finished_at && (
                                    <Badge variant="default" className="text-xs">
                                      {isRTL ? 'قيد التشغيل' : 'running'}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(r.started_at), { addSuffix: true, locale })}
                                  {duration && ` • ${duration}ms`}
                                </div>
                                <div className="flex gap-2 text-xs flex-wrap mt-1">
                                  <Metric label={isRTL ? 'فحص' : 'scanned'} value={r.sessions_scanned ?? 0} />
                                  <Metric label={isRTL ? 'منشأ' : 'created'} value={r.warnings_created ?? 0} />
                                  <Metric label={isRTL ? 'محلول' : 'resolved'} value={r.warnings_auto_resolved ?? 0} />
                                  <Metric label={isRTL ? 'مكرر' : 'skipped'} value={r.warnings_skipped ?? 0} />
                                </div>
                                {traceId && (
                                  <code className="text-[10px] text-muted-foreground block mt-1">
                                    {traceId}
                                  </code>
                                )}
                              </div>
                              {traceId && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => exportRunPdf(traceId)}
                                  disabled={exportingTrace === traceId}
                                >
                                  {exportingTrace === traceId ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Download className="h-4 w-4" />
                                  )}
                                  <span className="ms-2 hidden sm:inline">PDF</span>
                                </Button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Anomalies */}
          <TabsContent value="anomalies">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle>{isRTL ? 'الشذوذ المرصود' : 'Detected Anomalies'}</CardTitle>
                    <CardDescription>
                      {isRTL ? 'مصدرها data_quality_issues' : 'Sourced from data_quality_issues'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder={isRTL ? 'بحث بالـ entity_id' : 'Search entity_id'}
                      className="w-44"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <Select value={anomalyTypeFilter} onValueChange={setAnomalyTypeFilter}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{isRTL ? 'كل الأنواع' : 'All types'}</SelectItem>
                        {anomalyTypes.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin mx-auto my-8" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'النوع' : 'Type'}</TableHead>
                        <TableHead>{isRTL ? 'الكيان' : 'Entity'}</TableHead>
                        <TableHead>{isRTL ? 'تفاصيل' : 'Details'}</TableHead>
                        <TableHead>{isRTL ? 'وقت الرصد' : 'Detected'}</TableHead>
                        <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAnomalies.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                            {isRTL ? 'لا توجد سجلات' : 'No records'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAnomalies.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs">
                                {a.issue_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              <div>{a.entity_table}</div>
                              <div className="text-muted-foreground">{a.entity_id.slice(0, 8)}…</div>
                            </TableCell>
                            <TableCell className="text-xs max-w-md truncate">
                              {JSON.stringify(a.details)}
                            </TableCell>
                            <TableCell className="text-xs">
                              {new Date(a.detected_at).toLocaleString(isRTL ? 'ar-EG' : 'en-GB')}
                            </TableCell>
                            <TableCell>
                              <Badge variant={a.status === 'open' ? 'destructive' : 'secondary'}>
                                {a.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dedup log */}
          <TabsContent value="dedup">
            <Card>
              <CardHeader>
                <CardTitle>{isRTL ? 'سجل محاولات التكرار' : 'Dedup Attempts Log'}</CardTitle>
                <CardDescription>
                  {isRTL
                    ? 'كل محاولة إنشاء إنذار مكرر يتم رصدها بـ fingerprint والإنذار الأصلي'
                    : 'Every duplicate warning attempt is captured with its fingerprint and the original warning'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin mx-auto my-8" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'وقت المحاولة' : 'Attempted at'}</TableHead>
                        <TableHead>Fingerprint</TableHead>
                        <TableHead>{isRTL ? 'الإنذار الأصلي' : 'Existing'}</TableHead>
                        <TableHead>Trace</TableHead>
                        <TableHead>{isRTL ? 'السبب' : 'Reason'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dedups.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                            {isRTL ? 'لا توجد محاولات تكرار' : 'No dedup attempts'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        dedups.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {new Date(d.attempted_at).toLocaleString(isRTL ? 'ar-EG' : 'en-GB')}
                            </TableCell>
                            <TableCell>
                              <code className="text-[10px]">{d.fingerprint.slice(0, 12)}…</code>
                            </TableCell>
                            <TableCell>
                              <code className="text-[10px]">
                                {d.existing_warning_id?.slice(0, 8) ?? '-'}
                              </code>
                            </TableCell>
                            <TableCell>
                              <code className="text-[10px]">{d.trace_id?.slice(0, 8) ?? '-'}</code>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {d.reason}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          {icon}
        </div>
        <div className="text-2xl font-bold mt-1">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
      {label}: <span className="font-semibold text-foreground">{value}</span>
    </span>
  );
}
