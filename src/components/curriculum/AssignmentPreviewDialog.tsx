import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, Sparkles, Check, X } from 'lucide-react';

interface Props {
  open: boolean;
  imageUrl: string | null;
  sessionNumber: number;
  onConfirm: () => void;
  onSkip: () => void;
  extracting: boolean;
}

export function AssignmentPreviewDialog({ open, imageUrl, sessionNumber, onConfirm, onSkip, extracting }: Props) {
  const { isRTL } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onSkip()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {isRTL ? `هل دي صفحة الواجب؟ (سيشن ${sessionNumber})` : `Is this the assignment? (Session ${sessionNumber})`}
          </DialogTitle>
          <DialogDescription>
            {isRTL
              ? 'دي آخر صفحة في الـ PDF. لو دي صفحة الواجب اضغط تأكيد وهيتم استخراج البيانات تلقائياً.'
              : 'This is the last page of the PDF. If this is the assignment page, confirm and we\'ll extract the details automatically.'}
          </DialogDescription>
        </DialogHeader>

        {imageUrl && (
          <div className="border rounded-lg overflow-hidden bg-muted/20 max-h-[50vh] overflow-y-auto">
            <img
              src={imageUrl}
              alt="Last slide preview"
              className="w-full h-auto"
            />
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onSkip} disabled={extracting}>
            <X className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {isRTL ? 'تخطي' : 'Skip'}
          </Button>
          <Button onClick={onConfirm} disabled={extracting}>
            {extracting ? (
              <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />
            ) : (
              <Check className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            )}
            {extracting
              ? (isRTL ? 'جاري الاستخراج...' : 'Extracting...')
              : (isRTL ? 'تأكيد واستخراج' : 'Confirm & Extract')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
