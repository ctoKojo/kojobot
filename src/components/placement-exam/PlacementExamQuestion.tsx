import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CodeBlock } from '@/components/quiz/CodeBlock';
import type { ExamQuestion } from '@/pages/TakePlacementTest';

interface PlacementExamQuestionProps {
  question: ExamQuestion;
  questionIndex: number;
  selectedAnswer: string;
  onAnswer: (questionId: string, value: string) => void;
  isRTL: boolean;
}

export function PlacementExamQuestion({
  question,
  questionIndex,
  selectedAnswer,
  onAnswer,
  isRTL,
}: PlacementExamQuestionProps) {
  const opts = question.options;
  const entries: [string, string][] = Array.isArray(opts)
    ? opts.map((o, i) => [String(i), o])
    : typeof opts === 'object' && opts !== null
      ? (Object.entries(opts) as [string, string][]).sort(([a], [b]) => a.localeCompare(b))
      : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {isRTL ? `سؤال ${questionIndex + 1}` : `Question ${questionIndex + 1}`}
          <Badge variant="outline" className="ms-2 text-xs">{question.skill}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p
          className="text-base leading-relaxed whitespace-pre-wrap"
          style={{ unicodeBidi: 'plaintext' }}
        >
          {question.question_text_ar}
        </p>

        {question.image_url && (
          <img src={question.image_url} alt="Question" className="max-w-full rounded-lg" />
        )}

        {question.code_snippet && (
          <CodeBlock code={question.code_snippet} />
        )}

        <RadioGroup
          value={selectedAnswer}
          onValueChange={val => onAnswer(String(question.question_id), val)}
          className="space-y-2"
        >
          {entries.map(([key, val]) => (
            <Label
              key={key}
              htmlFor={`opt-${question.question_id}-${key}`}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent ${
                selectedAnswer === key ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <RadioGroupItem value={key} id={`opt-${question.question_id}-${key}`} className="shrink-0" />
              <span className="flex-1" style={{ unicodeBidi: 'plaintext' }}>{val}</span>
            </Label>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
