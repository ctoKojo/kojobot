import { useState, useEffect, useRef } from 'react';
import { Award, Download, Loader2, Printer, RefreshCw, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const REGEN_LIMIT = 5;
const REGEN_WINDOW_MS = 60_000;

interface Certificate {
  id: string;
  level_name_snapshot: string;
  student_name_snapshot: string;
  certificate_code: string;
  status: string;
  storage_path: string | null;
  retry_count: number;
  error_message: string | null;
  issued_at: string;
  printed_at: string | null;
}

export function StudentCertificatesTab({ studentId }: { studentId: string }) {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchCertificates();
  }, [studentId]);

  const fetchCertificates = async () => {
    const { data, error } = await supabase
      .from('student_certificates')
      .select('*')
      .eq('student_id', studentId)
      .order('issued_at', { ascending: false });

    if (!error && data) setCertificates(data as Certificate[]);
    setLoading(false);
  };

  const handleGenerate = async (certId: string) => {
    setActionLoading(certId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-certificate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ certificate_id: certId }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(isRTL ? 'تم توليد الشهادة' : 'Certificate generated');
      fetchCertificates();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegenerate = async (cert: Certificate) => {
    setActionLoading(cert.id);
    try {
      await supabase
        .from('student_certificates')
        .update({ status: 'pending', retry_count: 0, error_message: null })
        .eq('id', cert.id);
      await handleGenerate(cert.id);
    } catch (err: any) {
      toast.error(err.message);
      setActionLoading(null);
    }
  };

  const handleMarkPrinted = async (certId: string) => {
    setActionLoading(certId);
    const { error } = await supabase
      .from('student_certificates')
      .update({ printed_at: new Date().toISOString(), printed_by: user?.id })
      .eq('id', certId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isRTL ? 'تم تسجيل الطباعة' : 'Marked as printed');
      fetchCertificates();
    }
    setActionLoading(null);
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

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (certificates.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-muted-foreground">
          <Award className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>{isRTL ? 'لا توجد شهادات' : 'No certificates'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          {isRTL ? 'الشهادات' : 'Certificates'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {certificates.map((cert) => (
          <div key={cert.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{cert.level_name_snapshot}</span>
                <Badge variant={cert.status === 'ready' ? 'default' : cert.status === 'failed' ? 'destructive' : 'secondary'}>
                  {cert.status === 'ready' ? (isRTL ? 'جاهزة' : 'Ready') :
                   cert.status === 'failed' ? (isRTL ? 'فشل' : 'Failed') :
                   cert.status === 'generating' ? (isRTL ? 'جاري التوليد' : 'Generating') :
                   (isRTL ? 'في الانتظار' : 'Pending')}
                </Badge>
                {cert.printed_at && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <CheckCircle className="h-3 w-3" />
                    {isRTL ? 'مطبوعة' : 'Printed'}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {isRTL ? 'كود:' : 'Code:'} {cert.certificate_code} · {new Date(cert.issued_at).toLocaleDateString()}
              </p>
              {cert.error_message && (
                <p className="text-xs text-destructive">{cert.error_message}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {(cert.status === 'pending' || cert.status === 'failed') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => cert.status === 'failed' ? handleRegenerate(cert) : handleGenerate(cert.id)}
                  disabled={actionLoading === cert.id}
                >
                  {actionLoading === cert.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
              )}
              {cert.status === 'ready' && (
                <>
                  <Button size="sm" variant="outline" onClick={() => handleDownload(cert.id)} disabled={actionLoading === cert.id}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {!cert.printed_at && (
                    <Button size="sm" variant="default" onClick={() => handleMarkPrinted(cert.id)} disabled={actionLoading === cert.id}>
                      <Printer className="h-3.5 w-3.5 mr-1" />
                      {isRTL ? 'طُبعت' : 'Printed'}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
