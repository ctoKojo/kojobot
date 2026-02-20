import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Lock, Unlock, Plus, BookOpen } from 'lucide-react';

interface OverviewItem {
  age_group_id: string;
  level_id: string;
  latest_version: number;
  is_published: boolean;
  published_at: string | null;
  total_sessions: number;
  expected_sessions_count: number;
  filled_sessions: number;
  completion_percentage: number;
}

interface AgeGroup {
  id: string;
  name: string;
  name_ar: string;
}

interface Level {
  id: string;
  name: string;
  name_ar: string;
  expected_sessions_count?: number;
}

interface Props {
  ageGroups: AgeGroup[];
  levels: Level[];
  overviewData: OverviewItem[];
  onSelect: (ageGroupId: string, levelId: string) => void;
  onCreateEmpty: (ageGroupId: string, levelId: string, expectedCount: number) => void;
}

export function CurriculumOverviewGrid({ ageGroups, levels, overviewData, onSelect, onCreateEmpty }: Props) {
  const { isRTL } = useLanguage();

  const getOverview = (agId: string, lvId: string) =>
    overviewData.find(o => o.age_group_id === agId && o.level_id === lvId);

  return (
    <div className="space-y-6">
      {ageGroups.map(ag => (
        <div key={ag.id} className="space-y-3">
          <h3 className="text-lg font-semibold">{isRTL ? ag.name_ar : ag.name}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {levels.map(lv => {
              const overview = getOverview(ag.id, lv.id);
              const expectedCount = (lv as any).expected_sessions_count ?? 12;

              if (!overview) {
                return (
                  <Card key={lv.id} className="border-dashed opacity-60 hover:opacity-100 transition-opacity">
                    <CardContent className="p-4 flex flex-col items-center justify-center min-h-[120px] gap-2">
                      <BookOpen className="h-6 w-6 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">{isRTL ? lv.name_ar : lv.name}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onCreateEmpty(ag.id, lv.id, expectedCount)}
                      >
                        <Plus className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                        {isRTL ? 'إنشاء' : 'Create'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <Card
                  key={lv.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => onSelect(ag.id, lv.id)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{isRTL ? lv.name_ar : lv.name}</span>
                      {overview.is_published ? (
                        <Badge variant="default" className="text-xs gap-1">
                          <Lock className="h-3 w-3" />
                          {isRTL ? 'منشور' : 'Published'}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Unlock className="h-3 w-3" />
                          {isRTL ? 'مسودة' : 'Draft'}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>v{overview.latest_version}</span>
                        <span>{overview.filled_sessions}/{overview.expected_sessions_count}</span>
                      </div>
                      <Progress value={overview.completion_percentage} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
