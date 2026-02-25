import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Medal } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { LeaderboardEntry, LeaderboardScope } from '@/lib/leaderboardService';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  scope: LeaderboardScope;
}

export function LeaderboardTable({ entries, scope }: LeaderboardTableProps) {
  const { language, t } = useLanguage();
  const showGroupLevel = ['all', 'level', 'age_group', 'level_age_group'].includes(scope);

  const getName = (e: LeaderboardEntry) =>
    language === 'ar' ? e.student_name_ar : e.student_name;

  const getInitials = (e: LeaderboardEntry) => {
    const name = getName(e);
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  };

  const getGrade = (pct: number) => {
    if (pct >= 90) return { label: 'A', color: 'bg-primary text-primary-foreground' };
    if (pct >= 80) return { label: 'B', color: 'bg-secondary text-secondary-foreground' };
    if (pct >= 70) return { label: 'C', color: 'bg-muted text-muted-foreground' };
    return { label: 'D', color: 'bg-destructive text-destructive-foreground' };
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-primary" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-muted-foreground" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-accent-foreground" />;
    return <span className="text-sm font-medium text-muted-foreground">{rank}</span>;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[60px] text-center">{t.evaluation.rank}</TableHead>
          <TableHead>{t.evaluation.student}</TableHead>
          {showGroupLevel && <TableHead>{t.evaluation.group}</TableHead>}
          <TableHead className="text-center">{t.evaluation.points}</TableHead>
          <TableHead className="text-center">%</TableHead>
          <TableHead className="text-center">{t.evaluation.sessionsCount}</TableHead>
          <TableHead className="text-center">{t.evaluation.gap}</TableHead>
          <TableHead className="text-center">{t.evaluation.grade}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry, idx) => {
          const grade = getGrade(entry.percentage);
          const gap = idx > 0 ? entry.percentage - entries[idx - 1].percentage : 0;
          const groupLabel = language === 'ar' ? entry.group_name_ar : entry.group_name;
          const levelLabel = language === 'ar' ? entry.level_name_ar : entry.level_name;

          return (
            <TableRow key={entry.student_id} className={entry.rank <= 3 ? 'bg-muted/30' : ''}>
              <TableCell className="text-center">
                <div className="flex justify-center">{getRankIcon(entry.rank)}</div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={entry.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">{getInitials(entry)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{getName(entry)}</span>
                </div>
              </TableCell>
              {showGroupLevel && (
                <TableCell className="text-sm text-muted-foreground">
                  {groupLabel}{levelLabel ? ` · ${levelLabel}` : ''}
                </TableCell>
              )}
              <TableCell className="text-center font-semibold">
                {entry.sum_total_score}/{entry.sum_max_total_score}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline">{entry.percentage}%</Badge>
              </TableCell>
              <TableCell className="text-center text-sm text-muted-foreground">
                {entry.sessions_count}
              </TableCell>
              <TableCell className="text-center text-sm text-muted-foreground">
                {gap !== 0 ? gap.toFixed(1) : '—'}
              </TableCell>
              <TableCell className="text-center">
                <Badge className={grade.color}>{grade.label}</Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
