import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';

interface SectionInfo {
  key: string;
  label: string;
  labelAr: string;
  startIndex: number;
  endIndex: number; // exclusive
}

interface PlacementExamHeaderProps {
  currentIndex: number;
  totalQuestions: number;
  answeredCount: number;
  sections: SectionInfo[];
  isRTL: boolean;
}

export function PlacementExamHeader({ currentIndex, totalQuestions, answeredCount, sections, isRTL }: PlacementExamHeaderProps) {
  const totalProgress = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  // Find current section
  const currentSection = sections.find(s => currentIndex >= s.startIndex && currentIndex < s.endIndex);
  const sectionQuestionIndex = currentSection ? currentIndex - currentSection.startIndex : 0;
  const sectionTotal = currentSection ? currentSection.endIndex - currentSection.startIndex : 0;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {/* Section indicator */}
        <div className="flex items-center gap-2 flex-wrap">
          {sections.map(s => {
            const isCurrent = currentSection?.key === s.key;
            const sectionAnswered = Array.from({ length: s.endIndex - s.startIndex }).filter((_, i) => {
              // We can't check answers here, just highlight current
              return false;
            }).length;
            return (
              <Badge
                key={s.key}
                variant={isCurrent ? 'default' : 'outline'}
                className={`text-xs px-2.5 py-1 ${isCurrent ? '' : 'opacity-60'}`}
              >
                {isRTL ? s.labelAr : s.label}
                {isCurrent && ` (${sectionQuestionIndex + 1}/${sectionTotal})`}
              </Badge>
            );
          })}
        </div>

        {/* Question counter */}
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-base px-3 py-1">
            {isRTL ? `سؤال ${currentIndex + 1} من ${totalQuestions}` : `Question ${currentIndex + 1} of ${totalQuestions}`}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {answeredCount}/{totalQuestions} {isRTL ? 'مجاب' : 'answered'}
          </span>
        </div>

        {/* Total progress */}
        <Progress value={totalProgress} className="h-2" />
      </CardContent>
    </Card>
  );
}

export type { SectionInfo };
