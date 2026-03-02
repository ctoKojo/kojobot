import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface PdfDownloadButtonProps {
  sessionId: string;
  sessionNumber: number | null;
  isRTL: boolean;
  size?: 'sm' | 'default' | 'lg' | 'icon';
  label?: string;
}

export function PdfDownloadButton({ sessionId, sessionNumber, isRTL, size = 'sm', label }: PdfDownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-session-pdf-url', {
        body: { sessionId },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);

      // Use fetch + blob for reliable cross-origin download
      const response = await fetch(data.url);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `session-${sessionNumber ?? 'unknown'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button variant="outline" size={size} onClick={handleDownload} disabled={downloading} className="flex items-center gap-1.5 text-xs">
      {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
      {label ?? (isRTL ? 'تحميل PDF' : 'PDF')}
    </Button>
  );
}
