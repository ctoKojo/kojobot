import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle2, FileJson, Upload } from 'lucide-react';

interface ValidationResult {
  valid: boolean;
  total: number;
  errors: string[];
  distribution?: {
    by_age_group: Record<string, number>;
    by_level: Record<string, number>;
  };
  skills?: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  validation: ValidationResult | null;
  validating: boolean;
  importing: boolean;
  onConfirmImport: () => void;
  isRTL: boolean;
}

export default function ImportPreviewDialog({
  open, onOpenChange, validation, validating, importing, onConfirmImport, isRTL,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            {isRTL ? 'معاينة الاستيراد' : 'Import Preview'}
          </DialogTitle>
        </DialogHeader>

        {validating ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : validation ? (
          <div className="space-y-4">
            {/* Status */}
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              validation.valid
                ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400'
                : 'bg-destructive/10 text-destructive'
            }`}>
              {validation.valid
                ? <CheckCircle2 className="h-5 w-5" />
                : <AlertTriangle className="h-5 w-5" />}
              <span className="font-medium">
                {validation.valid
                  ? (isRTL ? `✅ ${validation.total} سؤال جاهز للاستيراد` : `✅ ${validation.total} questions ready to import`)
                  : (isRTL ? `❌ ${validation.errors.length} خطأ في التحقق` : `❌ ${validation.errors.length} validation errors`)}
              </span>
            </div>

            {/* Total */}
            <div className="grid grid-cols-2 gap-3">
              <div className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground">{isRTL ? 'إجمالي الأسئلة' : 'Total Questions'}</div>
                <div className="text-2xl font-bold">{validation.total}</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-xs text-muted-foreground">{isRTL ? 'المهارات' : 'Skills Detected'}</div>
                <div className="text-2xl font-bold">{validation.skills?.length || 0}</div>
              </div>
            </div>

            {/* Distribution by Age Group */}
            {validation.distribution?.by_age_group && (
              <div>
                <div className="text-sm font-medium mb-2">{isRTL ? 'التوزيع حسب الفئة العمرية' : 'By Age Group'}</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(validation.distribution.by_age_group).map(([key, count]) => (
                    <Badge key={key} variant="secondary" className="text-sm">
                      {key}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Distribution by Level */}
            {validation.distribution?.by_level && (
              <div>
                <div className="text-sm font-medium mb-2">{isRTL ? 'التوزيع حسب المستوى' : 'By Level'}</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(validation.distribution.by_level).map(([key, count]) => (
                    <Badge key={key} variant="outline" className="text-sm capitalize">
                      {key}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Skills */}
            {validation.skills && validation.skills.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">{isRTL ? 'المهارات المكتشفة' : 'Skills'}</div>
                <div className="flex flex-wrap gap-1.5">
                  {validation.skills.sort().map(s => (
                    <Badge key={s} variant="outline" className="text-xs capitalize">
                      {s.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            {validation.errors.length > 0 && (
              <div>
                <div className="text-sm font-medium text-destructive mb-2">
                  {isRTL ? 'أخطاء التحقق' : 'Validation Errors'} ({validation.errors.length})
                </div>
                <div className="max-h-40 overflow-y-auto border rounded p-2 text-xs space-y-1 bg-muted/50">
                  {validation.errors.slice(0, 50).map((err, i) => (
                    <div key={i} className="text-destructive">{err}</div>
                  ))}
                  {validation.errors.length > 50 && (
                    <div className="text-muted-foreground">
                      ...{isRTL ? `و ${validation.errors.length - 50} خطأ آخر` : `and ${validation.errors.length - 50} more`}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Warning */}
            {validation.valid && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 inline me-1" />
                {isRTL
                  ? 'تحذير: سيتم حذف جميع الأسئلة الحالية واستبدالها بالأسئلة الجديدة. هذا الإجراء لا يمكن التراجع عنه.'
                  : 'Warning: All existing questions will be deleted and replaced. This action cannot be undone.'}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                onClick={onConfirmImport}
                disabled={!validation.valid || importing}
              >
                <Upload className="h-4 w-4 me-1" />
                {importing
                  ? (isRTL ? 'جارٍ الاستيراد...' : 'Importing...')
                  : (isRTL ? 'استبدال واستيراد' : 'Replace & Import')}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
