import { useState, useEffect } from 'react';
import { Award, Download, Loader2, Clock, AlertCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/EmptyState';

interface Certificate {
  id: string;
  level_name_snapshot: string;
  student_name_snapshot: string;
  certificate_code: string;
  status: string;
  issued_at: string;
}

export default function MyCertificates() {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchCertificates();
  }, [user]);

  const fetchCertificates = async () => {
    const { data, error } = await supabase
      .from('student_certificates')
      .select('id, level_name_snapshot, student_name_snapshot, certificate_code, status, issued_at')
      .eq('student_id', user!.id)
      .order('issued_at', { ascending: false });

    if (!error && data) setCertificates(data);
    setLoading(false);
  };

  const handleDownload = async (cert: Certificate) => {
    setDownloading(cert.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-certificate-url?certificate_id=${cert.id}`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      window.open(json.url, '_blank');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download');
    } finally {
      setDownloading(null);
    }
  };

  const statusConfig: Record<string, { icon: any; label: string; labelAr: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    pending: { icon: Clock, label: 'Generating...', labelAr: 'جاري التجهيز...', variant: 'secondary' },
    generating: { icon: Loader2, label: 'Generating...', labelAr: 'جاري التوليد...', variant: 'secondary' },
    ready: { icon: Award, label: 'Ready', labelAr: 'جاهزة', variant: 'default' },
    failed: { icon: AlertCircle, label: 'Error', labelAr: 'خطأ', variant: 'destructive' },
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{isRTL ? 'شهاداتي' : 'My Certificates'}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isRTL ? 'شهادات إتمام المستويات' : 'Level completion certificates'}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : certificates.length === 0 ? (
          <EmptyState
            icon={Award}
            title={isRTL ? 'لا توجد شهادات بعد' : 'No certificates yet'}
            description={isRTL ? 'ستظهر شهاداتك هنا بعد إتمام المستويات' : 'Your certificates will appear here after completing levels'}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {certificates.map((cert) => {
              const cfg = statusConfig[cert.status] || statusConfig.pending;
              return (
                <Card key={cert.id} className="relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-amber-600/10" />
                  <CardContent className="relative p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="p-2.5 rounded-xl bg-amber-500/10">
                        <Award className="h-6 w-6 text-amber-600" />
                      </div>
                      <Badge variant={cfg.variant}>
                        {isRTL ? cfg.labelAr : cfg.label}
                      </Badge>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg">{cert.level_name_snapshot}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {isRTL ? 'كود الشهادة:' : 'Code:'} {cert.certificate_code}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(cert.issued_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>

                    {cert.status === 'ready' && (
                      <Button
                        className="w-full"
                        onClick={() => handleDownload(cert)}
                        disabled={downloading === cert.id}
                      >
                        {downloading === cert.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        {isRTL ? 'تحميل الشهادة' : 'Download Certificate'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
