import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, ClipboardList, BookOpen, PartyPopper } from 'lucide-react';
import { KojoSheet, type KojoContextMeta } from '@/components/student/KojoSheet';
import kojobotIcon from '@/assets/kojobot-icon-optimized.webp';

export interface QuestItem {
  type: 'quiz' | 'assignment' | 'session' | 'none';
  id: string;
  title: string;
  titleAr: string;
  subtitle?: string;
  subtitleAr?: string;
  navigateTo: string;
}

interface CurrentQuestProps {
  quest: QuestItem;
}

export function CurrentQuest({ quest }: CurrentQuestProps) {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [kojoOpen, setKojoOpen] = useState(false);

  const title = language === 'ar' ? quest.titleAr : quest.title;
  const subtitle = language === 'ar' ? quest.subtitleAr : quest.subtitle;

  const getIcon = () => {
    switch (quest.type) {
      case 'quiz': return <Play className="h-6 w-6" />;
      case 'assignment': return <ClipboardList className="h-6 w-6" />;
      case 'session': return <BookOpen className="h-6 w-6" />;
      default: return <PartyPopper className="h-6 w-6" />;
    }
  };

  const getTypeLabel = () => {
    if (quest.type === 'quiz') return isRTL ? '🎯 كويز' : '🎯 Quiz';
    if (quest.type === 'assignment') return isRTL ? '📝 واجب' : '📝 Assignment';
    if (quest.type === 'session') return isRTL ? '📚 سيشن قادم' : '📚 Next Session';
    return isRTL ? '🎉 كل حاجة خلصت!' : '🎉 All clear!';
  };

  const getQuestBorderClass = () => {
    switch (quest.type) {
      case 'quiz': return 'game-quest-gold';
      case 'assignment': return 'game-quest-green';
      case 'session': return 'game-quest-blue';
      default: return '';
    }
  };

  const kojoMeta: KojoContextMeta | undefined = quest.type !== 'none'
    ? { contextType: 'quest', contextTitle: title, contextId: quest.id }
    : undefined;

  const kojoLabel = quest.type !== 'none'
    ? (isRTL ? 'اسأل Kojo' : 'Ask Kojo')
    : (isRTL ? 'اسأل Kojo يقترحلك تتدرب على إيه' : 'Ask Kojo what to practice');

  return (
    <>
      <div className={`game-card-light rounded-xl border-2 overflow-hidden ${getQuestBorderClass()}`}>
        <div className="flex flex-col sm:flex-row items-stretch">
          {/* Icon section */}
          <div className="kojo-gradient p-6 flex items-center justify-center sm:w-24 shrink-0">
            <div className="text-white animate-float">
              {getIcon()}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-4 space-y-3">
            <div>
              <Badge variant="secondary" className="text-xs mb-2">{getTypeLabel()}</Badge>
              <h3 className="font-bold text-base">{title}</h3>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>

            <div className="flex flex-wrap gap-2">
              {quest.type !== 'none' && (
                <Button
                  size="sm"
                  className="kojo-gradient font-bold hover:scale-105 transition-transform shadow-lg"
                  onClick={() => navigate(quest.navigateTo)}
                >
                  <Play className="h-4 w-4 mr-1" />
                  {isRTL ? 'يلا!' : 'Go!'}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setKojoOpen(true)}
                className="gap-1.5"
              >
                <img src={kojobotIcon} alt="Kojo" className="h-4 w-4 rounded-full" />
                {kojoLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <KojoSheet open={kojoOpen} onOpenChange={setKojoOpen} contextMeta={kojoMeta} />
    </>
  );
}
