import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { Target } from 'lucide-react';
import { getStudentProgressStatusLabel, getStudentOutcomeLabel } from '@/lib/constants';
import type { LifecycleStatus, LifecycleOutcome, GradeInfo } from '@/hooks/useStudentLifecycle';

interface CurrentLevelStatusProps {
  levelName: string;
  status: LifecycleStatus;
  outcome: LifecycleOutcome;
  grade: GradeInfo | null;
}

export function CurrentLevelStatus({ levelName, status, outcome, grade }: CurrentLevelStatusProps) {
  const { isRTL } = useLanguage();

  if (status === 'unknown') return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" />
          {isRTL ? 'حالة المستوى الحالي' : 'Current Level Status'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 items-center">
          <Badge variant="outline">{levelName}</Badge>
          <Badge variant="secondary" className="text-xs">
            {getStudentProgressStatusLabel(status, isRTL)}
          </Badge>
          {outcome && (
            <Badge variant={outcome === 'passed' ? 'default' : 'destructive'} className="text-xs">
              {getStudentOutcomeLabel(outcome, isRTL)}
            </Badge>
          )}
          {grade && grade.percentage != null && (
            <span className="text-sm font-bold">{Math.round(grade.percentage)}%</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
