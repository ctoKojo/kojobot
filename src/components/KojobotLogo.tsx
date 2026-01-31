import { cn } from '@/lib/utils';

interface KojobotLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

const textSizeClasses = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
};

export function KojobotLogo({ size = 'md', className, showText = true }: KojobotLogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Logo Icon - Robot with gradient */}
      <div className={cn(
        'relative rounded-xl kojo-gradient flex items-center justify-center shadow-lg',
        sizeClasses[size]
      )}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-2/3 h-2/3 text-white"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Robot head */}
          <rect x="5" y="6" width="14" height="12" rx="2" />
          {/* Eyes */}
          <circle cx="9" cy="11" r="1.5" fill="currentColor" />
          <circle cx="15" cy="11" r="1.5" fill="currentColor" />
          {/* Mouth */}
          <path d="M9 15h6" />
          {/* Antenna */}
          <line x1="12" y1="6" x2="12" y2="3" />
          <circle cx="12" cy="2" r="1" fill="currentColor" />
          {/* Ears */}
          <rect x="3" y="9" width="2" height="4" rx="1" />
          <rect x="19" y="9" width="2" height="4" rx="1" />
        </svg>
      </div>
      
      {/* Logo Text */}
      {showText && (
        <span className={cn(
          'font-bold kojo-gradient-text',
          textSizeClasses[size]
        )}>
          Kojobot
        </span>
      )}
    </div>
  );
}
