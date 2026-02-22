import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Video, ExternalLink, AlertCircle, Clock, AlertTriangle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LoadingScreen } from '@/components/LoadingScreen';
import { JitsiMeeting } from '@/components/JitsiMeeting';
import { useProfile } from '@/hooks/useProfile';
import { getSessionJoinStatus, type SessionJoinStatus } from '@/lib/sessionJoinGuard';
import { useOnlineAttendance } from '@/hooks/useOnlineAttendance';

interface SessionData {
  id: string;
  session_date: string;
  session_time: string;
  duration_minutes: number;
  status: string;
  session_number: number | null;
}

export default function LiveSession() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user, role } = useAuth();
  const { isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { profile } = useProfile();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [sessionLink, setSessionLink] = useState<string | null>(null);
  const [jitsiFailed, setJitsiFailed] = useState(false);

  // Session & time guard state
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null);
  const [joinStatus, setJoinStatus] = useState<SessionJoinStatus | null>(null);
  const [noSession, setNoSession] = useState(false);

  // Fetch group + authorize
  useEffect(() => {
    if (!user || !groupId) return;

    async function checkAccess() {
      const { data: group, error } = await supabase
        .from('groups')
        .select('id, name, name_ar, instructor_id, session_link, attendance_mode')
        .eq('id', groupId)
        .single();

      if (error || !group) {
        toast({
          title: isRTL ? 'خطأ' : 'Error',
          description: isRTL ? 'المجموعة غير موجودة' : 'Group not found',
          variant: 'destructive',
        });
        return;
      }

      setGroupName(language === 'ar' ? group.name_ar : group.name);
      setSessionLink(group.session_link);

      if (role === 'admin') {
        setAuthorized(true);
        setLoading(false);
        return;
      }

      if (user.id === group.instructor_id) {
        setAuthorized(true);
        setLoading(false);
        return;
      }

      const { data: membership } = await supabase
        .from('group_students')
        .select('id')
        .eq('group_id', groupId)
        .eq('student_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (membership) {
        setAuthorized(true);
        setLoading(false);
        return;
      }

      toast({
        title: isRTL ? 'غير مصرح' : 'Unauthorized',
        description: isRTL ? 'أنت لست عضوًا في هذه المجموعة' : 'You are not a member of this group',
        variant: 'destructive',
      });
    }

    checkAccess();
  }, [user, groupId, role]);

  // Fetch today's session for this group
  const fetchTodaySession = useCallback(async () => {
    if (!groupId || !authorized) return;

    // Get Cairo "today" date string
    const cairoDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());

    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, session_date, session_time, duration_minutes, status, session_number')
      .eq('group_id', groupId)
      .eq('session_date', cairoDate)
      .eq('status', 'scheduled')
      .order('session_time', { ascending: true })
      .limit(1);

    if (!sessions || sessions.length === 0) {
      // Also check for sessions that may have been auto-completed just now
      const { data: completedToday } = await supabase
        .from('sessions')
        .select('id, session_date, session_time, duration_minutes, status, session_number')
        .eq('group_id', groupId)
        .eq('session_date', cairoDate)
        .eq('status', 'completed')
        .order('session_time', { ascending: true })
        .limit(1);

      if (completedToday && completedToday.length > 0) {
        setCurrentSession(completedToday[0]);
        setJoinStatus({
          canJoin: false,
          reason: 'session_ended',
          attendanceStatus: null,
          minutesUntilStart: null,
          minutesSinceStart: null,
        });
      } else {
        setNoSession(true);
      }
      return;
    }

    const sess = sessions[0];
    setCurrentSession(sess);

    const status = getSessionJoinStatus(
      sess.session_date,
      sess.session_time,
      sess.duration_minutes,
      role as any,
    );
    setJoinStatus(status);
  }, [groupId, authorized, role]);

  useEffect(() => {
    fetchTodaySession();
  }, [fetchTodaySession]);

  // Auto-refresh for too_early state
  useEffect(() => {
    if (!joinStatus || joinStatus.reason !== 'too_early') return;
    const interval = setInterval(() => {
      if (currentSession) {
        const status = getSessionJoinStatus(
          currentSession.session_date,
          currentSession.session_time,
          currentSession.duration_minutes,
          role as any,
        );
        setJoinStatus(status);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [joinStatus, currentSession, role]);

  // Online attendance heartbeat (only for students)
  const shouldTrackAttendance = 
    role === 'student' && 
    authorized && 
    currentSession && 
    joinStatus?.canJoin === true && 
    joinStatus.attendanceStatus !== null;

  useOnlineAttendance({
    sessionId: currentSession?.id || '',
    groupId: groupId || '',
    studentId: user?.id || '',
    attendanceStatus: (joinStatus?.attendanceStatus || 'present') as 'present' | 'late' | 'absent',
    enabled: !!shouldTrackAttendance,
  });

  if (loading) return <LoadingScreen />;
  if (!authorized || !groupId) return null;

  const isModerator = role === 'admin' || role === 'instructor';
  const cleanId = groupId.replace(/-/g, '').substring(0, 12);
  const roomName = `kojobot-${cleanId}`;

  const displayName = profile
    ? (language === 'ar' ? profile.full_name_ar || profile.full_name : profile.full_name)
    : user?.email || 'User';

  const handleBack = () => {
    window.close();
    // Fallback if window.close doesn't work (not opened by script)
    window.location.href = `/group/${groupId}`;
  };

  const handleJitsiError = () => setJitsiFailed(true);

  // No session today
  if (noSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
            <Clock className="h-12 w-12 text-muted-foreground" />
            <h2 className="text-xl font-bold">
              {isRTL ? 'لا توجد جلسة مجدولة اليوم' : 'No session scheduled today'}
            </h2>
            <p className="text-muted-foreground">
              {isRTL ? 'لا توجد جلسة مجدولة لهذه المجموعة اليوم.' : 'There is no scheduled session for this group today.'}
            </p>
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {isRTL ? 'ارجع للمنصة' : 'Back to Platform'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Too early - countdown
  if (joinStatus && joinStatus.reason === 'too_early' && !joinStatus.canJoin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
            <Clock className="h-12 w-12 text-primary animate-pulse" />
            <h2 className="text-xl font-bold">
              {isRTL ? 'الجلسة لم تبدأ بعد' : 'Session hasn\'t started yet'}
            </h2>
            <div className="text-3xl font-bold text-primary">
              {joinStatus.minutesUntilStart != null && (
                <>
                  {joinStatus.minutesUntilStart} {isRTL ? 'دقيقة' : 'min'}
                </>
              )}
            </div>
            <p className="text-muted-foreground">
              {isRTL ? 'ستتمكن من الانضمام عند بداية الجلسة. الصفحة تتحدث تلقائياً.' : 'You can join when the session starts. This page refreshes automatically.'}
            </p>
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {isRTL ? 'ارجع للمنصة' : 'Back to Platform'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Session ended
  if (joinStatus && joinStatus.reason === 'session_ended') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            <h2 className="text-xl font-bold">
              {isRTL ? 'الجلسة انتهت' : 'Session has ended'}
            </h2>
            <p className="text-muted-foreground">
              {isRTL ? 'انتهى وقت هذه الجلسة.' : 'This session has already ended.'}
            </p>
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {isRTL ? 'ارجع للمنصة' : 'Back to Platform'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Jitsi failed fallback
  if (jitsiFailed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <h2 className="text-xl font-bold">
              {isRTL ? 'تعذر تحميل غرفة الفيديو' : 'Failed to load video room'}
            </h2>
            <p className="text-muted-foreground">
              {isRTL
                ? 'حدث خطأ أثناء تحميل غرفة الفيديو. يمكنك المحاولة مرة أخرى أو استخدام الرابط الخارجي.'
                : 'An error occurred while loading the video room. You can try again or use the external link.'}
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              <Button onClick={() => { setJitsiFailed(false); }}>
                {isRTL ? 'إعادة المحاولة' : 'Try Again'}
              </Button>
              {sessionLink && (
                <Button variant="outline" asChild>
                  <a href={sessionLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {isRTL ? 'رابط خارجي' : 'External Link'}
                  </a>
                </Button>
              )}
              <Button variant="ghost" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {isRTL ? 'رجوع' : 'Go Back'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main: Jitsi room with status banner
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-green-600" />
            <span className="font-semibold text-sm sm:text-base truncate max-w-[200px] sm:max-w-none">
              {groupName}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Status badge */}
          {joinStatus?.reason === 'on_time' && joinStatus.attendanceStatus === 'present' && (
            <Badge className="bg-green-600 text-white">{isRTL ? 'حاضر' : 'Present'}</Badge>
          )}
          {joinStatus?.reason === 'late' && (
            <Badge className="bg-yellow-600 text-white">{isRTL ? 'متأخر' : 'Late'}</Badge>
          )}
          {joinStatus?.reason === 'too_late' && (
            <Badge variant="destructive">{isRTL ? 'غائب (متفرج)' : 'Absent (Viewer)'}</Badge>
          )}
          {sessionLink && (
            <Button variant="outline" size="sm" asChild>
              <a href={sessionLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">
                  {isRTL ? 'رابط خارجي' : 'External Link'}
                </span>
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Attendance warning banners */}
      {joinStatus?.reason === 'late' && role === 'student' && (
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2 flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
          <span className="text-yellow-800 dark:text-yellow-300">
            {isRTL ? 'سيتم تسجيلك متأخراً' : 'You will be marked as late'}
          </span>
        </div>
      )}
      {joinStatus?.reason === 'too_late' && role === 'student' && (
        <div className="bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800 px-4 py-2 flex items-center gap-2 text-sm">
          <Eye className="h-4 w-4 text-red-600 shrink-0" />
          <span className="text-red-800 dark:text-red-300">
            {isRTL ? 'أنت في وضع المشاهدة فقط — ستُسجل غائباً' : 'Viewer mode only — you will be marked absent'}
          </span>
        </div>
      )}

      {/* Jitsi Container */}
      <div className="flex-1 min-h-0">
        <JitsiMeeting
          roomName={roomName}
          displayName={displayName}
          email={user?.email || undefined}
          avatarUrl={profile?.avatar_url || undefined}
          isModerator={isModerator}
          onClose={handleBack}
          onError={handleJitsiError}
        />
      </div>
    </div>
  );
}
