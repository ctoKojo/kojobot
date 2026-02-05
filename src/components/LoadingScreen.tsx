import { useLanguage } from '@/contexts/LanguageContext';
import kojobotIcon from '@/assets/kojobot-icon.png';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  const { t } = useLanguage();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
      <div className="text-center space-y-8">
        {/* Animated Logo Container */}
        <div className="relative">
          {/* Outer rotating ring */}
          <div className="absolute inset-0 -m-4">
            <div className="w-32 h-32 mx-auto rounded-full border-4 border-transparent border-t-primary/60 border-r-primary/30 animate-spin" 
                 style={{ animationDuration: '1.5s' }} />
          </div>
          
          {/* Middle pulsing ring */}
          <div className="absolute inset-0 -m-2">
            <div className="w-28 h-28 mx-auto rounded-full bg-primary/10 animate-pulse" />
          </div>
          
          {/* Logo with bounce animation */}
          <div className="relative z-10 animate-bounce" style={{ animationDuration: '2s' }}>
            <img 
              src={kojobotIcon} 
              alt="Kojobot" 
              className="w-24 h-24 mx-auto rounded-2xl shadow-2xl shadow-primary/20"
            />
          </div>
          
          {/* Decorative dots */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }} />
            <span className="w-2 h-2 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: '150ms', animationDuration: '1s' }} />
            <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '300ms', animationDuration: '1s' }} />
          </div>
        </div>
        
        {/* Loading text with shimmer effect */}
        <div className="space-y-3 pt-4">
          <div className="relative overflow-hidden">
            <p className="text-lg font-medium text-foreground">
              {message || t.common.loading}
            </p>
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>
          
          {/* Progress bar */}
          <div className="w-48 h-1.5 mx-auto bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary rounded-full animate-progress" />
          </div>
        </div>
      </div>
    </div>
  );
}
