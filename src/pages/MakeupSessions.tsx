import { useState, useEffect } from 'react';
import { Calendar, Clock, Search, Filter, CheckCircle, XCircle, AlertTriangle, Users, GraduationCap, RefreshCw, UserCheck, Timer, CalendarClock } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsGrid } from '@/components/shared/StatsGrid';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { notificationService } from '@/lib/notificationService';
import { getMakeupStatusBadge } from '@/lib/statusBadges';

interface MakeupSession {
  id: string;
  student_id: string;
  original_session_id: string | null;
  group_id: string;
  level_id: string | null;
  reason: string;
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  notes: string | null;
  is_free: boolean;
  created_at: string;
  completed_at: string | null;
  student_confirmed: boolean | null;
  assigned_instructor_id: string | null;
  makeup_type: string;
  curriculum_session_id: string | null;
}

interface EnrichedMakeupSession extends MakeupSession {
  student_name: string;
  group_name: string;
  level_name: string;
  original_session_number: number | null;
  instructor_name: string;
}

interface Instructor {
  user_id: string;
  full_name: string;
  full_name_ar: string | null;
}

export default function MakeupSessionsPage() {
  const { isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { role } = useAuth();
  const [makeupSessions, setMakeupSessions] = useState<EnrichedMakeupSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<EnrichedMakeupSession | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ date: '', time: '', notes: '', instructorId: '', attendanceMode: 'offline', sessionLink: '' });
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [instructorConflicts, setInstructorConflicts] = useState<string[]>([]);

  useEffect(() => {
    fetchMakeupSessions();
    fetchInstructors();
  }, []);

  const fetchInstructors = async () => {
    try {
      const { data: instructorRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'instructor');
      
      if (instructorRoles && instructorRoles.length > 0) {
        const ids = instructorRoles.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, full_name_ar')
          .in('user_id', ids)
          .neq('employment_status', 'terminated');
        setInstructors(profiles || []);
      }
    } catch (error) {
      console.error('Error fetching instructors:', error);
    }
  };

  const checkInstructorConflicts = async (instructorId: string, date: string, time: string) => {
    if (!instructorId || !date || !time) {
      setInstructorConflicts([]);
      return;
    }
    try {
      // Check if instructor has sessions on this date/time
      const { data: instructorGroups } = await supabase
        .from('groups')
        .select('id, name, name_ar')
        .eq('instructor_id', instructorId);
      
      if (!instructorGroups || instructorGroups.length === 0) {
        setInstructorConflicts([]);
        return;
      }

      const groupIds = instructorGroups.map(g => g.id);
      const { data: conflictingSessions } = await supabase
        .from('sessions')
        .select('id, session_time, group_id')
        .in('group_id', groupIds)
        .eq('session_date', date)
        .eq('status', 'scheduled');

      const conflicts = (conflictingSessions || [])
        .filter(s => s.session_time === time)
        .map(s => {
          const group = instructorGroups.find(g => g.id === s.group_id);
          return language === 'ar' ? (group?.name_ar || group?.name || '') : (group?.name || '');
        });

      setInstructorConflicts(conflicts);
    } catch (error) {
      console.error('Error checking conflicts:', error);
    }
  };

  // Watch for changes in schedule form to check conflicts
  useEffect(() => {
    if (scheduleForm.instructorId && scheduleForm.date && scheduleForm.time) {
      checkInstructorConflicts(scheduleForm.instructorId, scheduleForm.date, scheduleForm.time);
    } else {
      setInstructorConflicts([]);
    }
  }, [scheduleForm.instructorId, scheduleForm.date, scheduleForm.time]);

  const fetchMakeupSessions = async () => {
    try {
      const { data: msData, error } = await supabase
        .from('makeup_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!msData || msData.length === 0) {
        setMakeupSessions([]);
        setLoading(false);
        return;
      }

      const studentIds = [...new Set(msData.map(m => m.student_id))];
      const groupIds = [...new Set(msData.map(m => m.group_id))];
      const levelIds = [...new Set(msData.filter(m => m.level_id).map(m => m.level_id!))];
      const sessionIds = [...new Set(msData.filter(m => m.original_session_id).map(m => m.original_session_id!))];
      const instructorIds = [...new Set(msData.filter(m => m.assigned_instructor_id).map(m => m.assigned_instructor_id!))];

      const [profilesRes, groupsRes, levelsRes, sessionsRes, instructorProfilesRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, full_name_ar').in('user_id', studentIds),
        supabase.from('groups').select('id, name, name_ar').in('id', groupIds),
        levelIds.length > 0 ? supabase.from('levels').select('id, name, name_ar').in('id', levelIds) : { data: [] },
        sessionIds.length > 0 ? supabase.from('sessions').select('id, session_number').in('id', sessionIds) : { data: [] },
        instructorIds.length > 0 ? supabase.from('profiles').select('user_id, full_name, full_name_ar').in('user_id', instructorIds) : { data: [] },
      ]);

      const profilesMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
      const groupsMap = new Map((groupsRes.data || []).map(g => [g.id, g]));
      const levelsMap = new Map(((levelsRes as any).data || []).map((l: any) => [l.id, l]));
      const sessionsMap = new Map(((sessionsRes as any).data || []).map((s: any) => [s.id, s]));
      const instructorMap = new Map(((instructorProfilesRes as any).data || []).map((p: any) => [p.user_id, p]));

      const enriched: EnrichedMakeupSession[] = msData.map(m => {
        const profile = profilesMap.get(m.student_id);
        const group = groupsMap.get(m.group_id);
        const level = m.level_id ? levelsMap.get(m.level_id) as any : null;
        const origSession = m.original_session_id ? sessionsMap.get(m.original_session_id) as any : null;
        const instructorProfile = m.assigned_instructor_id ? instructorMap.get(m.assigned_instructor_id) as any : null;

        return {
          ...m,
          student_name: language === 'ar' ? (profile?.full_name_ar || profile?.full_name || '-') : (profile?.full_name || '-'),
          group_name: language === 'ar' ? (group?.name_ar || group?.name || '-') : (group?.name || '-'),
          level_name: level ? (language === 'ar' ? (level?.name_ar || level?.name) : level?.name) : '-',
          original_session_number: origSession?.session_number || null,
          instructor_name: instructorProfile ? (language === 'ar' ? (instructorProfile?.full_name_ar || instructorProfile?.full_name) : instructorProfile?.full_name) : '-',
        };
      });

      setMakeupSessions(enriched);
    } catch (error) {
      console.error('Error fetching makeup sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async (session: EnrichedMakeupSession) => {
    setSelectedSession(session);
    
    // Smart defaults: suggest original group's instructor, time
    let defaultInstructorId = session.assigned_instructor_id || '';
    let defaultTime = session.scheduled_time || '';
    
    // Get group's instructor and schedule time as defaults
    if (!defaultInstructorId || !defaultTime) {
      const { data: groupData } = await supabase
        .from('groups')
        .select('instructor_id, schedule_time')
        .eq('id', session.group_id)
        .single();
      
      if (groupData) {
        if (!defaultInstructorId) defaultInstructorId = groupData.instructor_id || '';
        if (!defaultTime) defaultTime = groupData.schedule_time || '';
      }
    }

    // Suggest next available date (tomorrow onwards)
    let suggestedDate = session.scheduled_date || '';
    if (!suggestedDate && defaultInstructorId) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Find first day without conflicts for the instructor
      for (let i = 0; i < 14; i++) {
        const checkDate = new Date(tomorrow);
        checkDate.setDate(checkDate.getDate() + i);
        const dateStr = checkDate.toISOString().split('T')[0];
        
        // Check for existing sessions on this date/time
        const { data: instructorGroups } = await supabase
          .from('groups')
          .select('id')
          .eq('instructor_id', defaultInstructorId);
        
        if (instructorGroups && instructorGroups.length > 0) {
          const groupIds = instructorGroups.map(g => g.id);
          const { data: conflicts } = await supabase
            .from('sessions')
            .select('id')
            .in('group_id', groupIds)
            .eq('session_date', dateStr)
            .eq('session_time', defaultTime)
            .eq('status', 'scheduled');
          
          if (!conflicts || conflicts.length === 0) {
            suggestedDate = dateStr;
            break;
          }
        } else {
          suggestedDate = dateStr;
          break;
        }
      }
    }

    setScheduleForm({
      date: suggestedDate,
      time: defaultTime,
      notes: session.notes || '',
      instructorId: defaultInstructorId,
      attendanceMode: 'offline',
      sessionLink: '',
    });
    setScheduleDialogOpen(true);
  };

  const handleSaveSchedule = async () => {
    if (!selectedSession || !scheduleForm.date || !scheduleForm.time) return;
    if (instructorConflicts.length > 0) {
      toast({ variant: 'destructive', title: isRTL ? 'تعارض' : 'Conflict', description: isRTL ? 'المدرب لديه سيشن في نفس الوقت' : 'Instructor has a session at this time' });
      return;
    }
    try {
      const { data, error } = await supabase.rpc('schedule_makeup_session', {
        p_makeup_id: selectedSession.id,
        p_date: scheduleForm.date,
        p_time: scheduleForm.time,
        p_instructor_id: scheduleForm.instructorId || null,
        p_notes: scheduleForm.notes || null,
      });

      if (error) throw error;

      // Update linked session with attendance mode if online
      if (scheduleForm.attendanceMode === 'online' && scheduleForm.sessionLink) {
        const { data: linkedSession } = await supabase
          .from('sessions')
          .select('id')
          .eq('makeup_session_id', selectedSession.id)
          .maybeSingle();
        
        if (linkedSession) {
          await supabase
            .from('sessions')
            .update({ attendance_mode: 'online', session_link: scheduleForm.sessionLink } as any)
            .eq('id', linkedSession.id);
        }
      }

      // Send notification to student
      await notificationService.create({
        user_id: selectedSession.student_id,
        title: 'Makeup Session Scheduled',
        title_ar: 'تم جدولة سيشن تعويضية',
        message: `Your makeup session for "${selectedSession.group_name}" has been scheduled on ${scheduleForm.date} at ${scheduleForm.time}. Please confirm or reject.`,
        message_ar: `تم جدولة سيشن تعويضية لمجموعة "${selectedSession.group_name}" في ${scheduleForm.date} الساعة ${scheduleForm.time}. يرجى التأكيد أو الرفض.`,
        type: 'info',
        category: 'makeup_session',
        action_url: '/my-makeup-sessions',
      });

      // Send notification to assigned instructor
      if (scheduleForm.instructorId) {
        const instructor = instructors.find(i => i.user_id === scheduleForm.instructorId);
        const instructorName = instructor ? (language === 'ar' ? (instructor.full_name_ar || instructor.full_name) : instructor.full_name) : '';
        await notificationService.create({
          user_id: scheduleForm.instructorId,
          title: 'Makeup Session Assigned',
          title_ar: 'تم تعيينك لسيشن تعويضية',
          message: `You have been assigned a makeup session for "${selectedSession.group_name}" student "${selectedSession.student_name}" on ${scheduleForm.date} at ${scheduleForm.time}.`,
          message_ar: `تم تعيينك لسيشن تعويضية لمجموعة "${selectedSession.group_name}" للطالب "${selectedSession.student_name}" في ${scheduleForm.date} الساعة ${scheduleForm.time}.`,
          type: 'info',
          category: 'makeup_session',
          action_url: '/makeup-sessions',
        });
      }

      toast({ title: isRTL ? 'تم الجدولة' : 'Scheduled', description: isRTL ? 'تم جدولة السيشن التعويضية - في انتظار تأكيد الطالب' : 'Makeup session scheduled - awaiting student confirmation' });
      setScheduleDialogOpen(false);
      fetchMakeupSessions();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error' });
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      if (newStatus === 'completed') {
        // Find linked session and use complete_makeup_session RPC
        const { data: linkedSession } = await supabase
          .from('sessions')
          .select('id')
          .eq('makeup_session_id', id)
          .maybeSingle();

        if (linkedSession) {
          const { error } = await supabase.rpc('complete_makeup_session', {
            p_session_id: linkedSession.id,
          });
          if (error) throw error;
        } else {
          // Fallback: no linked session yet, update makeup directly
          const session = makeupSessions.find(m => m.id === id);
          const { error } = await supabase.from('makeup_sessions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id);
          if (error) throw error;
          if (session?.original_session_id) {
            await supabase
              .from('attendance')
              .update({ compensation_status: 'compensated', makeup_session_id: id })
              .eq('session_id', session.original_session_id)
              .eq('student_id', session.student_id)
              .eq('status', 'absent');
          }
        }
      } else {
        // For expired/cancelled - direct update
        const { error } = await supabase.from('makeup_sessions').update({ status: newStatus }).eq('id', id);
        if (error) throw error;
      }

      toast({ title: isRTL ? 'تم التحديث' : 'Updated' });
      fetchMakeupSessions();
    } catch (error) {
      console.error(error);
    }
  };

  const getStatusBadge = (status: string) => getMakeupStatusBadge(status, isRTL);

  const getConfirmationBadge = (confirmed: boolean | null) => {
    if (confirmed === null) return <Badge variant="outline" className="text-muted-foreground">{isRTL ? 'في الانتظار' : 'Awaiting'}</Badge>;
    if (confirmed) return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{isRTL ? 'مؤكد' : 'Confirmed'}</Badge>;
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">{isRTL ? 'مرفوض' : 'Rejected'}</Badge>;
  };

  const getReasonBadge = (reason: string) => {
    if (reason === 'group_cancelled') {
      return <Badge variant="outline" className="text-red-600 border-red-300">{isRTL ? 'إلغاء مجموعة' : 'Group Cancelled'}</Badge>;
    }
    return <Badge variant="outline" className="text-orange-600 border-orange-300">{isRTL ? 'غياب طالب' : 'Student Absent'}</Badge>;
  };

  const filtered = makeupSessions.filter(m => {
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    const matchesReason = reasonFilter === 'all' || m.reason === reasonFilter;
    const matchesType = typeFilter === 'all' || m.makeup_type === typeFilter;
    const matchesSearch = m.student_name.toLowerCase().includes(searchQuery.toLowerCase()) || m.group_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesReason && matchesType && matchesSearch;
  });

  // Group filtered sessions into sections
  const actionRequired = filtered.filter(m => m.status === 'pending' || (m.status === 'scheduled' && m.student_confirmed === null));
  const scheduled = filtered.filter(m => m.status === 'scheduled' && m.student_confirmed !== null);
  const completedExpired = filtered.filter(m => m.status === 'completed' || m.status === 'expired' || m.status === 'cancelled');

  const getRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return isRTL ? 'اليوم' : 'Today';
    if (diffDays === 1) return isRTL ? 'أمس' : 'Yesterday';
    if (diffDays < 7) return isRTL ? `منذ ${diffDays} أيام` : `${diffDays} days ago`;
    if (diffDays < 30) return isRTL ? `منذ ${Math.floor(diffDays / 7)} أسابيع` : `${Math.floor(diffDays / 7)} weeks ago`;
    return isRTL ? `منذ ${Math.floor(diffDays / 30)} شهور` : `${Math.floor(diffDays / 30)} months ago`;
  };

  const stats = {
    pending: makeupSessions.filter(m => m.status === 'pending').length,
    scheduled: makeupSessions.filter(m => m.status === 'scheduled').length,
    completed: makeupSessions.filter(m => m.status === 'completed').length,
    awaitingConfirmation: makeupSessions.filter(m => m.status === 'scheduled' && m.student_confirmed === null).length,
    responseRate: makeupSessions.filter(m => m.status === 'scheduled').length > 0
      ? Math.round((makeupSessions.filter(m => m.status === 'scheduled' && m.student_confirmed !== null).length / makeupSessions.filter(m => m.status === 'scheduled').length) * 100)
      : 0,
  };

  return (
    <DashboardLayout title={isRTL ? 'السيشنات التعويضية' : 'Makeup Sessions'}>
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title={isRTL ? 'السيشنات التعويضية' : 'Makeup Sessions'}
          subtitle={isRTL ? `${makeupSessions.length} سيشن تعويضية` : `${makeupSessions.length} makeup sessions`}
          icon={CalendarClock}
          gradient="from-violet-500 to-purple-600"
        />

        {/* Stats */}
        <StatsGrid
          columns={5}
          stats={[
            { label: isRTL ? 'معلق' : 'Pending', value: stats.pending, icon: AlertTriangle, gradient: 'from-amber-500 to-orange-500' },
            { label: isRTL ? 'مجدول' : 'Scheduled', value: stats.scheduled, icon: Calendar, gradient: 'from-blue-500 to-blue-600' },
            { label: isRTL ? 'مكتمل' : 'Completed', value: stats.completed, icon: CheckCircle, gradient: 'from-emerald-500 to-emerald-600' },
            { label: isRTL ? 'بانتظار التأكيد' : 'Awaiting Confirm', value: stats.awaitingConfirmation, icon: UserCheck, gradient: 'from-purple-500 to-purple-600' },
            { label: isRTL ? 'نسبة الاستجابة' : 'Response Rate', value: `${stats.responseRate}%`, icon: Timer, gradient: 'from-indigo-500 to-indigo-600' },
          ]}
        />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={isRTL ? 'بحث...' : 'Search...'} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'كل الحالات' : 'All Status'}</SelectItem>
              <SelectItem value="pending">{isRTL ? 'معلق' : 'Pending'}</SelectItem>
              <SelectItem value="scheduled">{isRTL ? 'مجدول' : 'Scheduled'}</SelectItem>
              <SelectItem value="completed">{isRTL ? 'مكتمل' : 'Completed'}</SelectItem>
              <SelectItem value="cancelled">{isRTL ? 'ملغي' : 'Cancelled'}</SelectItem>
              <SelectItem value="expired">{isRTL ? 'منتهي' : 'Expired'}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={reasonFilter} onValueChange={setReasonFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'كل الأسباب' : 'All Reasons'}</SelectItem>
              <SelectItem value="group_cancelled">{isRTL ? 'إلغاء مجموعة' : 'Group Cancelled'}</SelectItem>
              <SelectItem value="student_absent">{isRTL ? 'غياب طالب' : 'Student Absent'}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'كل الأنواع' : 'All Types'}</SelectItem>
              <SelectItem value="individual">{isRTL ? 'فردية' : 'Individual'}</SelectItem>
              <SelectItem value="group_cancellation">{isRTL ? 'إلغاء جماعي' : 'Group Cancellation'}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sectioned View */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{isRTL ? 'لا توجد سيشنات تعويضية' : 'No makeup sessions found'}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Action Required Section */}
            {actionRequired.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  {isRTL ? `تحتاج إجراء (${actionRequired.length})` : `Action Required (${actionRequired.length})`}
                </h3>
                <div className="grid gap-3">
                  {actionRequired.map(session => (
                    <Card key={session.id} className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{session.student_name}</span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-sm text-muted-foreground">{session.group_name}</span>
                              {getStatusBadge(session.status)}
                              {session.status === 'scheduled' && getConfirmationBadge(session.student_confirmed)}
                              {getReasonBadge(session.reason)}
                              {session.is_free ? (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{isRTL ? 'مجاني' : 'Free'}</Badge>
                              ) : (
                                <Badge variant="outline">{isRTL ? 'مدفوع' : 'Paid'}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Timer className="h-3 w-3" />
                                {getRelativeTime(session.created_at)}
                              </span>
                              {session.scheduled_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {session.scheduled_date} {session.scheduled_time}
                                </span>
                              )}
                              {session.instructor_name !== '-' && (
                                <span>{isRTL ? 'المدرب:' : 'Instructor:'} {session.instructor_name}</span>
                              )}
                            </div>
                          </div>
                          {role === 'admin' && (
                            <div className="flex gap-1 shrink-0">
                              <Button size="sm" onClick={() => handleSchedule(session)}>
                                <Calendar className="h-3 w-3 mr-1" />
                                {isRTL ? 'جدولة' : 'Schedule'}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleUpdateStatus(session.id, 'expired')}>
                                <XCircle className="h-3 w-3 mr-1" />
                                {isRTL ? 'إنهاء' : 'Expire'}
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Scheduled Section */}
            {scheduled.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  {isRTL ? `مجدولة (${scheduled.length})` : `Scheduled (${scheduled.length})`}
                </h3>
                <div className="grid gap-3">
                  {scheduled.map(session => (
                    <Card key={session.id} className="border-blue-200 dark:border-blue-800">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{session.student_name}</span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-sm text-muted-foreground">{session.group_name}</span>
                              {getConfirmationBadge(session.student_confirmed)}
                              {session.is_free ? (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{isRTL ? 'مجاني' : 'Free'}</Badge>
                              ) : (
                                <Badge variant="outline">{isRTL ? 'مدفوع' : 'Paid'}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {session.scheduled_date} {session.scheduled_time}
                              </span>
                              <span>{isRTL ? 'المدرب:' : 'Instructor:'} {session.instructor_name}</span>
                            </div>
                          </div>
                          {role === 'admin' && (
                            <div className="flex gap-1 shrink-0">
                              <Button size="sm" variant="outline" onClick={() => handleSchedule(session)}>
                                <Calendar className="h-3 w-3 mr-1" />
                                {isRTL ? 'إعادة جدولة' : 'Reschedule'}
                              </Button>
                              {session.student_confirmed === true && (
                                <Button size="sm" onClick={() => handleUpdateStatus(session.id, 'completed')}>
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  {isRTL ? 'مكتمل' : 'Complete'}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Completed/Expired Section */}
            {completedExpired.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  {isRTL ? `مكتملة ومنتهية (${completedExpired.length})` : `Completed & Expired (${completedExpired.length})`}
                </h3>
                <div className="grid gap-2">
                  {completedExpired.map(session => (
                    <Card key={session.id} className="opacity-75">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{session.student_name}</span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">{session.group_name}</span>
                            {getStatusBadge(session.status)}
                            {session.is_free ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">{isRTL ? 'مجاني' : 'Free'}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">{isRTL ? 'مدفوع' : 'Paid'}</Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{getRelativeTime(session.created_at)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Schedule Dialog */}
        <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isRTL ? 'جدولة سيشن تعويضية' : 'Schedule Makeup Session'}</DialogTitle>
              <DialogDescription>
                {selectedSession && `${selectedSession.student_name} - ${selectedSession.group_name}`}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>{isRTL ? 'المدرب' : 'Instructor'}</Label>
                <Select value={scheduleForm.instructorId} onValueChange={v => setScheduleForm(f => ({ ...f, instructorId: v }))}>
                  <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر مدرب' : 'Select instructor'} /></SelectTrigger>
                  <SelectContent>
                    {instructors.map(inst => (
                      <SelectItem key={inst.user_id} value={inst.user_id}>
                        {language === 'ar' ? (inst.full_name_ar || inst.full_name) : inst.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{isRTL ? 'التاريخ' : 'Date'}</Label>
                <Input type="date" value={scheduleForm.date} onChange={e => setScheduleForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>{isRTL ? 'الوقت' : 'Time'}</Label>
                <Input type="time" value={scheduleForm.time} onChange={e => setScheduleForm(f => ({ ...f, time: e.target.value }))} />
              </div>
              {instructorConflicts.length > 0 && (
                <div className="p-3 rounded-lg border border-destructive bg-destructive/10">
                  <p className="text-sm font-medium text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    {isRTL ? 'تعارض مع سيشنات أخرى:' : 'Conflicts with other sessions:'}
                  </p>
                  <ul className="text-sm text-destructive mt-1">
                    {instructorConflicts.map((c, i) => <li key={i}>• {c}</li>)}
                  </ul>
                </div>
              )}
              <div className="grid gap-2">
                <Label>{isRTL ? 'نوع الحضور' : 'Attendance Mode'}</Label>
                <Select value={scheduleForm.attendanceMode} onValueChange={v => setScheduleForm(f => ({ ...f, attendanceMode: v, sessionLink: v === 'offline' ? '' : f.sessionLink }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offline">{isRTL ? 'حضوري' : 'Offline'}</SelectItem>
                    <SelectItem value="online">{isRTL ? 'أونلاين' : 'Online'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {scheduleForm.attendanceMode === 'online' && (
                <div className="grid gap-2">
                  <Label>{isRTL ? 'لينك السيشن' : 'Session Link'}</Label>
                  <Input
                    value={scheduleForm.sessionLink}
                    onChange={e => setScheduleForm(f => ({ ...f, sessionLink: e.target.value }))}
                    placeholder="https://zoom.us/j/..."
                    type="url"
                  />
                </div>
              )}
              <div className="grid gap-2">
                <Label>{isRTL ? 'ملاحظات' : 'Notes'}</Label>
                <Textarea value={scheduleForm.notes} onChange={e => setScheduleForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
              <Button 
                className="kojo-gradient" 
                onClick={handleSaveSchedule}
                disabled={instructorConflicts.length > 0}
              >
                {isRTL ? 'جدولة' : 'Schedule'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
