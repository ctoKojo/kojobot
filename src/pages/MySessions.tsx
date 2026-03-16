import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  BookOpen,
  Calendar,
  Presentation,
  PlayCircle,
  Film,
  ExternalLink,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react';
import { PdfDownloadButton } from '@/components/PdfDownloadButton';

interface AttendedSession {
  id: string;
  session_number: number | null;
  session_date: string;
  session_time: string;
  status: string;
  group_id: string;
  group_name: string;
  group_name_ar: string;
  is_makeup: boolean;
  compensation_status: string;
  curriculum?: {
    title: string;
    title_ar: string;
    description: string | null;
    description_ar: string | null;
    slides_url: string | null;
    summary_video_url: string | null;
    full_video_url: string | null;
    can_view_slides: boolean;
    can_view_summary_video: boolean;
    can_view_full_video: boolean;
    student_pdf_available?: boolean;
  } | null;
}

export default function MySessions() {
  const navigate = useNavigate();
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<AttendedSession[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string; name_ar: string }[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Fetch student's active groups
      const { data: studentGroups } = await supabase
        .from('group_students')
        .select('group_id, groups(id, name, name_ar, age_group_id, level_id)')
        .eq('student_id', user.id)
        .eq('is_active', true);

      if (!studentGroups?.length) {
        setSessions([]);
        setGroups([]);
        setLoading(false);
        return;
      }

      const groupMap = new Map<string, any>();
      studentGroups.forEach(sg => {
        const g = sg.groups as any;
        if (g) groupMap.set(sg.group_id, g);
      });

      setGroups(Array.from(groupMap.values()).map(g => ({ id: g.id, name: g.name, name_ar: g.name_ar })));

      // 2. Fetch attendance records for student
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('session_id, status, compensation_status')
        .eq('student_id', user.id);

      if (!attendanceData?.length) {
        setSessions([]);
        setLoading(false);
        return;
      }

      // 3. Filter attended sessions only
      const attendedMap = new Map<string, { status: string; compensation_status: string }>();
      attendanceData.forEach(a => {
        const isAttended = a.status === 'present' || a.status === 'late' || a.compensation_status === 'compensated';
        if (isAttended) {
          attendedMap.set(a.session_id, { status: a.status, compensation_status: a.compensation_status });
        }
      });

      if (attendedMap.size === 0) {
        setSessions([]);
        setLoading(false);
        return;
      }

      // 4. Fetch session data
      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('id, session_number, content_number, session_date, session_time, status, group_id, is_makeup')
        .in('id', Array.from(attendedMap.keys()))
        .order('session_date', { ascending: false });

      if (!sessionsData?.length) {
        setSessions([]);
        setLoading(false);
        return;
      }

      // 5. Get student's profile for subscription info
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_type, attendance_mode')
        .eq('user_id', user.id)
        .maybeSingle();

      const subType = profile?.subscription_type || null;
      const attMode = profile?.attendance_mode || null;

      // 6. Fetch curriculum content for each unique (age_group_id, level_id, session_number)
      const curriculumCache = new Map<string, any>();
      const uniqueCurrKeys = new Set<string>();

      sessionsData.forEach(s => {
        const g = groupMap.get(s.group_id);
        const currNum = s.content_number ?? s.session_number;
        if (g?.age_group_id && g?.level_id && currNum) {
          uniqueCurrKeys.add(`${g.age_group_id}|${g.level_id}|${currNum}`);
        }
      });

      // Batch fetch curriculum (parallel)
      await Promise.all(
        Array.from(uniqueCurrKeys).map(async (key) => {
          const [ageGroupId, levelId, sessionNum] = key.split('|');
          try {
            const { data } = await supabase.rpc('get_curriculum_with_access', {
              p_age_group_id: ageGroupId,
              p_level_id: levelId,
              p_session_number: parseInt(sessionNum),
              p_subscription_type: subType,
              p_attendance_mode: attMode,
            });
            if (data?.[0]) {
              curriculumCache.set(key, data[0]);
            }
          } catch (err) {
            console.error('Error fetching curriculum for', key, err);
          }
        })
      );

      // 7. Build final sessions list
      const result: AttendedSession[] = sessionsData.map(s => {
        const g = groupMap.get(s.group_id);
        const att = attendedMap.get(s.id);
        const currKey = g ? `${g.age_group_id}|${g.level_id}|${s.content_number ?? s.session_number}` : '';
        const curr = curriculumCache.get(currKey);

        return {
          id: s.id,
          session_number: s.session_number,
          session_date: s.session_date,
          session_time: s.session_time,
          status: s.status,
          group_id: s.group_id,
          group_name: g?.name || '',
          group_name_ar: g?.name_ar || '',
          is_makeup: s.is_makeup,
          compensation_status: att?.compensation_status || 'none',
          curriculum: curr ? {
            title: curr.title,
            title_ar: curr.title_ar,
            description: curr.description,
            description_ar: curr.description_ar,
            slides_url: curr.slides_url,
            summary_video_url: curr.summary_video_url,
            full_video_url: curr.full_video_url,
            can_view_slides: curr.can_view_slides,
            can_view_summary_video: curr.can_view_summary_video,
            can_view_full_video: curr.can_view_full_video,
            student_pdf_available: curr.student_pdf_available ?? false,
          } : null,
        };
      });

      setSessions(result);
    } catch (error) {
      console.error('Error fetching my sessions:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في تحميل السيشنات' : 'Failed to load sessions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredSessions = selectedGroup === 'all'
    ? sessions
    : sessions.filter(s => s.group_id === selectedGroup);

  const hasContent = (s: AttendedSession) => {
    if (!s.curriculum) return false;
    return (
      s.curriculum.student_pdf_available ||
      (s.curriculum.can_view_summary_video && s.curriculum.summary_video_url) ||
      (s.curriculum.can_view_full_video && s.curriculum.full_video_url)
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{isRTL ? 'سيشناتي' : 'My Sessions'}</h1>
              <p className="text-muted-foreground text-sm">{isRTL ? 'محتوى السيشنات اللي حضرتها' : 'Content from sessions you attended'}</p>
            </div>
          </div>

          {groups.length > 1 && (
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={isRTL ? 'كل المجموعات' : 'All Groups'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? 'كل المجموعات' : 'All Groups'}</SelectItem>
                {groups.map(g => (
                  <SelectItem key={g.id} value={g.id}>
                    {language === 'ar' ? g.name_ar : g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredSessions.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-1">
                {isRTL ? 'لا توجد سيشنات بعد' : 'No sessions yet'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isRTL 
                  ? 'ستظهر هنا السيشنات اللي حضرتها مع محتواها التعليمي'
                  : 'Sessions you attend will appear here with their educational content'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Sessions Grid */}
        {!loading && filteredSessions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSessions.map(s => (
              <Card
                key={s.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/session/${s.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {isRTL ? `سيشن ${s.session_number}` : `Session ${s.session_number}`}
                      </Badge>
                      {s.compensation_status === 'compensated' && (
                        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs">
                          <RefreshCw className="h-3 w-3 mr-1" />
                          {isRTL ? 'تعويضية' : 'Makeup'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-base mt-2">
                    {s.curriculum
                      ? (language === 'ar' ? s.curriculum.title_ar : s.curriculum.title)
                      : (isRTL ? `سيشن ${s.session_number}` : `Session ${s.session_number}`)}
                  </CardTitle>
                  {s.curriculum?.description && (
                    <CardDescription className="text-xs line-clamp-2">
                      {language === 'ar' ? s.curriculum.description_ar : s.curriculum.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Meta info */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {s.session_date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {language === 'ar' ? s.group_name_ar : s.group_name}
                    </span>
                  </div>

                  {/* Content buttons */}
                  {hasContent(s) && (
                    <div className="flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
                      {/* Student PDF download instead of slides */}
                      {s.curriculum?.student_pdf_available && (
                        <PdfDownloadButton sessionId={s.id} sessionNumber={s.session_number} isRTL={isRTL} />
                      )}
                      {s.curriculum?.can_view_summary_video && s.curriculum?.summary_video_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={s.curriculum.summary_video_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs">
                            <PlayCircle className="h-3.5 w-3.5" />
                            {isRTL ? 'ملخص' : 'Summary'}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </Button>
                      )}
                      {s.curriculum?.can_view_full_video && s.curriculum?.full_video_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={s.curriculum.full_video_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs">
                            <Film className="h-3.5 w-3.5" />
                            {isRTL ? 'كامل' : 'Full'}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                  )}

                  {!hasContent(s) && (
                    <p className="text-xs text-muted-foreground">
                      {isRTL ? 'لا يوجد محتوى متاح حالياً' : 'No content available currently'}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
