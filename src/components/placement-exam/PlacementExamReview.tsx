import { CheckCircle, AlertCircle, ArrowRight, ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/quiz/CodeBlock';
import type { ExamQuestion, ExamPhase } from '@/pages/TakePlacementTest';

interface PlacementExamReviewProps {
  questions: ExamQuestion[];
  answers: Record<string, string>;
  isRTL: boolean;
  phase: ExamPhase;
  onGoBack: () => void;
  onGoToQuestion: (index: number) => void;
  onSubmit: () => void;
}

function getOptionLabel(question: ExamQuestion, answerKey: string): string {
  const opts = question.options;
  if (Array.isArray(opts)) {
    const idx = parseInt(answerKey, 10);
    return opts[idx] ?? answerKey;
  }
  if (typeof opts === 'object' && opts !== null) {
    return (opts as Record<string, string>)[answerKey] ?? answerKey;
  }
  return answerKey;
}

export function PlacementExamReview({
  questions,
  answers,
  isRTL,
  phase,
  onGoBack,
  onGoToQuestion,
  onSubmit,
}: PlacementExamReviewProps) {
  const answeredCount = Object.keys(answers).length;
  const unansweredCount = questions.length - answeredCount;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {isRTL ? 'مراجعة الإجابات' : 'Review Answers'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <Badge variant="secondary" className="text-sm px-3 py-1.5">
              <CheckCircle className="h-4 w-4 me-1.5 text-green-500" />
              {answeredCount} {isRTL ? 'مجاب' : 'answered'}
            </Badge>
            {unansweredCount > 0 && (
              <Badge variant="destructive" className="text-sm px-3 py-1.5">
                <AlertCircle className="h-4 w-4 me-1.5" />
                {unansweredCount} {isRTL ? 'بدون إجابة' : 'unanswered'}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Questions list */}
      {questions.map((q, idx) => {
        const qId = String(q.question_id);
        const answered = answers[qId] !== undefined;
        const selectedLabel = answered ? getOptionLabel(q, answers[qId]) : null;

        return (
          <Card key={qId} className={!answered ? 'border-destructive/50' : ''}>
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-muted-foreground text-sm">
                    {isRTL ? `س${idx + 1}` : `Q${idx + 1}`}
                  </span>
                  <Badge variant="outline" className="text-xs">{q.skill}</Badge>
                </div>
                {answered ? (
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => onGoToQuestion(idx)}
                  >
                    {isRTL ? 'أجب' : 'Answer'}
                  </Button>
                )}
              </div>

              <p
                className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ unicodeBidi: 'plaintext' }}
              >
                {q.question_text_ar}
              </p>

              {q.code_snippet && (
                <CodeBlock code={q.code_snippet} className="text-xs" />
              )}

              {answered && selectedLabel && (
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-primary/5 border border-primary/20">
                  <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium" style={{ unicodeBidi: 'plaintext' }}>
                    {selectedLabel}
                  </span>
                </div>
              )}

              {!answered && (
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-destructive/5 border border-destructive/20">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  <span className="text-sm text-destructive">
                    {isRTL ? 'لم يتم الإجابة' : 'Not answered'}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Actions */}
      <div className="flex justify-between pb-8 sticky bottom-0 bg-background pt-4 border-t">
        <Button variant="outline" onClick={onGoBack}>
          {isRTL ? <ArrowRight className="h-4 w-4 me-1" /> : <ArrowLeft className="h-4 w-4 me-1" />}
          {isRTL ? 'العودة للأسئلة' : 'Back to Questions'}
        </Button>
        <Button
          onClick={onSubmit}
          disabled={phase === 'submitting'}
          className="bg-green-600 hover:bg-green-700"
        >
          <Send className="h-4 w-4 me-1" />
          {phase === 'submitting'
            ? (isRTL ? 'جارٍ التسليم...' : 'Submitting...')
            : (isRTL ? 'تسليم الامتحان' : 'Submit Exam')}
        </Button>
      </div>
    </div>
  );
}
