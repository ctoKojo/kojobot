import { useLanguage } from '@/contexts/LanguageContext';
import { Progress } from '@/components/ui/progress';
import { Zap } from 'lucide-react';

interface XpBarProps {
  currentXp: number;
  nextLevelXp: number;
  level: number;
}

export function XpBar({ currentXp, nextLevelXp, level }: XpBarProps) {
  const { isRTL } = useLanguage();
  const progress = nextLevelXp > 0 ? Math.min((currentXp / nextLevelXp) * 100, 100) : 0;

  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <div className="flex items-center gap-1 shrink-0">
        <div className="h-8 w-8 rounded-full kojo-gradient flex items-center justify-center">
          <span className="text-xs font-bold text-white">{level}</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            <Zap className="h-3.5 w-3.5 text-yellow-500" />
            <span className="text-xs font-semibold tabular-nums">{currentXp} XP</span>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">{nextLevelXp} XP</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
    </div>
  );
}
