import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';

interface PlacementExamHeaderProps {
  currentIndex: number;
  totalQuestions: number;
  answeredCount: number;
  isRTL: boolean;
}

export function PlacementExamHeader({ currentIndex, totalQuestions, answeredCount, isRTL }: PlacementExamHeaderProps) {
  const progress = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <Badge variant="secondary" className="text-base px-3 py-1">
            {isRTL ? `سؤال ${currentIndex + 1} من ${totalQuestions}` : `Question ${currentIndex + 1} of ${totalQuestions}`}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {answeredCount}/{totalQuestions} {isRTL ? 'مجاب' : 'answered'}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </CardContent>
    </Card>
  );
}
