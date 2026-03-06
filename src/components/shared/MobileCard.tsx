import { cn } from '@/lib/utils';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MobileCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export function MobileCard({ children, onClick, actions, className }: MobileCardProps) {
  return (
    <div
      className={cn(
        'p-4 rounded-xl border bg-card hover:shadow-md transition-all duration-200',
        onClick && 'cursor-pointer hover:-translate-y-0.5',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">{children}</div>
        {actions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">{actions}</DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
