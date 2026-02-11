import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useLanguage } from '@/contexts/LanguageContext';

interface Question {
  id?: string;
  question_text: string;
  question_text_ar: string;
  options: { en: string[]; ar: string[] };
  correct_answer: string;
  points: number;
  order_index: number;
}

interface QuestionEditorProps {
  questions: Question[];
  onChange: (questions: Question[]) => void;
}

export function QuestionEditor({ questions, onChange }: QuestionEditorProps) {
  const { isRTL } = useLanguage();

  const addQuestion = () => {
    const newQuestion: Question = {
      question_text: '',
      question_text_ar: '',
      options: { en: ['', '', '', ''], ar: ['', '', '', ''] },
      correct_answer: '0',
      points: 1,
      order_index: questions.length,
    };
    onChange([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    const updated = [...questions];
    // Auto-copy to AR fields
    if ('question_text' in updates) {
      updates.question_text_ar = updates.question_text;
    }
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    onChange(updated.map((q, i) => ({ ...q, order_index: i })));
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    const updated = [...questions];
    const options = { ...updated[qIndex].options };
    options.en[optIndex] = value;
    options.ar[optIndex] = value;
    updated[qIndex] = { ...updated[qIndex], options };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {questions.map((question, qIndex) => (
        <Card key={qIndex} className="relative">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                {isRTL ? `السؤال ${qIndex + 1}` : `Question ${qIndex + 1}`}
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Label className="text-xs">{isRTL ? 'درجات:' : 'Points:'}</Label>
                  <Input
                    type="number"
                    value={question.points}
                    onChange={(e) => updateQuestion(qIndex, { points: parseInt(e.target.value) || 1 })}
                    className="w-16 h-8"
                    min={1}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeQuestion(qIndex)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Question Text */}
            <div className="space-y-2">
              <Label>{isRTL ? 'نص السؤال' : 'Question Text'}</Label>
              <Input
                value={question.question_text}
                onChange={(e) => updateQuestion(qIndex, { question_text: e.target.value })}
                placeholder={isRTL ? 'أدخل نص السؤال...' : 'Enter question text...'}
              />
            </div>

            {/* Options */}
            <div className="space-y-3">
              <Label>{isRTL ? 'الخيارات' : 'Options'}</Label>
              <RadioGroup
                value={question.correct_answer}
                onValueChange={(value) => updateQuestion(qIndex, { correct_answer: value })}
              >
                {[0, 1, 2, 3].map((optIndex) => (
                  <div key={optIndex} className="flex items-center gap-3 p-3 rounded-lg border">
                    <RadioGroupItem value={optIndex.toString()} id={`q${qIndex}-opt${optIndex}`} />
                    <Input
                      value={question.options.en[optIndex]}
                      onChange={(e) => updateOption(qIndex, optIndex, e.target.value)}
                      placeholder={isRTL ? `الخيار ${optIndex + 1}` : `Option ${optIndex + 1}`}
                      className="flex-1"
                    />
                  </div>
                ))}
              </RadioGroup>
              <p className="text-sm text-muted-foreground">
                {isRTL ? '* اختر الإجابة الصحيحة بالنقر على الدائرة' : '* Select the correct answer by clicking the radio button'}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={addQuestion}
      >
        <Plus className="w-4 h-4 mr-2" />
        {isRTL ? 'إضافة سؤال' : 'Add Question'}
      </Button>
    </div>
  );
}
