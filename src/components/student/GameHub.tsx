import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map, Swords, Shield, Trophy, Calendar, GraduationCap, Snowflake } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LevelPassedBanner } from '@/components/student/LevelPassedBanner';
import { XpBar } from '@/components/student/XpBar';
import { StreakCounter } from '@/components/student/StreakCounter';
import { LevelMap } from '@/components/student/LevelMap';
import { CurrentQuest, type QuestItem } from '@/components/student/CurrentQuest';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { formatDate, formatTime12Hour } from '@/lib/timeUtils';

interface AchievementData {
  id: string;
  key: string;
  title: string;
  title_ar: string;
  icon_name: string;
  xp_reward: number;
  earned: boolean;
}

interface GameHubData {
  profile: any;
  groupInfo: any;
  groupId: string | null;
  levelId: string | null;
  ageGroupId: string | null;
  attendedSessionNumbers: Set<number>;
  totalSessions: number;
  quest: QuestItem;
  warnings: number;
  subscription: any;
  isFrozen: boolean;
  totalXp: number;
  streak: { current: number; longest: number };
  achievements: AchievementData[];
}

export function GameHub() {
  const { user } = useAuth();
  const { isRTL, language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GameHubData | null>(null);

  useEffect(() => {
    if (user) fetchGameData();
  }, [user]);

  const fetchGameData = async () => {
    try {
      // Parallel fetches
      const [profileRes, groupRes, warningsRes, subRes, xpRes, streakRes, allAchievementsRes, earnedAchievementsRes] = await Promise.all([
        supabase.from('profiles').select('*, age_groups(name, name_ar), levels(name, name_ar)').eq('user_id', user!.id).single(),
        supabase.from('group_students').select('group_id, groups(id, name, name_ar, schedule_day, schedule_time, instructor_id, attendance_mode, session_link, status, level_id, age_group_id)').eq('student_id', user!.id).eq('is_active', true).maybeSingle(),
        supabase.from('warnings').select('id', { count: 'exact', head: true }).eq('student_id', user!.id).eq('is_active', true),
        supabase.from('subscriptions').select('*').eq('student_id', user!.id).eq('status', 'active').maybeSingle(),
        supabase.from('student_xp_events').select('xp_amount').eq('student_id', user!.id),
        supabase.from('student_streaks').select('*').eq('student_id', user!.id).maybeSingle(),
        supabase.from('achievements').select('*').eq('is_active', true),
        supabase.from('student_achievements').select('achievement_id').eq('student_id', user!.id),
      ]);

      const profile = profileRes.data;
      const groupStudent = groupRes.data;
      const group = groupStudent?.groups as any;
      const groupId = groupStudent?.group_id || null;
      const levelId = group?.level_id || null;
      const ageGroupId = group?.age_group_id || null;
      const isFrozen = group?.status === 'frozen';

      // Fetch attended sessions
      let attendedSessionNumbers = new Set<number>();
      let totalSessions = 12;

      if (groupId) {
        const [presentRes, compensatedRes] = await Promise.all([
          supabase
            .from('attendance')
            .select('session_id, sessions!inner(session_number, group_id)')
            .eq('student_id', user!.id)
            .eq('sessions.group_id', groupId)
            .in('status', ['present', 'late']),
          supabase
            .from('attendance')
            .select('session_id, sessions!inner(session_number, group_id)')
            .eq('student_id', user!.id)
            .eq('sessions.group_id', groupId)
            .eq('compensation_status', 'compensated'),
        ]);

        presentRes.data?.forEach((a: any) => {
          if (a.sessions?.session_number) attendedSessionNumbers.add(a.sessions.session_number);
        });
        compensatedRes.data?.forEach((a: any) => {
          if (a.sessions?.session_number) attendedSessionNumbers.add(a.sessions.session_number);
        });
      }

      // Build quest - find next actionable task
      let quest: QuestItem = {
        type: 'none',
        id: '',
        title: 'All tasks completed!',
        titleAr: 'كل المهام خلصت! 🎉',
        navigateTo: '',
      };

      if (groupId) {
        const quizFilter = `student_id.eq.${user!.id},group_id.eq.${groupId}`;

        // Pending quizzes
        const { data: quizAssignments } = await supabase
          .from('quiz_assignments')
          .select('*, quizzes(title, title_ar, duration_minutes)')
          .eq('is_active', true)
          .eq('is_auto_generated', false)
          .or(quizFilter)
          .limit(1);

        const { data: completedQuizzes } = await supabase
          .from('quiz_submissions')
          .select('quiz_assignment_id')
          .eq('student_id', user!.id);

        const completedIds = new Set(completedQuizzes?.map(q => q.quiz_assignment_id) || []);
        const pendingQuiz = quizAssignments?.find(q => !completedIds.has(q.id));

        if (pendingQuiz) {
          quest = {
            type: 'quiz',
            id: pendingQuiz.id,
            title: pendingQuiz.quizzes?.title || 'Quiz',
            titleAr: pendingQuiz.quizzes?.title_ar || 'كويز',
            subtitle: `${pendingQuiz.quizzes?.duration_minutes || 0} min`,
            subtitleAr: `${pendingQuiz.quizzes?.duration_minutes || 0} دقيقة`,
            navigateTo: `/quiz/${pendingQuiz.id}`,
          };
        } else {
          // Pending assignments
          const { data: assignments } = await supabase
            .from('assignments')
            .select('*')
            .eq('is_active', true)
            .eq('is_auto_generated', false)
            .or(quizFilter)
            .gte('due_date', new Date().toISOString())
            .limit(1);

          const { data: submitted } = await supabase
            .from('assignment_submissions')
            .select('assignment_id')
            .eq('student_id', user!.id);

          const submittedIds = new Set(submitted?.map(s => s.assignment_id) || []);
          const pendingAssignment = assignments?.find(a => !submittedIds.has(a.id));

          if (pendingAssignment) {
            quest = {
              type: 'assignment',
              id: pendingAssignment.id,
              title: pendingAssignment.title,
              titleAr: pendingAssignment.title_ar,
              subtitle: `Due: ${formatDate(pendingAssignment.due_date)}`,
              subtitleAr: `الموعد: ${formatDate(pendingAssignment.due_date)}`,
              navigateTo: `/assignment/${pendingAssignment.id}`,
            };
          } else {
            // Next session
            const today = new Date().toISOString().split('T')[0];
            const { data: sessions } = await supabase
              .from('sessions')
              .select('*, groups(name, name_ar)')
              .eq('group_id', groupId)
              .gte('session_date', today)
              .eq('status', 'scheduled')
              .order('session_date')
              .limit(1);

            if (sessions?.[0]) {
              const s = sessions[0];
              quest = {
                type: 'session',
                id: s.id,
                title: `Session ${s.session_number}`,
                titleAr: `سيشن ${s.session_number}`,
                subtitle: `${s.session_date} • ${formatTime12Hour(s.session_time, false)}`,
                subtitleAr: `${s.session_date} • ${formatTime12Hour(s.session_time, true)}`,
                navigateTo: '/my-sessions',
              };
            }
          }
        }
      }

      // Process XP
      const totalXp = (xpRes.data || []).reduce((sum: number, e: any) => sum + (e.xp_amount || 0), 0);

      // Process streak
      const streakData = streakRes.data;
      const streak = {
        current: streakData?.current_streak || 0,
        longest: streakData?.longest_streak || 0,
      };

      // Process achievements
      const earnedIds = new Set((earnedAchievementsRes.data || []).map((ea: any) => ea.achievement_id));
      const achievements: AchievementData[] = (allAchievementsRes.data || []).map((a: any) => ({
        id: a.id,
        key: a.key,
        title: a.title,
        title_ar: a.title_ar,
        icon_name: a.icon_name,
        xp_reward: a.xp_reward,
        earned: earnedIds.has(a.id),
      }));

      setData({
        profile,
        groupInfo: group,
        groupId,
        levelId,
        ageGroupId,
        attendedSessionNumbers,
        totalSessions,
        quest,
        warnings: warningsRes.count || 0,
        subscription: subRes.data,
        isFrozen,
        totalXp,
        streak,
        achievements,
      });
    } catch (err) {
      console.error('GameHub fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 rounded-full border-3 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  // Real XP from DB
  const xpLevel = Math.floor(data.totalXp / 300) + 1;
  const xpInLevel = data.totalXp % 300;

  // Real shields count
  const shieldsEarned = data.achievements.filter(a => a.earned).length;

  return (
    <div className="space-y-6">
      {/* Frozen Alert */}
      {data.isFrozen && (
        <Card className="border-sky-300 bg-sky-50 dark:bg-sky-950/30 dark:border-sky-800">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Snowflake className="w-6 h-6 text-sky-600 shrink-0" />
              <div>
                <p className="font-semibold text-sky-800 dark:text-sky-300">
                  {isRTL ? 'مجموعتك مجمدة حالياً' : 'Your group is currently frozen'}
                </p>
                <p className="text-sm text-sky-700 dark:text-sky-400">
                  {isRTL ? 'تواصل مع الإدارة لمزيد من المعلومات' : 'Contact administration for details'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Level Passed Banner */}
      {user && <LevelPassedBanner studentId={user.id} onUpgraded={fetchGameData} />}

      {/* Hero Bar: XP + Streak + Shields */}
      <Card>
        <CardContent className="py-4 px-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Avatar + name */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-full kojo-gradient flex items-center justify-center shrink-0">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">
                  {language === 'ar' ? data.profile?.full_name_ar : data.profile?.full_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {data.profile?.levels && (language === 'ar' ? data.profile.levels.name_ar : data.profile.levels.name)}
                </p>
              </div>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* XP Bar */}
            <div className="w-40 hidden sm:block">
              <XpBar currentXp={xpInLevel} nextLevelXp={300} level={xpLevel} />
            </div>

            {/* Streak */}
            <StreakCounter currentStreak={data.streak.current} />

            {/* Shields count */}
            <div className="flex items-center gap-1.5">
              <Shield className="h-5 w-5 text-secondary" />
              <span className="text-sm font-bold tabular-nums">{shieldsEarned}</span>
            </div>

            {/* Warnings */}
            {data.warnings > 0 && (
              <Badge variant="destructive" className="cursor-pointer" onClick={() => navigate('/my-warnings')}>
                ⚠️ {data.warnings}
              </Badge>
            )}
          </div>

          {/* Mobile XP bar */}
          <div className="sm:hidden mt-3">
            <XpBar currentXp={xpInLevel} nextLevelXp={300} level={xpLevel} />
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="map" className="w-full">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="map" className="gap-1 text-xs sm:text-sm">
            <Map className="h-4 w-4" />
            <span className="hidden sm:inline">{isRTL ? 'الخريطة' : 'Map'}</span>
          </TabsTrigger>
          <TabsTrigger value="quest" className="gap-1 text-xs sm:text-sm">
            <Swords className="h-4 w-4" />
            <span className="hidden sm:inline">{isRTL ? 'المهمة' : 'Quest'}</span>
          </TabsTrigger>
          <TabsTrigger value="shields" className="gap-1 text-xs sm:text-sm">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">{isRTL ? 'الدروع' : 'Shields'}</span>
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="gap-1 text-xs sm:text-sm">
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">{isRTL ? 'الترتيب' : 'Rank'}</span>
          </TabsTrigger>
        </TabsList>

        {/* Map Tab */}
        <TabsContent value="map">
          {data.groupId && data.levelId && data.ageGroupId ? (
            <LevelMap
              groupId={data.groupId}
              levelId={data.levelId}
              ageGroupId={data.ageGroupId}
              attendedSessionNumbers={data.attendedSessionNumbers}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {isRTL ? 'مش مسجل في مجموعة حالياً' : 'Not enrolled in a group'}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Quest Tab */}
        <TabsContent value="quest">
          <CurrentQuest quest={data.quest} />

          {/* Quick stats below quest */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/my-sessions')}>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold">{data.attendedSessionNumbers.size}/{data.totalSessions}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? 'سيشنات مكتملة' : 'Sessions done'}</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/leaderboard')}>
              <CardContent className="py-4 text-center">
                <Trophy className="h-6 w-6 mx-auto text-yellow-500 mb-1" />
                <p className="text-xs text-muted-foreground">{isRTL ? 'شوف ترتيبك' : 'See your rank'}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Shields Tab */}
        <TabsContent value="shields">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-5 w-5 text-secondary" />
                {isRTL ? 'الدروع والإنجازات' : 'Shields & Achievements'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                {data.achievements.map((a) => (
                  <div
                    key={a.id}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                      a.earned
                        ? 'bg-secondary/5 border-secondary/20 shadow-sm'
                        : 'opacity-40 grayscale'
                    }`}
                  >
                    <Shield className={`h-6 w-6 ${a.earned ? 'text-secondary' : 'text-muted-foreground'}`} />
                    <span className="text-[10px] text-center font-medium leading-tight">
                      {language === 'ar' ? a.title_ar : a.title}
                    </span>
                    {a.earned && <span className="text-[9px] text-secondary font-bold">✓</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard">
          <Card>
            <CardContent className="py-8 text-center">
              <Trophy className="h-12 w-12 mx-auto text-yellow-500 mb-3" />
              <p className="font-semibold mb-2">{isRTL ? 'لوحة الترتيب' : 'Leaderboard'}</p>
              <p className="text-sm text-muted-foreground mb-4">
                {isRTL ? 'شوف ترتيبك بين زملائك' : 'See how you rank among peers'}
              </p>
              <Button onClick={() => navigate('/leaderboard')} className="kojo-gradient">
                <Trophy className="h-4 w-4 mr-2" />
                {isRTL ? 'افتح لوحة الترتيب' : 'Open Leaderboard'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
