import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StarRatingProps {
  value: number | undefined;
  maxScore: number;
  onChange: (value: number) => void;
  labels?: Array<{ value: number; label: string }>;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export function StarRating({ value, maxScore, onChange, labels, size = 'md', disabled }: StarRatingProps) {
  const starSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const gap = size === 'sm' ? 'gap-0.5' : 'gap-1';

  return (
    <div className={cn('flex items-center', gap)}>
      {Array.from({ length: maxScore }, (_, i) => {
        const starValue = i + 1;
        const filled = value !== undefined && starValue <= value;
        const label = labels?.find(l => l.value === starValue)?.label;

        const star = (
          <button
            key={starValue}
            type="button"
            disabled={disabled}
            onClick={() => onChange(value === starValue ? 0 : starValue)}
            className={cn(
              'transition-all duration-150 rounded-sm p-0.5',
              'focus:outline-none focus:ring-1 focus:ring-ring',
              'hover:scale-125',
              disabled && 'cursor-default hover:scale-100',
            )}
          >
            <Star
              className={cn(
                starSize,
                'transition-colors',
                filled
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-transparent text-muted-foreground/40 hover:text-amber-300',
              )}
            />
          </button>
        );

        if (label) {
          return (
            <TooltipProvider key={starValue} delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>{star}</TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {starValue} — {label}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }

        return star;
      })}
    </div>
  );
}
