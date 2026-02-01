import { cn } from '@/lib/utils';
import kojobotIcon from '@/assets/kojobot-icon.png';

interface KojobotLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
}

const sizeConfig = {
  sm: { classes: 'w-8 h-8', width: 32, height: 32 },
  md: { classes: 'w-10 h-10', width: 40, height: 40 },
  lg: { classes: 'w-14 h-14', width: 56, height: 56 },
  xl: { classes: 'w-20 h-20', width: 80, height: 80 },
};

const textSizeClasses = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl',
};

export function KojobotLogo({ size = 'md', className, showText = true }: KojobotLogoProps) {
  const config = sizeConfig[size];
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Logo Icon */}
      <img 
        src={kojobotIcon} 
        alt="Kojobot" 
        width={config.width}
        height={config.height}
        className={cn('rounded-xl shadow-md object-contain', config.classes)}
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
