import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Upload, CheckCircle2, FileWarning, Sparkles, FileEdit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { parseImport, diffTemplates, summarizeDiff, type ExportedFile, type DiffEntry } from '@/lib/templateExport';
import type { EmailTemplateRow } from '@/components/email/TemplateEditorDialog';

type Mode = 'overwrite' | 'skip' | 'duplicate';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: EmailTemplateRow[];
  isRTL: boolean;
  onImported: () => void;
}

export function TemplateImportDialog({ open, onOpenChange, existing, isRTL, onImported }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [parsed, setParsed] = useState<ExportedFile | null>(null);
  const [diffs, setDiffs] = useState<DiffEntry[]>([]);
  const [mode, setMode] = useState<Mode>('overwrite');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep('upload');
    setParsed(null);
    setDiffs([]);
    setMode('overwrite');
  };

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const p = parseImport(text);
      const d = diffTemplates(p, existing);
      setParsed(p);
      setDiffs(d);
      setStep('preview');
    } catch (e: any) {
      toast({
        title: isRTL ? 'فشل قراءة الملف' : 'Invalid file',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  const apply = async () => {
    if (!parsed) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('import_email_templates_batch', {
        p_payload: parsed as any,
        p_mode: mode,
      });
      if (error) throw error;
      const result = data as any;
      toast({
        title: isRTL ? 'تم الاستيراد' : 'Import complete',
        description: isRTL
          ? `${result.created ?? 0} جديد، ${result.updated ?? 0} تم تحديثه، ${result.skipped ?? 0} تم تخطّيه`
          : `${result.created ?? 0} new, ${result.updated ?? 0} updated, ${result.skipped ?? 0} skipped`,
      });
      onImported();
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast({ title: isRTL ? 'فشل الاستيراد' : 'Import failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const summary = summarizeDiff(diffs);

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {isRTL ? 'استيراد قوالب' : 'Import templates'}
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="py-6 space-y-4">
            <Alert>
              <FileWarning className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {isRTL
                  ? 'حمّل ملف JSON تم تصديره مسبقاً. سنعرض لك الفروقات قبل تطبيق أي شيء.'
                  : 'Upload a previously-exported JSON file. We will show you the diff before applying any changes.'}
              </AlertDescription>
            </Alert>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <Label htmlFor="import-file" className="cursor-pointer text-primary hover:underline">
                {isRTL ? 'اختر ملف JSON' : 'Choose a JSON file'}
              </Label>
              <Input
                id="import-file"
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
            </div>
          </div>
        )}

        {step === 'preview' && parsed && (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-2">
              <SummaryCard label={isRTL ? 'المجموع' : 'Total'} value={summary.total} />
              <SummaryCard label={isRTL ? 'جديد' : 'New'} value={summary.new} className="text-emerald-600" />
              <SummaryCard label={isRTL ? 'تعديل' : 'Modified'} value={summary.modified} className="text-amber-600" />
              <SummaryCard label={isRTL ? 'تعارض' : 'Conflicts'} value={summary.conflict} className="text-destructive" />
            </div>

            {summary.conflict > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {isRTL
                    ? `${summary.conflict} قوالب أحدث في قاعدة البيانات من الملف. اختر طريقة التعامل أدناه.`
                    : `${summary.conflict} templates are newer in DB than in the file. Pick a resolution mode below.`}
                </AlertDescription>
              </Alert>
            )}

            {/* Conflict mode */}
            <div className="border rounded-lg p-3">
              <Label className="text-sm font-semibold mb-2 block">
                {isRTL ? 'طريقة التعامل مع التعارضات' : 'Conflict resolution'}
              </Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <ModeOption
                  value="overwrite"
                  active={mode === 'overwrite'}
                  icon={<FileEdit className="h-4 w-4" />}
                  title={isRTL ? 'استبدال' : 'Overwrite'}
                  desc={isRTL ? 'يحدّث القوالب الموجودة' : 'Update existing templates'}
                />
                <ModeOption
                  value="skip"
                  active={mode === 'skip'}
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  title={isRTL ? 'تخطّي' : 'Skip'}
                  desc={isRTL ? 'يتجاهل الموجود' : 'Keep existing as-is'}
                />
                <ModeOption
                  value="duplicate"
                  active={mode === 'duplicate'}
                  icon={<Sparkles className="h-4 w-4" />}
                  title={isRTL ? 'نسخة جديدة' : 'Duplicate'}
                  desc={isRTL ? 'ينشئ نسخة جديدة' : 'Create as new copy'}
                />
              </RadioGroup>
            </div>

            {/* Diff list */}
            <ScrollArea className="flex-1 border rounded-lg">
              <div className="divide-y">
                {diffs.map((d, i) => (
                  <div key={i} className="p-3 flex items-start gap-3">
                    <DiffBadge status={d.status} isRTL={isRTL} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{d.incoming.name}</div>
                      {d.changedFields.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {isRTL ? 'الحقول المتغيرة:' : 'Changed fields:'}{' '}
                          <span className="font-mono">{d.changedFields.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          {step === 'preview' && (
            <Button variant="outline" onClick={reset} disabled={busy}>
              {isRTL ? 'رجوع' : 'Back'}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          {step === 'preview' && (
            <Button onClick={apply} disabled={busy || summary.total - summary.unchanged === 0}>
              {busy ? (isRTL ? 'جارٍ التطبيق...' : 'Applying...') : (isRTL ? 'تطبيق' : 'Apply')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="border rounded-lg p-2 text-center">
      <div className={`text-2xl font-bold tabular-nums ${className ?? ''}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function ModeOption({
  value, active, icon, title, desc,
}: { value: string; active: boolean; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Label
      htmlFor={`mode-${value}`}
      className={`flex items-start gap-2 border rounded-md p-2 cursor-pointer transition-colors ${
        active ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
      }`}
    >
      <RadioGroupItem value={value} id={`mode-${value}`} className="mt-0.5" />
      <div className="flex-1">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          {icon}
          {title}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
    </Label>
  );
}

function DiffBadge({ status, isRTL }: { status: DiffEntry['status']; isRTL: boolean }) {
  const map: Record<DiffEntry['status'], { en: string; ar: string; cls: string }> = {
    new:       { en: 'NEW',       ar: 'جديد',  cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
    modified:  { en: 'MODIFIED',  ar: 'تعديل', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
    conflict:  { en: 'CONFLICT',  ar: 'تعارض', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
    unchanged: { en: 'UNCHANGED', ar: 'بدون',  cls: 'bg-muted text-muted-foreground border-border' },
  };
  const m = map[status];
  return (
    <Badge variant="outline" className={`${m.cls} text-[10px] tracking-wider min-w-[80px] justify-center`}>
      {isRTL ? m.ar : m.en}
    </Badge>
  );
}
