import { Plus, Trash2, Copy, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { QuestionImageUpload } from './QuestionImageUpload';

interface SimplifiedQuestion {
  id?: string;
  question_text: string;
  question_text_ar: string;
  options: string[];
  correct_answer: string;
  points: number;
  order_index: number;
  image_url?: string;
}

interface SimplifiedQuestionEditorProps {
  questions: SimplifiedQuestion[];
  onChange: (questions: SimplifiedQuestion[]) => void;
  isRTL: boolean;
}

export function SimplifiedQuestionEditor({ questions, onChange, isRTL }: SimplifiedQuestionEditorProps) {
  const addQuestion = () => {
    const newQuestion: SimplifiedQuestion = {
      question_text: '',
      question_text_ar: '',
      options: ['', '', '', ''],
      correct_answer: '0',
      points: 1,
      order_index: questions.length,
    };
    onChange([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, updates: Partial<SimplifiedQuestion>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    onChange(updated.map((q, i) => ({ ...q, order_index: i })));
  };

  const duplicateQuestion = (index: number) => {
    const questionToCopy = questions[index];
    const newQuestion: SimplifiedQuestion = {
      ...questionToCopy,
      id: undefined,
      order_index: questions.length,
    };
    onChange([...questions, newQuestion]);
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    const updated = [...questions];
    const options = [...updated[qIndex].options];
    options[optIndex] = value;
    updated[qIndex] = { ...updated[qIndex], options };
    onChange(updated);
  };

  const handleImageChange = (qIndex: number, url: string | null) => {
    updateQuestion(qIndex, { image_url: url || undefined });
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
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => duplicateQuestion(qIndex)}
                  title={isRTL ? 'نسخ السؤال' : 'Duplicate Question'}
                >
                  <Copy className="w-4 h-4" />
                </Button>
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
            {/* Image Upload */}
            <QuestionImageUpload
              imageUrl={question.image_url}
              onImageChange={(url) => handleImageChange(qIndex, url)}
              isRTL={isRTL}
            />

            {/* Question Text - Single Field */}
            <div className="space-y-2">
              <Label>{isRTL ? 'نص السؤال' : 'Question Text'}</Label>
              <Textarea
                value={question.question_text}
                onChange={(e) => updateQuestion(qIndex, { 
                  question_text: e.target.value,
                  question_text_ar: e.target.value // Keep both in sync for backward compatibility
                })}
                placeholder={isRTL 
                  ? 'اكتب السؤال هنا... (يمكنك الكتابة بالعربية أو الإنجليزية أو كليهما)' 
                  : 'Enter your question here... (Arabic, English, or both)'}
                className="min-h-[80px]"
              />
            </div>

            {/* Options - Single Field per Option */}
            <div className="space-y-3">
              <Label>{isRTL ? 'الخيارات (اختر الإجابة الصحيحة)' : 'Options (Select correct answer)'}</Label>
              <RadioGroup
                value={question.correct_answer}
                onValueChange={(value) => updateQuestion(qIndex, { correct_answer: value })}
              >
                {[0, 1, 2, 3].map((optIndex) => (
                  <div key={optIndex} className="flex items-center gap-3 p-3 rounded-lg border">
                    <RadioGroupItem value={optIndex.toString()} id={`q${qIndex}-opt${optIndex}`} />
                    <Input
                      value={question.options[optIndex] || ''}
                      onChange={(e) => updateOption(qIndex, optIndex, e.target.value)}
                      placeholder={isRTL 
                        ? `الخيار ${optIndex + 1}` 
                        : `Option ${optIndex + 1}`}
                      className="flex-1"
                    />
                    {question.correct_answer === optIndex.toString() && (
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                        {isRTL ? '✓ صحيح' : '✓ Correct'}
                      </span>
                    )}
                  </div>
                ))}
              </RadioGroup>
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
