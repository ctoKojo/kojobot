import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Zap, Flame, Trophy, Star, Shield, Swords, Compass, Baby } from 'lucide-react';

interface LevelXp {
  level_id: string;
  level_name: string;
  level_name_ar: string;
  total_xp: number;
  rank_name: string;
  rank_progress: number;
  attendance_xp: number;
  evaluation_xp: number;
  quiz_xp: number;
  assignment_xp: number;
  completion_xp: number;
}

const RANK_CONFIG: Record<string, { icon: typeof Trophy; color: string; label_ar: string }> = {
  Rookie: { icon: Baby, color: 'text-zinc-500', label_ar: 'مبتدئ' },
  Explorer: { icon: Compass, color: 'text-blue-500', label_ar: 'مستكشف' },
  Warrior: { icon: Swords, color: 'text-orange-500', label_ar: 'محارب' },
  Champion: { icon: Shield, color: 'text-purple-500', label_ar: 'بطل' },
  Legend: { icon: Trophy, color: 'text-yellow-500', label_ar: 'أسطورة' },
};

const RANK_THRESHOLDS = [
  { name: 'Rookie', min: 0, max: 199 },
  { name: 'Explorer', min: 200, max: 499 },
  { name: 'Warrior', min: 500, max: 899 },
  { name: 'Champion', min: 900, max: 1399 },
  { name: 'Legend', min: 1400, max: Infinity },
];

