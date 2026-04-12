import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, Copy, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { QuestionImageUpload } from './QuestionImageUpload';
import { EditableCodeBlock } from './EditableCodeBlock';

interface SimplifiedQuestion {
  id?: string;
  question_text: string;
  question_text_ar: string;
  options: string[];
  correct_answer: string;
  points: number;
  order_index: number;
  image_url?: string;
  code_snippet?: string;
  question_type?: string;
  model_answer?: string;
  rubric?: { steps: string[]; points_per_step: number } | null;
}

interface DraggableQuestionCardProps {
  question: SimplifiedQuestion;
  index: number;
  isRTL: boolean;
  onUpdate: (updates: Partial<SimplifiedQuestion>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onUpdateOption: (optIndex: number, value: string) => void;
}

export function DraggableQuestionCard({
  question,
  index,
  isRTL,
  onUpdate,
  onRemove,
  onDuplicate,
  onUpdateOption,
}: DraggableQuestionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id || `question-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  const isOpenEnded = question.question_type === 'open_ended';

  return (
    <Card ref={setNodeRef} style={style} className={`relative ${isDragging ? 'shadow-xl' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing touch-none"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
            </button>
            {isRTL ? `السؤال ${index + 1}` : `Question ${index + 1}`}
            {isOpenEnded && (
              <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">
                {isRTL ? 'مفتوح' : 'Open-Ended'}
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Label className="text-xs">{isRTL ? 'درجات:' : 'Points:'}</Label>
              <Input
                type="number"
                value={question.points}
                onChange={(e) => onUpdate({ points: parseInt(e.target.value) || 1 })}
                className="w-16 h-8"
                min={1}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              onClick={onDuplicate}
              title={isRTL ? 'نسخ السؤال' : 'Duplicate Question'}
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={onRemove}
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
          onImageChange={(url) => onUpdate({ image_url: url || undefined })}
          isRTL={isRTL}
        />

        {/* Code Snippet */}
        {question.code_snippet !== undefined && (
          <EditableCodeBlock
            code={question.code_snippet || ''}
            onChange={(val) => onUpdate({ code_snippet: val })}
            isRTL={isRTL}
          />
        )}

        {/* Question Text - Single Field */}
        <div className="space-y-2">
          <Label>{isRTL ? 'نص السؤال' : 'Question Text'}</Label>
          <Textarea
            value={question.question_text}
            onChange={(e) =>
              onUpdate({
                question_text: e.target.value,
                question_text_ar: e.target.value,
              })
            }
            placeholder={
              isRTL
                ? 'اكتب السؤال هنا... (يمكنك الكتابة بالعربية أو الإنجليزية أو كليهما)'
                : 'Enter your question here... (Arabic, English, or both)'
            }
            className="min-h-[80px]"
            dir="rtl"
            style={{ unicodeBidi: 'plaintext' }}
          />
        </div>

        {isOpenEnded ? (
          /* Open-Ended: Model Answer + Rubric */
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isRTL ? 'الإجابة النموذجية (للمصحح فقط)' : 'Model Answer (for grader only)'}</Label>
              <Textarea
                value={question.model_answer || ''}
                onChange={(e) => onUpdate({ model_answer: e.target.value })}
                placeholder={isRTL ? 'اكتب الإجابة النموذجية هنا...' : 'Write the model answer here...'}
                className="min-h-[120px] font-mono text-sm"
                dir="rtl"
                style={{ unicodeBidi: 'plaintext' }}
              />
            </div>

            {/* Rubric Steps */}
            <div className="space-y-2">
              <Label>{isRTL ? 'معايير التصحيح (Rubric)' : 'Grading Rubric'}</Label>
              <p className="text-xs text-muted-foreground">
                {isRTL ? 'أضف خطوات التصحيح - كل خطوة لها درجة' : 'Add grading steps - each step has points'}
              </p>
              {(question.rubric?.steps || []).map((step, stepIdx) => (
                <div key={stepIdx} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6">{stepIdx + 1}.</span>
                  <Input
                    value={step}
                    onChange={(e) => {
                      const steps = [...(question.rubric?.steps || [])];
                      steps[stepIdx] = e.target.value;
                      onUpdate({ rubric: { steps, points_per_step: question.rubric?.points_per_step || 1 } });
                    }}
                    placeholder={isRTL ? `خطوة ${stepIdx + 1}` : `Step ${stepIdx + 1}`}
                    className="flex-1"
                    dir="rtl"
                    style={{ unicodeBidi: 'plaintext' }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => {
                      const steps = (question.rubric?.steps || []).filter((_, i) => i !== stepIdx);
                      onUpdate({ rubric: steps.length ? { steps, points_per_step: question.rubric?.points_per_step || 1 } : null });
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const steps = [...(question.rubric?.steps || []), ''];
                  onUpdate({ rubric: { steps, points_per_step: question.rubric?.points_per_step || 1 } });
                }}
              >
                <Plus className="w-3 h-3 mr-1" />
                {isRTL ? 'إضافة خطوة' : 'Add Step'}
              </Button>
            </div>
          </div>
        ) : (
          /* MCQ: Options */
          <div className="space-y-3">
            <Label>
              {isRTL ? 'الخيارات (اختر الإجابة الصحيحة)' : 'Options (Select correct answer)'}
            </Label>
            <RadioGroup
              value={question.correct_answer}
              onValueChange={(value) => onUpdate({ correct_answer: value })}
            >
              {[0, 1, 2, 3].map((optIndex) => {
                const isSelected = question.correct_answer === optIndex.toString();
                return (
                  <div
                    key={optIndex}
                    onClick={() => onUpdate({ correct_answer: optIndex.toString() })}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'hover:border-muted-foreground/50 hover:bg-muted/30'
                    }`}
                  >
                    <RadioGroupItem 
                      value={optIndex.toString()} 
                      id={`q${index}-opt${optIndex}`}
                      className="pointer-events-none"
                    />
                    <Input
                      value={question.options[optIndex] || ''}
                      onChange={(e) => onUpdateOption(optIndex, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder={isRTL ? `الخيار ${optIndex + 1}` : `Option ${optIndex + 1}`}
                      className="flex-1"
                      dir="rtl"
                      style={{ unicodeBidi: 'plaintext' }}
                    />
                    {isSelected && (
                      <span className="text-xs text-primary font-medium whitespace-nowrap">
                        {isRTL ? '✓ صحيح' : '✓ Correct'}
                      </span>
                    )}
                  </div>
                );
              })}
            </RadioGroup>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
