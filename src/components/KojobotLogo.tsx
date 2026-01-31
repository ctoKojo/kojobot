import { cn } from '@/lib/utils';
import kojobotIcon from '@/assets/kojobot-icon.png';

interface KojobotLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
};

const textSizeClasses = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl',
};

export function KojobotLogo({ size = 'md', className, showText = true }: KojobotLogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Logo Icon */}
      <img 
        src={kojobotIcon} 
        alt="Kojobot" 
        className={cn('rounded-xl shadow-md object-contain', sizeClasses[size])}
      />
      
      {/* Logo Text */}
      {showText && (
        <span className={cn(
          'font-bold bg-gradient-to-r from-[#61BAE2] to-[#6455F0] bg-clip-text text-transparent',
          textSizeClasses[size]
        )}>
          Kojobot
        </span>
      )}
    </div>
  );
}
