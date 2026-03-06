import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  gradient?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  gradient = 'from-primary to-secondary',
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-4', className)}>
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <div className={cn('p-2.5 rounded-xl bg-gradient-to-br shadow-lg', gradient)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1 ms-[52px]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
