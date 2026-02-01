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
          />
        </div>

        {/* Options - Single Field per Option */}
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
      </CardContent>
    </Card>
  );
}
