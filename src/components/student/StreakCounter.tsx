import { useLanguage } from '@/contexts/LanguageContext';
import { Flame } from 'lucide-react';

interface StreakCounterProps {
  currentStreak: number;
  isActive?: boolean;
}

export function StreakCounter({ currentStreak, isActive = true }: StreakCounterProps) {
  const { isRTL } = useLanguage();

  return (
    <div className="flex items-center gap-1.5">
      <Flame className={`h-5 w-5 ${isActive && currentStreak > 0 ? 'text-orange-500' : 'text-muted-foreground/40'}`} />
      <span className={`text-sm font-bold tabular-nums ${currentStreak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`}>
        {currentStreak}
      </span>
      <span className="text-xs text-muted-foreground hidden sm:inline">
        {isRTL ? 'يوم' : 'day'}
      </span>
    </div>
  );
}
