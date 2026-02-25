import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Medal } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { LeaderboardEntry } from '@/lib/leaderboardService';

interface LeaderboardPodiumProps {
  entries: LeaderboardEntry[];
}

export function LeaderboardPodium({ entries }: LeaderboardPodiumProps) {
  const { language, t } = useLanguage();
  const top3 = entries.filter(e => e.rank <= 3).slice(0, 3);
  if (top3.length < 3) return null;

  const getName = (e: LeaderboardEntry) =>
    language === 'ar' ? e.student_name_ar : e.student_name;

  const getInitials = (e: LeaderboardEntry) => {
    const name = getName(e);
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  };

  const podiumConfig = [
    { entry: top3.find(e => e.rank === 2), icon: <Medal className="h-6 w-6 text-muted-foreground" />, size: 'h-14 w-14', order: 'order-1' },
    { entry: top3.find(e => e.rank === 1), icon: <Trophy className="h-7 w-7 text-primary" />, size: 'h-16 w-16', order: 'order-0 sm:-mt-4' },
    { entry: top3.find(e => e.rank === 3), icon: <Medal className="h-6 w-6 text-accent-foreground" />, size: 'h-14 w-14', order: 'order-2' },
  ];

  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4 text-center">{t.evaluation.topPerformers}</h3>
      <div className="flex items-end justify-center gap-6 sm:gap-10">
        {podiumConfig.map((item, idx) => {
          if (!item.entry) return null;
          const e = item.entry;
          return (
            <div key={e.student_id} className={`flex flex-col items-center gap-2 ${item.order}`}>
              {item.icon}
              <Avatar className={item.size}>
                <AvatarImage src={e.avatar_url || undefined} />
                <AvatarFallback className="text-xs">{getInitials(e)}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-semibold text-center max-w-[100px] truncate">{getName(e)}</span>
              <span className="text-lg font-bold text-primary">{e.percentage}%</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
