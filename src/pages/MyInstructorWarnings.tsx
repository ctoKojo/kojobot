import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/timeUtils';
import { AlertTriangle, CheckCircle, Clock, Calendar, FileQuestion, ClipboardList, UserCheck, MessageSquare, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useNavigate } from 'react-router-dom';

interface ConversationContext {
  senderName: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  conversationId: string;
}

interface Warning {
  id: string;
  warning_type: string;
  severity: string;
  reason: string;
  reason_ar: string | null;
  is_active: boolean;
  created_at: string;
  session_id: string | null;
  reference_id: string | null;
  reference_type: string | null;
  sessions?: {
    session_number: number;
    session_date: string;
    groups: {
      name: string;
      name_ar: string;
    };
  } | null;
  conversationContext?: ConversationContext | null;
}

interface SLAStatus {
  pendingMessages: number;
  pendingGrading: number;
  oldestMessageHours: number | null;
  oldestGradingHours: number | null;
}

export default function MyInstructorWarnings() {
  const { user } = useAuth();
  const { isRTL, language } = useLanguage();
  const navigate = useNavigate();
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);
  const [slaStatus, setSlaStatus] = useState<SLAStatus>({ pendingMessages: 0, pendingGrading: 0, oldestMessageHours: null, oldestGradingHours: null });

  useEffect(() => {
    if (user) {
      fetchWarnings();
      fetchSLAStatus();
    }
  }, [user]);

  const fetchWarnings = async () => {
    try {
      const { data, error } = await supabase
        .from('instructor_warnings')
        .select(`
          *,
          sessions(session_number, session_date, groups(name, name_ar))
        `)
        .eq('instructor_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich no_reply warnings with conversation context (sender + last message)
      const noReplyWarnings = (data || []).filter(
        (w: any) => w.warning_type === 'no_reply' && w.reference_type === 'conversation' && w.reference_id
      );

      const contextMap = new Map<string, ConversationContext>();
      await Promise.all(
        noReplyWarnings.map(async (w: any) => {
          const convId = w.reference_id as string;
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at, sender_id')
            .eq('conversation_id', convId)
            .neq('sender_id', user?.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastMsg) {
            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('full_name, full_name_ar')
              .eq('user_id', lastMsg.sender_id)
              .maybeSingle();

            contextMap.set(w.id, {
              senderName: language === 'ar'
                ? (senderProfile?.full_name_ar || senderProfile?.full_name || null)
                : (senderProfile?.full_name || null),
              lastMessage: lastMsg.content,
              lastMessageAt: lastMsg.created_at,
              conversationId: convId,
            });
          }
        })
      );

      const enriched = (data || []).map((w: any) => ({
        ...w,
        conversationContext: contextMap.get(w.id) || null,
      }));

      setWarnings(enriched);
    } catch (error) {
      console.error('Error fetching warnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSLAStatus = async () => {
    if (!user) return;
    try {
      // Get conversations where this instructor participates
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (participations && participations.length > 0) {
        const convIds = participations.map(p => p.conversation_id);
        let pendingCount = 0;
        let oldestHours: number | null = null;

        for (const convId of convIds.slice(0, 20)) {
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('sender_id, created_at')
            .eq('conversation_id', convId)
            .order('created_at', { ascending: false })
            .limit(1);

          if (lastMsg && lastMsg.length > 0 && lastMsg[0].sender_id !== user.id) {
            const hours = (Date.now() - new Date(lastMsg[0].created_at).getTime()) / (1000 * 60 * 60);
            if (hours >= 24) {
              pendingCount++;
              if (oldestHours === null || hours > oldestHours) oldestHours = hours;
            }
          }
        }

        // Get pending grading
        const { data: pendingSubs } = await supabase
          .from('assignment_submissions')
          .select('submitted_at, assignments!inner(assigned_by)')
          .eq('status', 'submitted')
          .eq('assignments.assigned_by', user.id);

        let gradingCount = 0;
        let oldestGrading: number | null = null;
        if (pendingSubs) {
          for (const sub of pendingSubs) {
            const hours = (Date.now() - new Date(sub.submitted_at).getTime()) / (1000 * 60 * 60);
            if (hours >= 24) {
              gradingCount++;
              if (oldestGrading === null || hours > oldestGrading) oldestGrading = hours;
            }
          }
        }

        setSlaStatus({
          pendingMessages: pendingCount,
          pendingGrading: gradingCount,
          oldestMessageHours: oldestHours,
          oldestGradingHours: oldestGrading,
        });
      }
    } catch (error) {
      console.error('Error fetching SLA status:', error);
    }
  };

  const activeWarnings = warnings.filter(w => w.is_active);
  const resolvedWarnings = warnings.filter(w => !w.is_active);

  const getSLALevel = (): 'green' | 'yellow' | 'red' => {
    if (slaStatus.pendingMessages === 0 && slaStatus.pendingGrading === 0) return 'green';
    if ((slaStatus.oldestMessageHours && slaStatus.oldestMessageHours >= 48) ||
        (slaStatus.oldestGradingHours && slaStatus.oldestGradingHours >= 48)) return 'red';
    return 'yellow';
  };

  const slaLevel = getSLALevel();

  const getWarningTypeInfo = (type: string) => {
    switch (type) {
      case 'no_quiz':
        return { label: isRTL ? 'كويز مفقود' : 'Missing Quiz', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: FileQuestion };
      case 'no_attendance':
        return { label: isRTL ? 'حضور غير مسجل' : 'Missing Attendance', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: UserCheck };
      case 'no_assignment':
        return { label: isRTL ? 'واجب مفقود' : 'Missing Assignment', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: ClipboardList };
      case 'no_reply':
        return { label: isRTL ? 'عدم الرد على الطالب' : 'No Reply to Student', color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400', icon: MessageSquare };
      case 'late_grading':
        return { label: isRTL ? 'تأخر في التقييم' : 'Late Grading', color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400', icon: Clock };
      case 'behavior':
        return { label: isRTL ? 'سلوك' : 'Behavior', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle };
      case 'non_compliance':
        return { label: isRTL ? 'عدم التزام' : 'Non-Compliance', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: AlertTriangle };
      case 'poor_performance':
        return { label: isRTL ? 'أداء ضعيف' : 'Poor Performance', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: AlertTriangle };
      case 'attendance':
        return { label: isRTL ? 'حضور' : 'Attendance', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: UserCheck };
      case 'late_submission':
        return { label: isRTL ? 'تأخر في التسليم' : 'Late Submission', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock };
      default:
        return { label: type, color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400', icon: AlertTriangle };
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'minor': return { label: isRTL ? 'بسيط' : 'Minor', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
      case 'major': return { label: isRTL ? 'متوسط' : 'Major', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' };
      case 'critical': return { label: isRTL ? 'حرج' : 'Critical', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
      default: return { label: sev, color: '' };
    }
  };

  // formatDate centralized in timeUtils.ts (SSOT)

  const WarningCard = ({ warning }: { warning: Warning }) => {
    const typeInfo = getWarningTypeInfo(warning.warning_type);
    const TypeIcon = typeInfo.icon;
    const sevBadge = getSeverityBadge(warning.severity || 'minor');

    return (
      <Card 
        className={`${warning.is_active ? 'border-warning' : 'opacity-60'} ${warning.session_id ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
        onClick={() => warning.session_id && navigate(`/session/${warning.session_id}`)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className={`p-2 rounded-lg ${warning.is_active ? 'bg-warning/10' : 'bg-muted'}`}>
              <TypeIcon className={`h-5 w-5 ${warning.is_active ? 'text-warning' : 'text-muted-foreground'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
                  <Badge className={sevBadge.color}>{sevBadge.label}</Badge>
                </div>
                {!warning.is_active && (
                  <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {isRTL ? 'تم الحل' : 'Resolved'}
                  </Badge>
                )}
              </div>
              <p className="font-medium text-sm sm:text-base">
                {language === 'ar' && warning.reason_ar ? warning.reason_ar : warning.reason}
              </p>
              {warning.sessions && (
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {isRTL ? 'السيشن' : 'Session'} {warning.sessions.session_number} - {language === 'ar' ? warning.sessions.groups?.name_ar : warning.sessions.groups?.name}
                  </span>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {formatDate(warning.created_at, language)}
              </p>
              {warning.session_id && warning.is_active && (
                <p className="text-xs text-primary mt-1">
                  {isRTL ? 'اضغط لفتح السيشن وحل المشكلة' : 'Click to open session and resolve'}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 shadow-lg shadow-red-500/20">
            <AlertTriangle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{isRTL ? 'إنذاراتي' : 'My Warnings'}</h1>
            <p className="text-sm text-muted-foreground">{isRTL ? 'تتبع الإنذارات الصادرة لك' : 'Track warnings issued to you'}</p>
          </div>
        </div>

        {/* SLA Status Widget */}
        <Card className={`border-2 ${
          slaLevel === 'green' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' :
          slaLevel === 'yellow' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' :
          'border-red-500 bg-red-50 dark:bg-red-950/20'
        }`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <Shield className={`h-6 w-6 ${
                slaLevel === 'green' ? 'text-green-600' :
                slaLevel === 'yellow' ? 'text-yellow-600' :
                'text-red-600'
              }`} />
              <h3 className="font-semibold text-lg">
                {isRTL ? 'حالة SLA' : 'SLA Status'}
              </h3>
              <Badge className={`${
                slaLevel === 'green' ? 'bg-green-100 text-green-800' :
                slaLevel === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {slaLevel === 'green' ? (isRTL ? 'ممتاز' : 'Good') :
                 slaLevel === 'yellow' ? (isRTL ? 'تنبيه' : 'Warning') :
                 (isRTL ? 'تجاوز' : 'Exceeded')}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {isRTL ? `${slaStatus.pendingMessages} رسائل بانتظار الرد` : `${slaStatus.pendingMessages} messages pending reply`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {isRTL ? `${slaStatus.pendingGrading} تقييمات معلقة` : `${slaStatus.pendingGrading} pending grading`}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-2">
          <Card className="relative overflow-hidden border-0 shadow-sm">
            <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${activeWarnings.length > 0 ? 'from-red-500 to-orange-500' : 'from-emerald-500 to-emerald-600'}`} />
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${activeWarnings.length > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                  <AlertTriangle className={`h-4 w-4 ${activeWarnings.length > 0 ? 'text-red-600' : 'text-emerald-600'}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${activeWarnings.length > 0 ? 'text-red-600' : ''}`}>{loading ? '...' : activeWarnings.length}</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'إنذارات نشطة' : 'Active Warnings'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-sm">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-slate-400 to-slate-500" />
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-500/10">
                  <CheckCircle className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-muted-foreground">{loading ? '...' : resolvedWarnings.length}</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'إنذارات ملغاة' : 'Dismissed Warnings'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Warnings Tabs */}
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1">
              <AlertTriangle className="w-4 h-4 mr-2" />
              {isRTL ? 'نشطة' : 'Active'}
              {activeWarnings.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {activeWarnings.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="resolved" className="flex-1">
              <CheckCircle className="w-4 h-4 mr-2" />
              {isRTL ? 'ملغاة' : 'Dismissed'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            {loading ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {isRTL ? 'جاري التحميل...' : 'Loading...'}
                </CardContent>
              </Card>
            ) : activeWarnings.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold">
                    {isRTL ? 'لا توجد إنذارات نشطة' : 'No Active Warnings'}
                  </h3>
                  <p className="text-muted-foreground">
                    {isRTL ? 'أحسنت! استمر في العمل الجيد' : 'Great job! Keep up the good work'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {activeWarnings.map(warning => (
                  <WarningCard key={warning.id} warning={warning} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="resolved" className="mt-4">
            {resolvedWarnings.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {isRTL ? 'لا توجد إنذارات ملغاة' : 'No dismissed warnings'}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {resolvedWarnings.map(warning => (
                  <WarningCard key={warning.id} warning={warning} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Tips Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">
              {isRTL ? 'نصائح لتجنب الإنذارات' : 'Tips to Avoid Warnings'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                {isRTL 
                  ? 'أضف كويز لكل سيشن قبل انتهائها'
                  : 'Add a quiz for each session before it ends'}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                {isRTL 
                  ? 'سجل الحضور أثناء السيشن'
                  : 'Record attendance during the session'}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                {isRTL 
                  ? 'ارفع الواجب خلال 24 ساعة من انتهاء السيشن'
                  : 'Upload assignment within 24 hours after session'}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                {isRTL 
                  ? 'رد على رسائل الطلاب خلال فترة الـ SLA المحددة'
                  : 'Reply to student messages within the SLA period'}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                {isRTL 
                  ? 'قيّم واجبات الطلاب في أسرع وقت ممكن'
                  : 'Grade student assignments as soon as possible'}
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
