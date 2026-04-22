import { useState, useEffect, useRef } from 'react';
import { Award, Download, Loader2, Printer, RefreshCw, Clock, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface CertRow {
  id: string;
  student_id: string;
  level_name_snapshot: string;
  student_name_snapshot: string;
  certificate_code: string | null;
  status: string;
  storage_path: string | null;
  retry_count: number;
  error_message: string | null;
  issued_at: string;
  printed_at: string | null;
  group_id: string | null;
}

const REGEN_LIMIT = 5;
const REGEN_WINDOW_MS = 60_000;

export default function CertificatesQueue() {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const [rows, setRows] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const regenTimestamps = useRef<number[]>([]);

  useEffect(() => {
    fetchRows();
    const channel = supabase
      .channel('certs-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_certificates' }, () => fetchRows())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchRows = async () => {
    const { data, error } = await supabase
      .from('student_certificates')
      .select('*')
      .or('status.in.(pending,generating,failed),and(status.eq.ready,printed_at.is.null)')
      .order('issued_at', { ascending: false })
      .limit(200);
    if (!error && data) setRows(data as CertRow[]);
    setLoading(false);
  };

  const checkRateLimit = (): boolean => {
    const now = Date.now();
    regenTimestamps.current = regenTimestamps.current.filter(t => now - t < REGEN_WINDOW_MS);
    if (regenTimestamps.current.length >= REGEN_LIMIT) {
      toast.error(isRTL ? 'كتير أوي! استنى دقيقة' : 'Too many regenerations. Wait a minute.');
      return false;
    }
    regenTimestamps.current.push(now);
    return true;
  };

  const handleGenerate = async (cert: CertRow, retry = false) => {
    if (retry && !checkRateLimit()) return;
    setActionLoading(cert.id);
    try {
      if (retry) {
        await supabase
          .from('student_certificates')
          .update({ status: 'pending', retry_count: 0, error_message: null })
          .eq('id', cert.id);
      }
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-certificate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ certificate_id: cert.id }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      // Notify admins on Telegram
      try {
        const { notifyAdmins } = await import('@/lib/notifyAdmins');
        notifyAdmins({
          eventKey: 'admin-certificate-issued',
          templateData: {
            studentName: cert.student_name_snapshot || '—',
            levelName: cert.level_name_snapshot || '—',
          },
          idempotencyKey: `cert-${cert.id}`,
        }).catch(() => {});
      } catch {}

      toast.success(isRTL ? 'تم توليد الشهادة' : 'Certificate generated');
      fetchRows();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownload = async (certId: string) => {
    setActionLoading(certId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-certificate-url?certificate_id=${certId}`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      window.open(json.url, '_blank');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkPrinted = async (certId: string) => {
    setActionLoading(certId);
    const { error } = await supabase
      .from('student_certificates')
      .update({ printed_at: new Date().toISOString(), printed_by: user?.id })
      .eq('id', certId);
    if (error) toast.error(error.message);
    else { toast.success(isRTL ? 'تم تسجيل الطباعة' : 'Marked as printed'); fetchRows(); }
    setActionLoading(null);
  };

  const ready = rows.filter(r => r.status === 'ready' && !r.printed_at);
  const inProgress = rows.filter(r => ['pending', 'generating', 'failed'].includes(r.status));

  const renderRow = (cert: CertRow) => (
    <div key={cert.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/40 transition">
      <div className="space-y-1 min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Link to={`/student/${cert.student_id}`} className="font-semibold text-sm hover:underline truncate">
            {cert.student_name_snapshot}
          </Link>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{cert.level_name_snapshot}</span>
          <Badge variant={
            cert.status === 'ready' ? 'default' :
            cert.status === 'failed' ? 'destructive' :
            cert.status === 'generating' ? 'secondary' : 'outline'
          } className="text-xs">
            {cert.status === 'ready' ? (isRTL ? 'جاهزة' : 'Ready') :
             cert.status === 'failed' ? (isRTL ? 'فشل' : 'Failed') :
             cert.status === 'generating' ? (isRTL ? 'قيد التوليد' : 'Generating') :
             (isRTL ? 'في الانتظار' : 'Pending')}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {cert.certificate_code && <>{isRTL ? 'كود:' : 'Code:'} {cert.certificate_code} · </>}
          {new Date(cert.issued_at).toLocaleDateString()}
        </p>
        {cert.error_message && <p className="text-xs text-destructive line-clamp-1">{cert.error_message}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {cert.status === 'pending' && (
          <Button size="sm" variant="outline" onClick={() => handleGenerate(cert)} disabled={actionLoading === cert.id}>
            {actionLoading === cert.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        )}
        {cert.status === 'failed' && (
          <Button size="sm" variant="outline" onClick={() => handleGenerate(cert, true)} disabled={actionLoading === cert.id}>
            {actionLoading === cert.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1 text-xs">{isRTL ? 'إعادة' : 'Retry'}</span>
          </Button>
        )}
        {cert.status === 'ready' && (
          <>
            <Button size="sm" variant="outline" onClick={() => handleDownload(cert.id)} disabled={actionLoading === cert.id}>
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="default" onClick={() => handleMarkPrinted(cert.id)} disabled={actionLoading === cert.id}>
              <Printer className="h-3.5 w-3.5 mr-1" />
              {isRTL ? 'طُبعت' : 'Printed'}
            </Button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="h-6 w-6 text-primary" />
            {isRTL ? 'طابور الشهادات' : 'Certificates Queue'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRTL ? 'إدارة الشهادات الجاهزة للطباعة وتلك قيد التوليد' : 'Manage certificates ready for printing and those in generation'}
          </p>
        </div>

        {loading ? (
          <Card><CardContent className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>
        ) : (
          <Tabs defaultValue="ready" className="w-full">
            <TabsList>
              <TabsTrigger value="ready" className="gap-2">
                <CheckCircle className="h-4 w-4" />
                {isRTL ? 'جاهزة للطباعة' : 'Ready to Print'}
                <Badge variant="default" className="ml-1">{ready.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="progress" className="gap-2">
                <Clock className="h-4 w-4" />
                {isRTL ? 'قيد التوليد' : 'In Progress'}
                <Badge variant="secondary" className="ml-1">{inProgress.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ready" className="space-y-3 mt-4">
              {ready.length === 0 ? (
                <Card><CardContent className="text-center py-10 text-muted-foreground">
                  <Award className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>{isRTL ? 'لا توجد شهادات جاهزة للطباعة' : 'No certificates ready for printing'}</p>
                </CardContent></Card>
              ) : ready.map(renderRow)}
            </TabsContent>

            <TabsContent value="progress" className="space-y-3 mt-4">
              {inProgress.length === 0 ? (
                <Card><CardContent className="text-center py-10 text-muted-foreground">
                  <CheckCircle className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>{isRTL ? 'لا توجد شهادات قيد التوليد' : 'No certificates in progress'}</p>
                </CardContent></Card>
              ) : inProgress.map(renderRow)}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
