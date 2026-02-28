import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

import { CodeBlock } from './CodeBlock';

interface GeneratedQuestion {
  question_text_ar: string;
  options_ar: string[];
  correct_index: number;
  points: number;
  rationale?: string;
  tags?: string[];
  code_snippet?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  hasDescription: boolean;
  hasPdfText: boolean;
  onQuestionsGenerated: (questions: GeneratedQuestion[]) => void;
}

export function AIGenerateDialog({ open, onClose, sessionId, hasDescription, hasPdfText, onQuestionsGenerated }: Props) {
  const { isRTL } = useLanguage();
  const [questionsCount, setQuestionsCount] = useState(10);
  const [ageGroup, setAgeGroup] = useState('10-13');
  const [difficulty, setDifficulty] = useState('medium');
  const [additionalContext, setAdditionalContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = hasDescription || hasPdfText;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setGeneratedQuestions(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-quiz-questions', {
        body: { sessionId, questionsCount, ageGroup, difficulty, additionalContext: additionalContext.slice(0, 500) },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.questions?.length) throw new Error(isRTL ? 'لم يتم توليد أسئلة' : 'No questions generated');

      setGeneratedQuestions(data.questions);
    } catch (err: any) {
      setError(err.message || (isRTL ? 'فشل في توليد الأسئلة' : 'Failed to generate questions'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddAll = () => {
    if (generatedQuestions) {
      onQuestionsGenerated(generatedQuestions);
      handleReset();
      onClose();
    }
  };

  const handleReset = () => {
    setGeneratedQuestions(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { handleReset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {isRTL ? 'توليد أسئلة بالذكاء الاصطناعي' : 'AI Generate Questions'}
          </DialogTitle>
        </DialogHeader>

        {!generatedQuestions ? (
          <div className="space-y-5">
            {!canGenerate && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                {isRTL ? 'الوصف ونص PDF كلاهما فارغ. أضف وصف أو ارفع PDF أولاً.' : 'Both description and PDF text are empty. Add a description or upload a PDF first.'}
              </div>
            )}

            {canGenerate && !hasPdfText && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                {isRTL ? 'لا يوجد نص PDF مستخرج. الأسئلة ستُبنى على الوصف فقط. ارفع PDF لجودة أعلى.' : 'No PDF text extracted. Questions will be based on description only. Upload a PDF for better quality.'}
              </div>
            )}

            {/* Questions Count */}
            <div>
              <Label className="flex items-center justify-between mb-2">
                <span>{isRTL ? 'عدد الأسئلة' : 'Number of Questions'}</span>
                <Badge variant="secondary">{questionsCount}</Badge>
              </Label>
              <Slider value={[questionsCount]} onValueChange={([v]) => setQuestionsCount(v)} min={5} max={20} step={1} />
            </div>

            {/* Age Group */}
            <div>
              <Label className="mb-1.5 block">{isRTL ? 'الفئة العمرية' : 'Age Group'}</Label>
              <Select value={ageGroup} onValueChange={setAgeGroup}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="6-9">{isRTL ? '6-9 سنوات' : '6-9 years'}</SelectItem>
                  <SelectItem value="10-13">{isRTL ? '10-13 سنة' : '10-13 years'}</SelectItem>
                  <SelectItem value="14-18">{isRTL ? '14-18 سنة' : '14-18 years'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Difficulty */}
            <div>
              <Label className="mb-1.5 block">{isRTL ? 'مستوى الصعوبة' : 'Difficulty'}</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">{isRTL ? 'سهل' : 'Easy'}</SelectItem>
                  <SelectItem value="medium">{isRTL ? 'متوسط' : 'Medium'}</SelectItem>
                  <SelectItem value="hard">{isRTL ? 'صعب' : 'Hard'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Additional Context */}
            <div>
              <Label className="mb-1.5 block">{isRTL ? 'سياق إضافي (اختياري)' : 'Additional Context (optional)'}</Label>
              <Textarea
                value={additionalContext}
                onChange={e => setAdditionalContext(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder={isRTL ? 'ملاحظات إضافية للمساعدة في توليد أسئلة أدق...' : 'Additional notes to help generate better questions...'}
                dir="rtl"
              />
              <p className="text-xs text-muted-foreground mt-1 text-end">{additionalContext.length}/500</p>
            </div>

            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={handleGenerate} disabled={loading || !canGenerate} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {loading ? (isRTL ? 'جاري التوليد...' : 'Generating...') : (isRTL ? 'توليد' : 'Generate')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" />
              {isRTL ? `تم توليد ${generatedQuestions.length} سؤال` : `${generatedQuestions.length} questions generated`}
            </div>

            {/* Preview */}
            <div className="max-h-[400px] overflow-y-auto space-y-3">
              {generatedQuestions.map((q, i) => (
                <div key={i} className="border rounded-lg p-3 text-sm space-y-2">
                  <p className="font-medium" dir="rtl">
                    <span className="text-muted-foreground ml-1">{i + 1}.</span> {q.question_text_ar}
                  </p>
                  {q.code_snippet && <CodeBlock code={q.code_snippet} className="my-2 text-xs" />}
                  <div className="grid grid-cols-2 gap-1.5" dir="rtl">
                    {q.options_ar.map((opt, j) => (
                      <div key={j} className={`px-2 py-1 rounded text-xs ${j === q.correct_index ? 'bg-primary/10 text-primary font-medium border border-primary/30' : 'bg-muted/50'}`}>
                        {opt}
                      </div>
                    ))}
                  </div>
                  {q.rationale && (
                    <p className="text-xs text-muted-foreground" dir="rtl">💡 {q.rationale}</p>
                  )}
                </div>
              ))}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleReset}>{isRTL ? 'إعادة التوليد' : 'Regenerate'}</Button>
              <Button onClick={handleAddAll} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {isRTL ? `إضافة ${generatedQuestions.length} سؤال` : `Add ${generatedQuestions.length} Questions`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
