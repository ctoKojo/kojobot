import { type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface StatItem {
  label: string;
  value: string | number;
  icon: LucideIcon;
  gradient: string;
  onClick?: () => void;
  trend?: { value: string; positive: boolean };
}

interface StatsGridProps {
  stats: StatItem[];
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

const colsMap = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-2 lg:grid-cols-4',
  5: 'md:grid-cols-3 lg:grid-cols-5',
};

export function StatsGrid({ stats, columns = 4, className }: StatsGridProps) {
  return (
    <div className={cn('grid gap-4 grid-cols-2', colsMap[columns], className)}>
      {stats.map((stat) => (
        <Card
          key={stat.label}
          className={cn(
            'relative overflow-hidden hover:shadow-md transition-all duration-300',
            stat.onClick && 'cursor-pointer hover:-translate-y-0.5'
          )}
          onClick={stat.onClick}
        >
          <div className={cn('absolute top-0 inset-x-0 h-1 bg-gradient-to-r', stat.gradient)} />
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className={cn('p-2.5 rounded-xl bg-gradient-to-br shadow-lg flex-shrink-0', stat.gradient)}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
                <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
              </div>
              {stat.trend && (
                <span className={cn(
                  'ms-auto text-xs font-medium px-2 py-0.5 rounded-full',
                  stat.trend.positive
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                )}>
                  {stat.trend.value}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
