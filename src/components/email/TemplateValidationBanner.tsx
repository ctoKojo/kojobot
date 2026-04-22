import { useMemo } from 'react';
import { AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type { ValidationResult } from '@/lib/templateValidation';

interface Props {
  validation: ValidationResult;
  isRTL: boolean;
}

export function TemplateValidationBanner({ validation, isRTL }: Props) {
  const counts = useMemo(
    () => ({
      errors: validation.errors.length,
      warnings: validation.warnings.length,
      unknown: validation.unknownVariables.length,
    }),
    [validation],
  );

  if (counts.errors === 0 && counts.warnings === 0) {
    return (
      <Alert className="border-emerald-500/40 bg-emerald-500/5">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <AlertDescription className="text-xs">
          {isRTL ? 'القالب جاهز للحفظ' : 'Template is valid and ready to save'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant={counts.errors > 0 ? 'destructive' : 'default'} className={counts.errors === 0 ? 'border-amber-500/40 bg-amber-500/5' : ''}>
      {counts.errors > 0 ? (
        <XCircle className="h-4 w-4" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-amber-600" />
      )}
      <AlertDescription className="text-xs space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {counts.errors > 0 && (
            <Badge variant="destructive">
              {counts.errors} {isRTL ? 'خطأ' : counts.errors === 1 ? 'error' : 'errors'}
            </Badge>
          )}
          {counts.warnings > 0 && (
            <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-500">
              {counts.warnings} {isRTL ? 'تحذير' : counts.warnings === 1 ? 'warning' : 'warnings'}
            </Badge>
          )}
        </div>

        {validation.errors.slice(0, 3).map((e, i) => (
          <div key={`e-${i}`} className="text-xs">
            • {isRTL ? e.message_ar : e.message_en}
          </div>
        ))}

        {validation.warnings.slice(0, 3).map((w, i) => (
          <div key={`w-${i}`} className="text-xs">
            • {isRTL ? w.message_ar : w.message_en}
          </div>
        ))}

        {counts.errors + counts.warnings > 6 && (
          <div className="text-xs text-muted-foreground">
            {isRTL ? `+${counts.errors + counts.warnings - 6} مشاكل أخرى` : `+${counts.errors + counts.warnings - 6} more issues`}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
