import { useLanguage } from '@/contexts/LanguageContext';
import { Flame } from 'lucide-react';

interface StreakCounterProps {
  currentStreak: number;
  isActive?: boolean;
}

export function StreakCounter({ currentStreak, isActive = true }: StreakCounterProps) {
  const { isRTL } = useLanguage();
  const active = isActive && currentStreak > 0;

  return (
    <div className="flex items-center gap-1.5">
      <div className={`relative ${active ? 'animate-float' : ''}`}>
        <Flame className={`h-5 w-5 ${active ? 'text-orange-500 drop-shadow-[0_0_6px_hsl(25,100%,50%/0.6)]' : 'text-muted-foreground/40'}`} />
      </div>
      <span className={`text-sm font-bold tabular-nums ${currentStreak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`}>
        {currentStreak}
      </span>
      <span className="text-xs text-muted-foreground hidden sm:inline">
        {isRTL ? 'يوم' : 'day'}
      </span>
    </div>
  );
}
