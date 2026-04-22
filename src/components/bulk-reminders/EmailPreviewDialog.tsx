import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Eye } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: string;
  bodyHtml: string;
  recipientLabel?: string;
}

/**
 * Renders a preview of the resolved email subject + body with sample data already
 * interpolated by the caller.
 */
export function EmailPreviewDialog({ open, onOpenChange, subject, bodyHtml, recipientLabel }: Props) {
  const { isRTL } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            {isRTL ? 'معاينة الإيميل' : 'Email preview'}
          </DialogTitle>
          <DialogDescription>
            {isRTL
              ? 'هذه معاينة بقيم تجريبية. القيم الفعلية ستُستبدل لكل مستلم.'
              : 'Sample preview. Real values will be substituted per recipient.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 overflow-auto flex-1">
          {recipientLabel && (
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline">{isRTL ? 'مستلم تجريبي' : 'Sample recipient'}</Badge>
              <span className="text-muted-foreground">{recipientLabel}</span>
            </div>
          )}

          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
              {isRTL ? 'الموضوع' : 'Subject'}
            </div>
            <div className="font-medium text-sm">{subject || (isRTL ? '— فارغ —' : '— empty —')}</div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground border-b">
              {isRTL ? 'المحتوى' : 'Body'}
            </div>
            <div
              className="bg-white p-4 text-sm"
              dir="ltr"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: bodyHtml || '<p style="color:#999">— empty —</p>' }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
