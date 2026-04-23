import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, AlertTriangle, CheckCircle2, Filter, XCircle } from 'lucide-react';
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
  _qid?: string;
}

interface RejectedItem {
  question_preview: string;
  reasons: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  hasDescription: boolean;
  hasPdfText: boolean;
  onQuestionsGenerated: (questions: GeneratedQuestion[]) => void;
  ageGroupId?: string;
}

// Tolerant mapping: min_age range -> age group key
const mapMinAgeToGroup = (minAge: number): string | null => {
  if (minAge >= 6 && minAge <= 9) return '6-9';
  if (minAge >= 10 && minAge <= 13) return '10-13';
  if (minAge >= 14 && minAge <= 18) return '14-18';
  return null; // fallback to manual select
};

// Persistence key namespaced per session
const storageKey = (sessionId: string) => `ai_gen_dialog_v1:${sessionId}`;

interface PersistedState {
  questions: GeneratedQuestion[];
  warnings: Record<string, string[]>;
  rejected: RejectedItem[];
  generatedAt: number;
}

// Expire persisted results after 2 hours
const PERSIST_TTL_MS = 2 * 60 * 60 * 1000;

export function AIGenerateDialog({ open, onClose, sessionId, hasDescription, hasPdfText, onQuestionsGenerated, ageGroupId }: Props) {
  const { isRTL } = useLanguage();
  const [questionsCount, setQuestionsCount] = useState(10);
  const [ageGroup, setAgeGroup] = useState('10-13');
  const [ageGroupAutoDetected, setAgeGroupAutoDetected] = useState(false);
  const [difficulty, setDifficulty] = useState('medium');
  const [additionalContext, setAdditionalContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[] | null>(null);
  const [warnings, setWarnings] = useState<Record<string, string[]>>({});
  const [rejectedItems, setRejectedItems] = useState<RejectedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showWarningsOnly, setShowWarningsOnly] = useState(false);
  const [restoredFromCache, setRestoredFromCache] = useState(false);

  // Restore previously generated questions for this session (survives refresh / tab change)
  useEffect(() => {
    if (!sessionId) return;
    try {
      const raw = sessionStorage.getItem(storageKey(sessionId));
      if (!raw) return;
      const parsed: PersistedState = JSON.parse(raw);
      if (!parsed?.questions?.length) return;
      if (Date.now() - (parsed.generatedAt || 0) > PERSIST_TTL_MS) {
        sessionStorage.removeItem(storageKey(sessionId));
        return;
      }
      setGeneratedQuestions(parsed.questions);
      setWarnings(parsed.warnings || {});
      setRejectedItems(parsed.rejected || []);
      setRestoredFromCache(true);
    } catch {
      /* ignore corrupted cache */
    }
  }, [sessionId]);

  const persistResults = (qs: GeneratedQuestion[], w: Record<string, string[]>, r: RejectedItem[]) => {
    try {
      const payload: PersistedState = { questions: qs, warnings: w, rejected: r, generatedAt: Date.now() };
      sessionStorage.setItem(storageKey(sessionId), JSON.stringify(payload));
    } catch { /* storage full / disabled */ }
  };

  const clearPersisted = () => {
    try { sessionStorage.removeItem(storageKey(sessionId)); } catch { /* noop */ }
  };

  // Auto-detect age group from ageGroupId
  useEffect(() => {
    if (!ageGroupId) {
      setAgeGroupAutoDetected(false);
      return;
    }
    const fetchAgeGroup = async () => {
      try {
        const { data, error } = await supabase
          .from('age_groups')
          .select('min_age, name, name_ar')
          .eq('id', ageGroupId)
          .single();
        if (error || !data) return;
        const mapped = mapMinAgeToGroup(data.min_age);
        if (mapped) {
          setAgeGroup(mapped);
          setAgeGroupAutoDetected(true);
        } else {
          setAgeGroupAutoDetected(false);
        }
      } catch {
        setAgeGroupAutoDetected(false);
      }
    };
    fetchAgeGroup();
  }, [ageGroupId]);

  const canGenerate = hasDescription || hasPdfText;
  const warningCount = Object.keys(warnings).length;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setGeneratedQuestions(null);
    setWarnings({});
    setRejectedItems([]);
    setShowWarningsOnly(false);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-quiz-questions', {
        body: { sessionId, questionsCount, ageGroup, difficulty, additionalContext: additionalContext.slice(0, 500) },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.questions?.length) throw new Error(isRTL ? 'لم يتم توليد أسئلة' : 'No questions generated');

      setGeneratedQuestions(data.questions);
      setWarnings(data.warnings || {});
      setRejectedItems(data.rejected || []);
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
    setWarnings({});
    setRejectedItems([]);
    setError(null);
    setShowWarningsOnly(false);
  };

  const getQuestionWarnings = (q: GeneratedQuestion): string[] => {
    return (q._qid && warnings[q._qid]) ? warnings[q._qid] : [];
  };

  const displayedQuestions = generatedQuestions
    ? showWarningsOnly
      ? generatedQuestions.filter(q => getQuestionWarnings(q).length > 0)
      : generatedQuestions
    : [];

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
                {isRTL ? 'لا يوجد نص PDF مستخرج. الأسئلة ستُبنى على الوصف فقط.' : 'No PDF text. Questions based on description only.'}
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
              <Label className="mb-1.5 block">
                {isRTL ? 'الفئة العمرية' : 'Age Group'}
                {ageGroupAutoDetected && (
                  <span className="text-xs text-muted-foreground ms-2">
                    ({isRTL ? 'محدد تلقائياً من السيشن' : 'Auto-detected from session'})
                  </span>
                )}
              </Label>
              <Select value={ageGroup} onValueChange={setAgeGroup} disabled={ageGroupAutoDetected}>
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
                placeholder={isRTL ? 'ملاحظات إضافية...' : 'Additional notes...'}
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
            {/* Summary bar */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" />
                {isRTL ? `${generatedQuestions.length} سؤال` : `${generatedQuestions.length} questions`}
              </div>
              {warningCount > 0 && (
                <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {isRTL ? `${warningCount} تحذير` : `${warningCount} warnings`}
                </Badge>
              )}
              {rejectedItems.length > 0 && (
                <Badge variant="outline" className="text-destructive border-destructive/30 gap-1">
                  <XCircle className="h-3 w-3" />
                  {isRTL ? `${rejectedItems.length} مستبعد` : `${rejectedItems.length} rejected`}
                </Badge>
              )}
            </div>

            {/* Rejected report */}
            {rejectedItems.length > 0 && (
              <div className="p-3 rounded-md bg-destructive/5 border border-destructive/20 text-sm space-y-1">
                <p className="font-medium text-destructive text-xs">
                  {isRTL ? `تم استبعاد ${rejectedItems.length} سؤال:` : `${rejectedItems.length} questions rejected:`}
                </p>
                {rejectedItems.map((r, i) => (
                  <p key={i} className="text-xs text-muted-foreground" dir="rtl">
                    • {r.question_preview} — {r.reasons.join('، ')}
                  </p>
                ))}
              </div>
            )}

            {/* Filter toggle */}
            {warningCount > 0 && (
              <Button
                variant={showWarningsOnly ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowWarningsOnly(!showWarningsOnly)}
                className="gap-1.5 text-xs"
              >
                <Filter className="h-3 w-3" />
                {isRTL
                  ? showWarningsOnly ? 'عرض الكل' : 'عرض التحذيرات فقط'
                  : showWarningsOnly ? 'Show all' : 'Show warnings only'}
              </Button>
            )}

            {/* Questions preview */}
            <div className="max-h-[400px] overflow-y-auto space-y-3">
              {displayedQuestions.map((q, i) => {
                const qWarnings = getQuestionWarnings(q);
                const originalIndex = generatedQuestions!.indexOf(q);
                return (
                  <div key={q._qid || i} className={`border rounded-lg p-3 text-sm space-y-2 ${qWarnings.length > 0 ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' : ''}`}>
                    <p className="font-medium" dir="rtl">
                      <span className="text-muted-foreground ml-1">{originalIndex + 1}.</span> {q.question_text_ar}
                    </p>
                    {q.code_snippet && <CodeBlock code={q.code_snippet} className="my-2 text-xs" />}
                    <div className="grid grid-cols-2 gap-1.5" dir="rtl">
                      {q.options_ar.map((opt, j) => (
                        <div key={j} dir="rtl" style={{ unicodeBidi: 'plaintext' }} className={`px-2 py-1 rounded text-xs text-right ${j === q.correct_index ? 'bg-primary/10 text-primary font-medium border border-primary/30' : 'bg-muted/50'}`}>
                          {opt}
                        </div>
                      ))}
                    </div>
                    {q.rationale && (
                      <p className="text-xs text-muted-foreground" dir="rtl">💡 {q.rationale}</p>
                    )}
                    {qWarnings.length > 0 && (
                      <div className="flex flex-col gap-1 mt-1">
                        {qWarnings.map((w, wi) => (
                          <div key={wi} className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                            <span dir="rtl">{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
