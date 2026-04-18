import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Eye, FileText, Image as ImageIcon, Video, File as FileIcon, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

interface AttachmentViewerProps {
  url: string;
  type?: string | null;
  filename?: string;
  label?: string;
}

const getKind = (url: string, type?: string | null): 'image' | 'pdf' | 'video' | 'office' | 'other' => {
  const t = (type || '').toLowerCase();
  const u = url.toLowerCase().split('?')[0];
  if (t.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/.test(u)) return 'image';
  if (t === 'application/pdf' || u.endsWith('.pdf')) return 'pdf';
  if (t.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/.test(u)) return 'video';
  if (/\.(docx?|pptx?|xlsx?)$/.test(u) || t.includes('officedocument') || t.includes('msword') || t.includes('powerpoint') || t.includes('excel')) return 'office';
  return 'other';
};

const getIcon = (kind: ReturnType<typeof getKind>) => {
  switch (kind) {
    case 'image': return <ImageIcon className="w-5 h-5" />;
    case 'pdf': return <FileText className="w-5 h-5" />;
    case 'video': return <Video className="w-5 h-5" />;
    case 'office': return <FileText className="w-5 h-5" />;
    default: return <FileIcon className="w-5 h-5" />;
  }
};

const inferFilename = (url: string, fallback?: string) => {
  if (fallback) return fallback;
  try {
    const path = new URL(url).pathname;
    const last = path.split('/').pop() || 'attachment';
    return decodeURIComponent(last);
  } catch {
    return 'attachment';
  }
};

export function AttachmentViewer({ url, type, filename, label }: AttachmentViewerProps) {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const kind = getKind(url, type);
  const name = inferFilename(url, filename);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      toast({
        title: isRTL ? 'تعذّر التحميل' : 'Download failed',
        description: isRTL ? 'حاول مرة أخرى' : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  const renderPreview = () => {
    switch (kind) {
      case 'image':
        return (
          <div className="flex items-center justify-center bg-muted/30 rounded-lg overflow-auto max-h-[70vh]">
            <img src={url} alt={name} className="max-w-full max-h-[70vh] object-contain" />
          </div>
        );
      case 'pdf':
        return (
          <iframe
            src={`${url}#view=FitH`}
            title={name}
            className="w-full h-[70vh] rounded-lg border bg-white"
          />
        );
      case 'video':
        return (
          <video src={url} controls className="w-full max-h-[70vh] rounded-lg bg-black" />
        );
      case 'office':
        return (
          <iframe
            src={`https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`}
            title={name}
            className="w-full h-[70vh] rounded-lg border bg-white"
          />
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
            <FileIcon className="w-12 h-12" />
            <p>{isRTL ? 'لا يمكن معاينة هذا النوع من الملفات' : 'Preview not available for this file type'}</p>
            <Button onClick={handleDownload} disabled={downloading}>
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isRTL ? 'تحميل الملف' : 'Download file'}
            </Button>
          </div>
        );
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="gap-2"
        >
          {getIcon(kind)}
          <Eye className="w-4 h-4" />
          {label || (isRTL ? 'عرض المرفق' : 'View attachment')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDownload}
          disabled={downloading}
          className="gap-2"
        >
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {isRTL ? 'تحميل' : 'Download'}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 truncate">
              {getIcon(kind)}
              <span className="truncate">{name}</span>
            </DialogTitle>
          </DialogHeader>
          {renderPreview()}
          <div className="flex justify-end pt-2">
            <Button onClick={handleDownload} disabled={downloading} className="gap-2">
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isRTL ? 'تحميل الملف' : 'Download file'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
