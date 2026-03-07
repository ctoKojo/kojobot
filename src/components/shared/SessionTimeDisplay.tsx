import { formatSessionTimeForViewer, getCairoToday } from '@/lib/timeUtils';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface SessionTimeDisplayProps {
  /** Session date in YYYY-MM-DD format. For schedule_time without a real date, pass getCairoToday(). */
  sessionDate: string;
  /** Session time in HH:MM format (Cairo local time). */
  sessionTime: string;
  /** Whether the UI is RTL (Arabic). */
  isRTL: boolean;
  /** Whether to show Cairo reference for non-Cairo users. Defaults to true. */
  showCairoReference?: boolean;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Centralized component for displaying session times with dual-timezone support.
 *
 * - Users in Egypt (Africa/Cairo): see a single time (e.g. "3:00 PM")
 * - Users outside Egypt: see local time + Cairo reference
 *   Desktop: "10:00 AM (3:00 PM Cairo)"
 *   Mobile: "10:00 AM" + second line "(3:00 PM القاهرة)"
 *
 * Note: When sessionDate is not from a real session (e.g. group schedule_time),
 * pass getCairoToday() — this is a display approximation for the current UTC offset.
 */
export function SessionTimeDisplay({
  sessionDate,
  sessionTime,
  isRTL,
  showCairoReference = true,
  className,
}: SessionTimeDisplayProps) {
  const isMobile = useIsMobile();

  if (!sessionTime) return <span className={className}>-</span>;

  // Use today's date as fallback for schedule times without a real date
  const effectiveDate = sessionDate || getCairoToday();
  const { cairoTime, localTime, showDual } = formatSessionTimeForViewer(effectiveDate, sessionTime, isRTL);

  // Single timezone (user in Cairo) or reference disabled
  if (!showDual || !showCairoReference) {
    return <span className={className}>{cairoTime}</span>;
  }

  // Dual timezone display
  const cairoLabel = isRTL ? 'القاهرة' : 'Cairo';

  if (isMobile) {
    return (
      <span className={cn('inline-flex flex-col', className)}>
        <span>{localTime}</span>
        <span className="text-muted-foreground text-xs">
          ({cairoTime} {cairoLabel})
        </span>
      </span>
    );
  }

  return (
    <span className={className}>
      {localTime}{' '}
      <span className="text-muted-foreground text-xs">
        ({cairoTime} {cairoLabel})
      </span>
    </span>
  );
}
