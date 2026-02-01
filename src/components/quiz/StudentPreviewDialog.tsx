import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

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

interface StudentPreviewDialogProps {
  questions: SimplifiedQuestion[];
  isRTL: boolean;
}

export function StudentPreviewDialog({ questions, isRTL }: StudentPreviewDialogProps) {
  if (questions.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Eye className="h-4 w-4" />
          {isRTL ? 'معاينة الطالب' : 'Student Preview'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            {isRTL ? 'معاينة كما يراها الطالب' : 'Preview as Student'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {questions.map((question, index) => (
            <Card key={index} className="border-2">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* Question Header */}
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      {isRTL ? `السؤال ${index + 1}` : `Question ${index + 1}`}
                    </span>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                      {question.points} {isRTL ? 'درجة' : 'pts'}
                    </span>
                  </div>

                  {/* Question Image */}
                  {question.image_url && (
                    <div className="rounded-lg overflow-hidden border">
                      <img
                        src={question.image_url}
                        alt={`Question ${index + 1}`}
                        className="w-full max-h-64 object-contain bg-muted"
                      />
                    </div>
                  )}

                  {/* Question Text */}
                  <p className="text-lg font-medium leading-relaxed">
                    {question.question_text || (isRTL ? 'نص السؤال...' : 'Question text...')}
                  </p>

                  {/* Options */}
                  <RadioGroup className="space-y-3">
                    {question.options.map((option, optIndex) => (
                      <div
                        key={optIndex}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <RadioGroupItem
                          value={optIndex.toString()}
                          id={`preview-q${index}-opt${optIndex}`}
                        />
                        <Label
                          htmlFor={`preview-q${index}-opt${optIndex}`}
                          className="flex-1 cursor-pointer"
                        >
                          {option || (isRTL ? `الخيار ${optIndex + 1}` : `Option ${optIndex + 1}`)}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Summary */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <span className="text-sm font-medium">
              {isRTL ? 'إجمالي الأسئلة:' : 'Total Questions:'} {questions.length}
            </span>
            <span className="text-sm font-medium">
              {isRTL ? 'إجمالي الدرجات:' : 'Total Points:'}{' '}
              {questions.reduce((sum, q) => sum + q.points, 0)}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
