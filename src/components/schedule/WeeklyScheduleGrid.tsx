import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/contexts/LanguageContext';
import { SessionTimeDisplay } from '@/components/shared/SessionTimeDisplay';
import { getCairoToday } from '@/lib/timeUtils';
import { cn } from '@/lib/utils';

interface InstructorSchedule {
  id: string;
  instructor_id: string;
  day_of_week: string;
  is_working_day: boolean;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  notes_ar: string | null;
}

interface Group {
  id: string;
  name: string;
  name_ar: string;
  schedule_day: string;
  schedule_time: string;
  duration_minutes: number;
}

interface WeeklyScheduleGridProps {
  schedules: InstructorSchedule[];
  groups: Group[];
  loading: boolean;
  isAdmin: boolean;
  onEditDay: (dayOfWeek: string) => void;
  showGroups?: boolean;
}

const DAYS_OF_WEEK = [
  { en: 'Sunday', ar: 'الأحد' },
  { en: 'Monday', ar: 'الإثنين' },
  { en: 'Tuesday', ar: 'الثلاثاء' },
  { en: 'Wednesday', ar: 'الأربعاء' },
  { en: 'Thursday', ar: 'الخميس' },
  { en: 'Friday', ar: 'الجمعة' },
  { en: 'Saturday', ar: 'السبت' },
];

const GROUP_COLORS = [
  'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800',
  'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800',
];

export function WeeklyScheduleGrid({
  schedules,
  groups,
  loading,
  isAdmin,
  onEditDay,
  showGroups = true,
}: WeeklyScheduleGridProps) {
  const { isRTL, language } = useLanguage();

  const getScheduleForDay = (dayEn: string) => {
    return schedules.find(s => s.day_of_week === dayEn);
  };

  const getGroupsForDay = (dayEn: string) => {
    return groups.filter(g => g.schedule_day === dayEn);
  };

  // Keep formatTime for working hours display (non-session context)
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const getGroupColor = (index: number) => {
    return GROUP_COLORS[index % GROUP_COLORS.length];
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
      {DAYS_OF_WEEK.map((day, dayIndex) => {
        const schedule = getScheduleForDay(day.en);
        const dayGroups = getGroupsForDay(day.en);
        const isWorkingDay = schedule?.is_working_day ?? true;
        const isDayOff = !isWorkingDay;

        return (
          <Card
            key={day.en}
            className={cn(
              'transition-all',
              isDayOff && 'bg-muted/50',
              isAdmin && 'cursor-pointer hover:shadow-md hover:border-primary/50'
            )}
            onClick={() => isAdmin && onEditDay(day.en)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>{language === 'ar' ? day.ar : day.en}</span>
                {isDayOff && (
                  <Badge variant="secondary" className="text-xs">
                    {isRTL ? 'إجازة' : 'Off'}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isDayOff ? (
                <div className="h-20 flex items-center justify-center">
                  <p className="text-muted-foreground text-sm text-center">
                    {isRTL ? 'يوم إجازة' : 'Day Off'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Working Hours */}
                  {schedule?.start_time && schedule?.end_time && (
                    <div className={cn(
                      "text-xs text-muted-foreground pb-2",
                      showGroups && "border-b"
                    )}>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-primary/60" />
                        {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                      </div>
                    </div>
                  )}

                  {/* No schedule set message for reception */}
                  {!showGroups && !schedule?.start_time && !schedule?.end_time && (
                    <div className="h-16 flex items-center justify-center">
                      <p className="text-muted-foreground text-xs text-center">
                        {isRTL ? 'لم تُحدد ساعات العمل' : 'No hours set'}
                      </p>
                    </div>
                  )}

                  {/* Groups - only for instructors */}
                  {showGroups && (
                    <>
                      {dayGroups.length > 0 ? (
                        <div className="space-y-2">
                          {dayGroups.map((group, groupIndex) => (
                            <div
                              key={group.id}
                              className={cn(
                                'p-2 rounded-md border text-xs',
                                getGroupColor(groupIndex)
                              )}
                            >
                              <p className="font-medium truncate">
                                {language === 'ar' ? group.name_ar : group.name}
                              </p>
                              <p className="opacity-75 flex items-center gap-1">
                                <SessionTimeDisplay sessionDate={getCairoToday()} sessionTime={group.schedule_time} isRTL={isRTL} /> ({group.duration_minutes}{isRTL ? 'د' : 'm'})
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-16 flex items-center justify-center">
                          <p className="text-muted-foreground text-xs text-center">
                            {isRTL ? 'لا توجد مجموعات' : 'No groups'}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Notes */}
                  {schedule?.notes && (
                    <p className="text-xs text-muted-foreground pt-2 border-t truncate">
                      {language === 'ar' && schedule.notes_ar ? schedule.notes_ar : schedule.notes}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