export function StudentXpCard({ studentId, currentLevelId }: { studentId: string; currentLevelId?: string }) {
  const { isRTL, language } = useLanguage();
  const [data, setData] = useState<LevelXp[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    
    Promise.all([
      supabase.rpc('get_student_level_xp', { p_student_id: studentId }),
      supabase.from('student_streaks').select('current_streak').eq('student_id', studentId).maybeSingle(),
    ]).then(([xpRes, streakRes]) => {
      setData((xpRes.data as any[]) || []);
      setStreak(streakRes.data?.current_streak || 0);
      setLoading(false);
    });
  }, [studentId]);

  if (loading) return null;

  // Find XP for current level, or use highest
  const currentXp = data.find(d => d.level_id === currentLevelId) || data[0];
  if (!currentXp) {
    return (
      <Card className="relative overflow-hidden border-0 shadow-md">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 opacity-[0.08] dark:opacity-[0.15]" />
        <CardContent className="relative py-6 text-center">
          <Zap className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'لم تكتسب أي XP بعد — ابدأ بحضور السيشنات!' : 'No XP earned yet — start attending sessions!'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const rankCfg = RANK_CONFIG[currentXp.rank_name] || RANK_CONFIG.Rookie;
  const RankIcon = rankCfg.icon;
  const nextRank = RANK_THRESHOLDS.find(r => r.min > currentXp.total_xp);

  return (
    <Card className="relative overflow-hidden border-0 shadow-md">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 opacity-[0.08] dark:opacity-[0.15]" />
      <div className={`absolute top-0 ${isRTL ? 'left-0' : 'right-0'} w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 opacity-[0.12] dark:opacity-[0.2] rounded-full -translate-y-8 ${isRTL ? '-translate-x-8' : 'translate-x-8'}`} />
      
      <CardHeader className="relative pb-2 p-4 sm:p-5 sm:pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm">
              <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <CardTitle className="text-base sm:text-lg">
              {isRTL ? 'نقاط الخبرة' : 'XP Progress'}
            </CardTitle>
          </div>
          {streak > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Flame className="h-3 w-3 text-orange-500" />
              {streak} {isRTL ? 'يوم' : 'day'}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative p-4 sm:p-5 pt-1 sm:pt-1 space-y-3">
        {/* Level name */}
        <p className="text-xs text-muted-foreground">
          {language === 'ar' ? currentXp.level_name_ar : currentXp.level_name}
        </p>

        {/* Rank + XP */}
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full bg-muted ${rankCfg.color}`}>
            <RankIcon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm sm:text-base">
                {isRTL ? rankCfg.label_ar : currentXp.rank_name}
              </span>
              <span className="text-sm font-semibold text-primary">
                {currentXp.total_xp} XP
              </span>
            </div>
            <Progress value={currentXp.rank_progress} className="h-2 mt-1" />
            {nextRank && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {isRTL 
                  ? `${nextRank.min - Number(currentXp.total_xp)} XP للرتبة القادمة`
                  : `${nextRank.min - Number(currentXp.total_xp)} XP to next rank`}
              </p>
            )}
          </div>
        </div>

        {/* XP breakdown mini */}
        <div className="grid grid-cols-5 gap-1 text-center">
          {[
            { label: isRTL ? 'حضور' : 'Attend', val: currentXp.attendance_xp, emoji: '📋' },
            { label: isRTL ? 'تقييم' : 'Eval', val: currentXp.evaluation_xp, emoji: '⭐' },
            { label: isRTL ? 'كويز' : 'Quiz', val: currentXp.quiz_xp, emoji: '📝' },
            { label: isRTL ? 'واجب' : 'HW', val: currentXp.assignment_xp, emoji: '📚' },
            { label: isRTL ? 'مستوى' : 'Level', val: currentXp.completion_xp, emoji: '🏆' },
          ].map(item => (
            <div key={item.label} className="rounded-lg bg-muted/50 py-1.5 px-1">
              <div className="text-xs">{item.emoji}</div>
              <div className="text-xs font-bold">{item.val}</div>
              <div className="text-[9px] text-muted-foreground truncate">{item.label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Full XP breakdown table for StudentProfile */
export function StudentXpBreakdown({ studentId }: { studentId: string }) {
  const { isRTL, language } = useLanguage();
  const [data, setData] = useState<LevelXp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc('get_student_level_xp', { p_student_id: studentId })
      .then(({ data: d }) => {
        setData((d as any[]) || []);
        setLoading(false);
      });
  }, [studentId]);

  if (loading) return <p className="text-sm text-muted-foreground p-4">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>;
  if (data.length === 0) return <p className="text-sm text-muted-foreground p-4">{isRTL ? 'لا توجد بيانات XP' : 'No XP data'}</p>;

  return (
    <div className="space-y-3">
      {data.map(level => {
        const cfg = RANK_CONFIG[level.rank_name] || RANK_CONFIG.Rookie;
        const Icon = cfg.icon;
        return (
          <Card key={level.level_id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <Icon className={`h-5 w-5 ${cfg.color}`} />
                <div className="flex-1">
                  <span className="font-semibold text-sm">
                    {language === 'ar' ? level.level_name_ar : level.level_name}
                  </span>
                  <Badge variant="secondary" className="ms-2 text-xs">
                    {isRTL ? cfg.label_ar : level.rank_name}
                  </Badge>
                </div>
                <span className="font-bold text-primary">{level.total_xp} XP</span>
              </div>
              <Progress value={level.rank_progress} className="h-1.5 mb-2" />
              <div className="grid grid-cols-5 gap-2 text-xs text-center">
                <div><span className="text-muted-foreground">{isRTL ? 'حضور' : 'Attend'}</span><br/><strong>{level.attendance_xp}</strong></div>
                <div><span className="text-muted-foreground">{isRTL ? 'تقييم' : 'Eval'}</span><br/><strong>{level.evaluation_xp}</strong></div>
                <div><span className="text-muted-foreground">{isRTL ? 'كويز' : 'Quiz'}</span><br/><strong>{level.quiz_xp}</strong></div>
                <div><span className="text-muted-foreground">{isRTL ? 'واجب' : 'HW'}</span><br/><strong>{level.assignment_xp}</strong></div>
                <div><span className="text-muted-foreground">{isRTL ? 'مستوى' : 'Level'}</span><br/><strong>{level.completion_xp}</strong></div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
