import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, Mail, Send } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ChannelStatus } from '@/lib/templateValidation';

interface Props {
  channel: 'email' | 'telegram';
  status: ChannelStatus;
  isRTL: boolean;
  className?: string;
}

const STATUS_META: Record<
  ChannelStatus,
  { icon: typeof CheckCircle2; cls: string; en: string; ar: string }
> = {
  working: {
    icon: CheckCircle2,
    cls: 'text-emerald-600 dark:text-emerald-500',
    en: 'Working',
    ar: 'شغّال',
  },
  incomplete: {
    icon: AlertTriangle,
    cls: 'text-amber-600 dark:text-amber-500',
    en: 'Incomplete',
    ar: 'ناقص بيانات',
  },
  error: {
    icon: XCircle,
    cls: 'text-destructive',
    en: 'Error',
    ar: 'فيه خطأ',
  },
  empty: {
    icon: MinusCircle,
    cls: 'text-muted-foreground/50',
    en: 'Not configured',
    ar: 'مش متضبط',
  },
};

export function ChannelStatusIcon({ channel, status, isRTL, className }: Props) {
  const meta = STATUS_META[status];
  const StatusIcon = meta.icon;
  const ChannelIcon = channel === 'email' ? Mail : Send;
  const channelLabel = channel === 'email' ? (isRTL ? 'إيميل' : 'Email') : 'Telegram';
  const statusLabel = isRTL ? meta.ar : meta.en;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs',
              className,
            )}
            aria-label={`${channelLabel}: ${statusLabel}`}
          >
            <ChannelIcon className="h-3 w-3 text-muted-foreground" />
            <StatusIcon className={cn('h-3.5 w-3.5', meta.cls)} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <div className="font-medium">{channelLabel}</div>
            <div className={meta.cls}>{statusLabel}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
