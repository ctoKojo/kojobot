import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MoreHorizontal, Pencil, Trash2, Calendar, Clock, RefreshCw, CheckCircle, Users, ChevronDown, FolderOpen, Snowflake, Eye, AlertTriangle, Video, Globe, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getCairoToday, getCairoDateOffset } from '@/lib/timeUtils';
import { SessionTimeDisplay } from '@/components/shared/SessionTimeDisplay';
import { logUpdate, logDelete } from '@/lib/activityLogger';
import { isSessionEndedCairo } from '@/lib/sessionTimeGuard';
import { getSessionStatusBadge } from '@/lib/statusBadges';
import { resolveSessions, getMakeupBadgeText, type ResolvedSession } from '@/lib/sessionResolver';

type Session = ResolvedSession;

// Helper: display content_number as primary, session_number as secondary when different
const getSessionLabel = (session: { content_number: number | null; session_number: number | null }, isRTL: boolean) => {
  const content = session.content_number ?? session.session_number;
  const internal = session.session_number;
  const showInternal = internal !== null && content !== null && internal !== content;
  if (isRTL) {
    return showInternal ? `محتوى ${content} (#${internal})` : `سيشن ${content}`;
  }
  return showInternal ? `Content ${content} (#${internal})` : `#${content}`;
};

interface Group {
  id: string;
  name: string;
  name_ar: string;
  schedule_day: string;
  schedule_time: string;
  status: string;
}

export default function SessionsPage() {
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [formData, setFormData] = useState({
    topic: '',
    status: 'scheduled',
    notes: '',
    session_date: '',
    session_time: '',
  });
  const [makeupDialogOpen, setMakeupDialogOpen] = useState(false);
  const [pendingCancelSession, setPendingCancelSession] = useState<Session | null>(null);
  const [creatingMakeup, setCreatingMakeup] = useState(false);
  const [repairing, setRepairing] = useState(false);
  
  // Online mode dialog
  const [onlineDialogOpen, setOnlineDialogOpen] = useState(false);
  const [onlineSession, setOnlineSession] = useState<Session | null>(null);
  const [sessionLink, setSessionLink] = useState('');

  useEffect(() => {
    fetchData();
  }, [role, user]);

  const fetchData = async () => {
    try {
      let groupsQuery = supabase
        .from('groups')
        .select('id, name, name_ar, schedule_day, schedule_time, status')
        .eq('is_active', true);

      if (role === 'instructor' && user) {
        groupsQuery = groupsQuery.eq('instructor_id', user.id);
      }

      const { data: groupsData } = await groupsQuery;
      setGroups(groupsData || []);

      // 1. Fetch raw original sessions
      let sessionsQuery = supabase
        .from('sessions')
        .select('*')
        .order('session_number', { ascending: true });

      if (role === 'instructor' && user && groupsData) {
        const groupIds = groupsData.map((g) => g.id);
        if (groupIds.length > 0) {
          sessionsQuery = sessionsQuery.in('group_id', groupIds);
        }
      }

      const { data: sessionsData } = await sessionsQuery;

      // 2. Fetch confirmed makeup overrides
      let makeupQuery = supabase
        .from('makeup_sessions')
        .select(
          'id, group_id, scheduled_date, scheduled_time, status, notes, assigned_instructor_id, original_session_id, student_id, student_confirmed'
        )
        .eq('student_confirmed', true)
        .in('status', ['scheduled', 'completed']);

      if (role === 'instructor' && user) {
        makeupQuery = makeupQuery.eq('assigned_instructor_id', user.id);
      }

      const { data: makeupData } = await makeupQuery;

      // 3. For makeups whose original isn't in the session list (e.g. instructor
      //    only sees their own groups but the makeup belongs to another group),
      //    pull originals metadata so we can still surface them.
      const knownIds = new Set((sessionsData || []).map((s: any) => s.id));
      const orphanIds = Array.from(
        new Set(
          (makeupData || [])
            .map((m: any) => m.original_session_id)
            .filter((id: string) => id && !knownIds.has(id))
        )
      );
      const originalsLookup = new Map<string, any>();
      if (orphanIds.length > 0) {
        const { data: orphans } = await supabase
          .from('sessions')
          .select(
            'id, group_id, session_number, content_number, duration_minutes, attendance_mode, session_link, topic, topic_ar'
          )
          .in('id', orphanIds);
        (orphans || []).forEach((o: any) => originalsLookup.set(o.id, o));
      }

      // 4. Resolve: original + override → single logical session per row.
      const resolved = resolveSessions(
        (sessionsData || []) as any,
        (makeupData || []) as any,
        { originalsLookup }
      );

      setSessions(resolved);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSessions = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-sessions');
      
      if (error) throw error;
      
      toast({
        title: t.common.success,
        description: isRTL 
          ? `تم إنشاء ${data.created} سيشن جديد` 
          : `Created ${data.created} new sessions`,
      });
      
      fetchData();
    } catch (error) {
      console.error('Error generating sessions:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في توليد السيشنات' : 'Failed to generate sessions',
      });
    } finally {
      setGenerating(false);
    }
  };

  const repairOrphanedSessions = async () => {
    setRepairing(true);
    try {
      const { data, error } = await supabase.rpc('repair_orphaned_sessions');
      if (error) throw error;
      const result = data as any;
      toast({
        title: isRTL ? 'تم الإصلاح' : 'Repair Complete',
        description: isRTL
          ? `تم إصلاح ${result?.fixed || 0} سيشن مفقودة`
          : `Fixed ${result?.fixed || 0} orphaned sessions`,
      });
      if (result?.fixed > 0) fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: error.message,
      });
    } finally {
      setRepairing(false);
    }
  };

  const handleEdit = (session: Session) => {
    setEditingSession(session);
    setFormData({
      topic: session.topic || '',
      status: session.status,
      notes: session.notes || '',
      session_date: session.session_date,
      session_time: session.session_time,
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingSession) return;
    
    // If changing to cancelled, show makeup dialog
    if (formData.status === 'cancelled' && editingSession.status !== 'cancelled') {
      setPendingCancelSession(editingSession);
      setIsEditDialogOpen(false);
      setMakeupDialogOpen(true);
      return;
    }

    await saveSessionUpdate();
  };

  const saveSessionUpdate = async () => {
    if (!editingSession) return;
    
    try {
      const dateChanged = formData.session_date !== editingSession.session_date;
      const timeChanged = formData.session_time !== editingSession.session_time;

      const { error } = await supabase
        .from('sessions')
        .update({
          topic: formData.topic || null,
          topic_ar: formData.topic || null,
          status: formData.status,
          notes: formData.notes || null,
          session_date: formData.session_date,
          session_time: formData.session_time,
        })
        .eq('id', editingSession.id);

      if (error) throw error;
      
      await logUpdate('session', editingSession.id, {
        session_number: editingSession.session_number,
        changes: { 
          topic: formData.topic, 
          status: formData.status,
          date: dateChanged ? { from: editingSession.session_date, to: formData.session_date } : undefined,
          time: timeChanged ? { from: editingSession.session_time, to: formData.session_time } : undefined,
        },
      });

      // Send notification to students if date/time changed
      if (dateChanged || timeChanged) {
        const { data: groupData } = await supabase
          .from('groups')
          .select('name, name_ar')
          .eq('id', editingSession.group_id)
          .single();

        if (groupData) {
          const { data: groupStudents } = await supabase
            .from('group_students')
            .select('student_id')
            .eq('group_id', editingSession.group_id)
            .eq('is_active', true);

          if (groupStudents && groupStudents.length > 0) {
            const notifications = groupStudents.map(gs => ({
user_id: gs.student_id,
              title: 'Session Rescheduled',
              title_ar: 'تم تغيير موعد السيشن',
              message: `Content ${editingSession.content_number ?? editingSession.session_number} for "${groupData.name}" has been moved to ${formData.session_date} at ${formData.session_time}`,
              message_ar: `محتوى ${editingSession.content_number ?? editingSession.session_number} لمجموعة "${groupData.name_ar}" تم نقلها إلى ${formData.session_date} الساعة ${formData.session_time}`,
              type: 'warning',
              category: 'session',
              action_url: `/session/${editingSession.id}`,
            }));

            await supabase.from('notifications').insert(notifications);
          }
        }
      }
      
      toast({
        title: t.common.success,
        description: isRTL ? 'تم تحديث السيشن' : 'Session updated successfully',
      });
      
      setIsEditDialogOpen(false);
      setEditingSession(null);
      fetchData();
    } catch (error) {
      console.error('Error updating session:', error);
      toast({ variant: 'destructive', title: t.common.error, description: isRTL ? 'فشل في تحديث السيشن' : 'Failed to update session' });
    }
  };

  const handleCancelWithMakeup = async (createMakeup: boolean) => {
    if (!pendingCancelSession) return;
    setCreatingMakeup(true);

    try {
      // Cancel the session
      await supabase.from('sessions').update({ status: 'cancelled' }).eq('id', pendingCancelSession.id);

      if (createMakeup) {
        const { data: groupStudents } = await supabase
          .from('group_students')
          .select('student_id')
          .eq('group_id', pendingCancelSession.group_id)
          .eq('is_active', true);

        if (groupStudents && groupStudents.length > 0) {
          const studentIds = groupStudents.map(gs => gs.student_id);
          const { data, error } = await supabase.rpc('create_group_makeup_sessions', {
            p_student_ids: studentIds,
            p_original_session_id: pendingCancelSession.id,
            p_group_id: pendingCancelSession.group_id,
            p_reason: 'group_cancelled',
            p_makeup_type: 'group_cancellation',
          });

          const result = data as any;
          toast({
            title: t.common.success,
            description: isRTL
              ? `تم إلغاء السيشن وإنشاء ${result?.created_count || 0} سيشن تعويضية`
              : `Session cancelled and ${result?.created_count || 0} makeup sessions created`,
          });
        }
      } else {
        toast({ title: t.common.success, description: isRTL ? 'تم إلغاء السيشن' : 'Session cancelled' });
      }

      setMakeupDialogOpen(false);
      setPendingCancelSession(null);
      setEditingSession(null);
      fetchData();
    } catch (error) {
      console.error('Error:', error);
      toast({ variant: 'destructive', title: t.common.error });
    } finally {
      setCreatingMakeup(false);
    }
  };

  const handleMarkComplete = async (session: Session) => {
    // Cairo time guard — block completion before session end
    if (!isSessionEndedCairo(session.session_date, session.session_time, session.duration_minutes)) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'السيشن لسه ما خلصتش' : "Session hasn't ended yet",
        description: isRTL
          ? 'لا يمكن اكتمال السيشن قبل انتهاء وقتها بتوقيت القاهرة'
          : 'Cannot complete session before its end time (Cairo)',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'completed' })
        .eq('id', session.id);

      if (error) throw error;
      
      // Log activity
      await logUpdate('session', session.id, {
        session_number: session.session_number,
        action: 'marked_complete',
        previous_status: session.status,
      });
      
      toast({
        title: t.common.success,
        description: isRTL ? 'تم تحديث حالة السيشن' : 'Session marked as completed',
      });
      
      fetchData();
    } catch (error) {
      console.error('Error updating session:', error);
    }
  };

  const handleDelete = async (id: string) => {
    // Find session info before deleting for logging
    const sessionToDelete = sessions.find(s => s.id === id);
    
    try {
      const { error } = await supabase.from('sessions').delete().eq('id', id);
      if (error) throw error;
      
      // Log activity
      await logDelete('session', id, {
        session_number: sessionToDelete?.session_number,
        session_date: sessionToDelete?.session_date,
        group_id: sessionToDelete?.group_id,
      });
      
      toast({
        title: t.common.success,
        description: isRTL ? 'تم حذف السيشن' : 'Session deleted successfully',
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting session:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في حذف السيشن' : 'Failed to delete session',
      });
    }
  };

  const handleOpenOnlineDialog = (session: Session) => {
    setOnlineSession(session);
    setSessionLink('');
    setOnlineDialogOpen(true);
  };

  const handleConvertToOnline = async () => {
    if (!onlineSession || !sessionLink.trim()) return;
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ attendance_mode: 'online', session_link: sessionLink.trim() } as any)
        .eq('id', onlineSession.id);
      if (error) throw error;

      // Send notification to students
      const { data: groupData } = await supabase
        .from('groups')
        .select('name, name_ar')
        .eq('id', onlineSession.group_id)
        .single();

      if (groupData) {
        const { data: groupStudents } = await supabase
          .from('group_students')
          .select('student_id')
          .eq('group_id', onlineSession.group_id)
          .eq('is_active', true);

        if (groupStudents && groupStudents.length > 0) {
          const notifications = groupStudents.map(gs => ({
            user_id: gs.student_id,
            title: 'Session Moved Online',
            title_ar: 'تم تحويل السيشن لأونلاين',
            message: `Session ${onlineSession.session_number} for "${groupData.name}" on ${onlineSession.session_date} will be online.`,
            message_ar: `سيشن ${onlineSession.session_number} لمجموعة "${groupData.name_ar}" في ${onlineSession.session_date} ستكون أونلاين.`,
            type: 'info',
            category: 'session',
            action_url: `/session/${onlineSession.id}`,
          }));
          await supabase.from('notifications').insert(notifications);
        }
      }

      toast({
        title: t.common.success,
        description: isRTL ? 'تم تحويل السيشن لأونلاين' : 'Session converted to online',
      });
      setOnlineDialogOpen(false);
      setOnlineSession(null);
      fetchData();
    } catch (error) {
      console.error('Error:', error);
      toast({ variant: 'destructive', title: t.common.error });
    }
  };

  const getStatusBadge = (status: string) => getSessionStatusBadge(status, language);

  const isToday = (dateStr: string) => {
    return dateStr === getCairoToday();
  };

  const isTomorrow = (dateStr: string) => {
    return dateStr === getCairoDateOffset(1);
  };

  // Time filter helper
  const isThisWeek = (dateStr: string) => {
    const today = getCairoToday();
    const todayDate = new Date(`${today}T12:00:00Z`);
    const dayOfWeek = todayDate.getUTCDay(); // 0=Sun
    const startOfWeek = new Date(todayDate);
    startOfWeek.setUTCDate(todayDate.getUTCDate() - dayOfWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 7);

    const target = new Date(`${dateStr}T12:00:00Z`);
    return target >= startOfWeek && target < endOfWeek;
  };

  const isUpcoming = (dateStr: string) => {
    return dateStr >= getCairoToday();
  };

  const isOverdue = (session: Session) => {
    return session.status === 'scheduled' && session.session_date < getCairoToday();
  };

  // Filter sessions based on search, status, and time
  const getFilteredSessionsForGroup = (groupId: string) => {
    return sessions.filter((session) => {
      if (session.group_id !== groupId) return false;
      
      const matchesSearch = 
        session.topic?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.topic_ar?.includes(searchQuery) ||
        session.session_date.includes(searchQuery);
      const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
      
      let matchesTime = true;
      if (timeFilter === 'today') matchesTime = isToday(session.session_date);
      else if (timeFilter === 'tomorrow') matchesTime = isTomorrow(session.session_date);
      else if (timeFilter === 'week') matchesTime = isThisWeek(session.session_date);
      else if (timeFilter === 'upcoming') matchesTime = isUpcoming(session.session_date);
      else if (timeFilter === 'overdue') matchesTime = isOverdue(session);
      
      return matchesSearch && matchesStatus && matchesTime;
    });
  };

  // Today's sessions across all groups (exclude cancelled)
  const todaySessions = useMemo(() => {
    const today = getCairoToday();
    return sessions
      .filter(s => s.session_date === today && s.status !== 'cancelled')
      .map(s => ({
        ...s,
        groupName: (() => {
          const g = groups.find(gr => gr.id === s.group_id);
          return g ? (language === 'ar' ? g.name_ar : g.name) : '-';
        })(),
      }));
  }, [sessions, groups, language]);

  // Overdue sessions
  const overdueSessions = useMemo(() => {
    const today = getCairoToday();
    return sessions.filter(s => s.status === 'scheduled' && s.session_date < today);
  }, [sessions]);

  // Get session stats for a group (exclude cancelled from totals & today)
  const getGroupStats = (groupId: string) => {
    const groupSessions = sessions.filter(s => s.group_id === groupId && s.status !== 'cancelled');
    const completed = groupSessions.filter(s => s.status === 'completed').length;
    const total = groupSessions.length;
    const todaySession = groupSessions.find(s => isToday(s.session_date));
    return { completed, total, todaySession };
  };
  // Check if a group allows management (not frozen for non-admin)
  const canManageGroup = (group: Group) => {
    if (role === 'admin' || role === 'reception') return true;
    if (role === 'instructor' && group.status !== 'frozen') return true;
    return false;
  };

  const canManage = role === 'admin' || role === 'instructor' || role === 'reception';

  // Get groups that have sessions matching the filter
  const filteredGroups = groups.filter(group => {
    const groupSessions = getFilteredSessionsForGroup(group.id);
    return groupSessions.length > 0 || (searchQuery === '' && statusFilter === 'all' && timeFilter === 'all');
  });

  return (
    <DashboardLayout title={t.groups.sessions}>
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title={t.groups.sessions}
          subtitle={isRTL ? `${sessions.length} سيشن في ${groups.length} مجموعة` : `${sessions.length} sessions across ${groups.length} groups`}
          icon={Calendar}
          gradient="from-indigo-500 to-purple-600"
          actions={role === 'admin' ? (
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={repairOrphanedSessions}
                disabled={repairing}
                size="sm"
              >
                <Wrench className={`h-4 w-4 me-2 ${repairing ? 'animate-spin' : ''}`} />
                {isRTL ? 'إصلاح سيشنات مفقودة' : 'Repair Missing'}
              </Button>
              <Button 
                className="kojo-gradient" 
                onClick={generateSessions}
                disabled={generating}
              >
                <RefreshCw className={`h-4 w-4 me-2 ${generating ? 'animate-spin' : ''}`} />
                {isRTL ? 'توليد السيشنات' : 'Generate Sessions'}
              </Button>
            </div>
          ) : undefined}
        />
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.common.search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={isRTL ? 'كل الحالات' : 'All Status'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? 'كل الحالات' : 'All Status'}</SelectItem>
                <SelectItem value="scheduled">{isRTL ? 'مجدول' : 'Scheduled'}</SelectItem>
                <SelectItem value="completed">{isRTL ? 'مكتمل' : 'Completed'}</SelectItem>
                <SelectItem value="cancelled">{isRTL ? 'ملغي' : 'Cancelled'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

        {/* Quick Time Filters */}
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all', label: isRTL ? 'الكل' : 'All' },
            { key: 'today', label: isRTL ? 'اليوم' : 'Today' },
            { key: 'tomorrow', label: isRTL ? 'غداً' : 'Tomorrow' },
            { key: 'week', label: isRTL ? 'هذا الأسبوع' : 'This Week' },
            { key: 'upcoming', label: isRTL ? 'القادم' : 'Upcoming' },
            ...(overdueSessions.length > 0 ? [{ key: 'overdue', label: isRTL ? 'متأخرة' : 'Overdue' }] : []),
          ].map(f => {
            const count = f.key === 'today' ? todaySessions.length
              : f.key === 'tomorrow' ? sessions.filter(s => isTomorrow(s.session_date) && s.status !== 'cancelled').length
              : f.key === 'overdue' ? overdueSessions.length
              : 0;
            return (
              <Button
                key={f.key}
                variant={timeFilter === f.key ? (f.key === 'overdue' ? 'destructive' : 'default') : 'outline'}
                size="sm"
                onClick={() => setTimeFilter(f.key)}
                className={f.key === 'overdue' && timeFilter !== 'overdue' ? 'border-destructive text-destructive hover:bg-destructive/10' : ''}
              >
                {f.key === 'overdue' && <AlertTriangle className="h-3 w-3 me-1" />}
                {f.label}
                {count > 0 && (
                  <Badge variant={f.key === 'overdue' ? 'destructive' : 'secondary'} className="ms-1 text-xs">{count}</Badge>
                )}
              </Button>
            );
          })}
        </div>

        {/* Today's Sessions Bar */}
        {todaySessions.length > 0 && timeFilter === 'all' && (
          <Card className="relative overflow-hidden border-0 shadow-md">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-secondary/5" />
            <CardContent className="relative pt-4 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-secondary">
                  <Calendar className="h-4 w-4 text-white" />
                </div>
                <h3 className="font-semibold text-sm">{isRTL ? `سيشنات اليوم (${todaySessions.length})` : `Today's Sessions (${todaySessions.length})`}</h3>
              </div>
              <div className="flex gap-2 flex-wrap">
                {todaySessions.map(s => (
                  <Badge 
                    key={s.id} 
                    variant="outline" 
                    className="cursor-pointer hover:bg-primary/10 hover:shadow-sm transition-all py-1.5 px-3"
                    onClick={() => navigate(`/session/${s.id}`)}
                  >
                    <span className="font-medium">{s.groupName}</span>
                    <span className="text-muted-foreground ml-2"><SessionTimeDisplay sessionDate={s.session_date} sessionTime={s.session_time} isRTL={isRTL} /></span>
                    {s.status === 'completed' && <CheckCircle className="h-3 w-3 ml-1 text-green-600" />}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {isRTL ? 'تعديل السيشن' : 'Edit Session'}
              </DialogTitle>
              <DialogDescription>
                {isRTL ? 'تعديل تفاصيل السيشن' : 'Update session details'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {editingSession?.status === 'scheduled' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>{isRTL ? 'التاريخ' : 'Date'}</Label>
                      <Input
                        type="date"
                        value={formData.session_date}
                        onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{isRTL ? 'الوقت' : 'Time'}</Label>
                      <Input
                        type="time"
                        value={formData.session_time}
                        onChange={(e) => setFormData({ ...formData, session_time: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="grid gap-2">
                <Label>{isRTL ? 'الحالة' : 'Status'}</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">{isRTL ? 'مجدول' : 'Scheduled'}</SelectItem>
                    <SelectItem value="completed">{isRTL ? 'مكتمل' : 'Completed'}</SelectItem>
                    <SelectItem value="cancelled">{isRTL ? 'ملغي' : 'Cancelled'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{isRTL ? 'الموضوع' : 'Topic'}</Label>
                <Input
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  placeholder={isRTL ? 'مثال: مقدمة في سكراتش' : 'e.g., Introduction to Scratch'}
                />
              </div>
              <div className="grid gap-2">
                <Label>{isRTL ? 'ملاحظات' : 'Notes'}</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={isRTL ? 'ملاحظات إضافية...' : 'Additional notes...'}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button className="kojo-gradient" onClick={handleSaveEdit}>
                {t.common.save}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Makeup Session Confirmation Dialog */}
        <Dialog open={makeupDialogOpen} onOpenChange={setMakeupDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isRTL ? 'إنشاء سيشنات تعويضية؟' : 'Create Makeup Sessions?'}</DialogTitle>
              <DialogDescription>
                {isRTL 
                  ? 'هل تريد إنشاء سيشنات تعويضية لطلاب هذه المجموعة؟'
                  : 'Would you like to create makeup sessions for the students in this group?'
                }
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => handleCancelWithMakeup(false)} disabled={creatingMakeup}>
                {isRTL ? 'إلغاء فقط' : 'Cancel Only'}
              </Button>
              <Button className="kojo-gradient" onClick={() => handleCancelWithMakeup(true)} disabled={creatingMakeup}>
                {creatingMakeup ? (isRTL ? 'جاري الإنشاء...' : 'Creating...') : (isRTL ? 'إلغاء + إنشاء تعويضات' : 'Cancel + Create Makeup')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Convert to Online Dialog */}
        <Dialog open={onlineDialogOpen} onOpenChange={setOnlineDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isRTL ? 'تحويل السيشن لأونلاين' : 'Convert Session to Online'}</DialogTitle>
              <DialogDescription>
                {isRTL ? 'أدخل لينك السيشن الأونلاين' : 'Enter the online session link'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>{isRTL ? 'لينك السيشن' : 'Session Link'}</Label>
                <Input
                  value={sessionLink}
                  onChange={(e) => setSessionLink(e.target.value)}
                  placeholder="https://zoom.us/j/..."
                  type="url"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOnlineDialogOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button className="kojo-gradient" onClick={handleConvertToOnline} disabled={!sessionLink.trim()}>
                <Globe className="h-4 w-4 mr-2" />
                {isRTL ? 'تحويل لأونلاين' : 'Convert to Online'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Groups Accordion */}
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center">
              {t.common.loading}
            </CardContent>
          </Card>
        ) : filteredGroups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                {isRTL ? 'لا توجد مجموعات' : 'No groups found'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-3">
            {filteredGroups.map((group) => {
              const groupSessions = getFilteredSessionsForGroup(group.id);
              const stats = getGroupStats(group.id);

              // Find next upcoming session to show actual day/time
              const today = getCairoToday();
              const nextSession = sessions
                .filter(s => s.group_id === group.id && s.session_date >= today && s.status === 'scheduled')
                .sort((a, b) => a.session_date.localeCompare(b.session_date) || a.session_time.localeCompare(b.session_time))[0];

              // Determine display day name from actual session date (or fallback to group schedule_day)
              const displayDate = nextSession?.session_date;
              const displayTime = nextSession?.session_time || group.schedule_time;
              const displayDay = displayDate
                ? new Date(`${displayDate}T12:00:00Z`).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', timeZone: 'Africa/Cairo' })
                : (language === 'ar' ? { Sunday: 'الأحد', Monday: 'الاثنين', Tuesday: 'الثلاثاء', Wednesday: 'الأربعاء', Thursday: 'الخميس', Friday: 'الجمعة', Saturday: 'السبت' }[group.schedule_day] || group.schedule_day : group.schedule_day);
              
              return (
                <AccordionItem 
                  key={group.id} 
                  value={group.id}
                  className="border rounded-lg bg-card overflow-hidden"
                >
                  <AccordionTrigger className="px-3 sm:px-4 py-3 hover:no-underline hover:bg-muted/50 [&[data-state=open]]:bg-muted/30">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1 w-full">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FolderOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                        </div>
                        <div className="text-left min-w-0">
                          <h3 className="font-semibold text-sm sm:text-base truncate">
                            {language === 'ar' ? group.name_ar : group.name}
                          </h3>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            <SessionTimeDisplay sessionDate={displayDate || getCairoToday()} sessionTime={displayTime} isRTL={isRTL} /> - {displayDay}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap ml-11 sm:ml-0 sm:mr-4">
                        {group.status === 'frozen' && (
                          <Badge className="bg-sky-500 text-white text-xs">
                            <Snowflake className="h-3 w-3 mr-1" />
                            {isRTL ? 'مجمدة' : 'Frozen'}
                          </Badge>
                        )}
                        {stats.todaySession && (
                          <Badge variant="default" className="kojo-gradient text-xs">
                            {isRTL ? 'اليوم' : 'Today'}
                          </Badge>
                        )}
                        {/* Progress bar */}
                        <div className="hidden sm:flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full transition-all" 
                              style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">{stats.completed}/{stats.total}</span>
                        </div>
                        <Badge variant="outline" className="text-xs sm:hidden">
                          {stats.completed}/{stats.total}
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  
                  <AccordionContent className="px-0 pb-0">
                    {/* Mobile Card View */}
                    <div className="block md:hidden divide-y">
                      {groupSessions.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          {isRTL ? 'لا توجد سيشنات مطابقة' : 'No matching sessions'}
                        </div>
                      ) : (
                        groupSessions.map((session) => (
                          <div 
                            key={session.id}
                            className={`p-3 ${isToday(session.session_date) ? 'bg-primary/5' : isOverdue(session) ? 'bg-destructive/5 border-l-2 border-l-destructive' : ''} cursor-pointer hover:bg-muted/50`}
                            onClick={() => navigate(`/session/${session.id}`)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1.5 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="font-mono text-xs">
                                      {getSessionLabel(session, isRTL)}
                                    </Badge>
                                  {getStatusBadge(session.status)}
                                  {session.is_makeup && (
                                    <Badge
                                      className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 text-xs"
                                      title={
                                        session.original_date
                                          ? isRTL
                                            ? `تعويضية عن ${session.original_date} ${session.original_time}`
                                            : `Makeup of ${session.original_date} ${session.original_time}`
                                          : undefined
                                      }
                                    >
                                      {getMakeupBadgeText(session, isRTL)}
                                    </Badge>
                                  )}
                                  {isToday(session.session_date) && (
                                    <Badge variant="secondary" className="text-xs">
                                      {isRTL ? 'اليوم' : 'Today'}
                                    </Badge>
                                  )}
                                  {(session as any).attendance_mode === 'online' && (
                                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs gap-1">
                                      <Globe className="h-3 w-3" />
                                      {isRTL ? 'أونلاين' : 'Online'}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {session.session_date}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <SessionTimeDisplay sessionDate={session.session_date} sessionTime={session.session_time} isRTL={isRTL} />
                                  </span>
                                </div>
                                {(session.topic || session.topic_ar) && (
                                  <p className="text-sm truncate">
                                    {language === 'ar' 
                                      ? (session.topic_ar || session.topic)
                                      : (session.topic || session.topic_ar)
                                    }
                                  </p>
                                )}
                              </div>
                              {canManageGroup(group) && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/session/${session.id}`); }}>
                                      <Eye className="h-4 w-4 mr-2" />
                                      {isRTL ? 'تفاصيل السيشن' : 'Session Details'}
                                    </DropdownMenuItem>
                                    {session.status !== 'cancelled' && session.status === 'scheduled' && (
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMarkComplete(session); }}>
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        {isRTL ? 'تحديد كمكتمل' : 'Mark Complete'}
                                      </DropdownMenuItem>
                                    )}
                                    {session.status !== 'cancelled' && (
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(session); }}>
                                        <Pencil className="h-4 w-4 mr-2" />
                                        {t.common.edit}
                                      </DropdownMenuItem>
                                    )}
                                    {role !== 'instructor' && session.status !== 'cancelled' && session.status === 'scheduled' && (
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenOnlineDialog(session); }}>
                                        <Globe className="h-4 w-4 mr-2" />
                                        {isRTL ? 'تحويل لأونلاين' : 'Convert to Online'}
                                      </DropdownMenuItem>
                                    )}
                                    {(role === 'admin' || role === 'reception') && session.status !== 'cancelled' && (
                                      <DropdownMenuItem
                                        onClick={(e) => { e.stopPropagation(); handleDelete(session.id); }}
                                        className="text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        {t.common.delete}
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[100px]">#</TableHead>
                            <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                            <TableHead>{isRTL ? 'الوقت' : 'Time'}</TableHead>
                            <TableHead>{isRTL ? 'الموضوع' : 'Topic'}</TableHead>
                            <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                            {canManageGroup(group) && <TableHead className="w-[100px]">{t.common.actions}</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupSessions.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                                {isRTL ? 'لا توجد سيشنات مطابقة' : 'No matching sessions'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            groupSessions.map((session) => (
                              <TableRow 
                                key={session.id}
                                className={`${isToday(session.session_date) ? 'bg-primary/5' : isOverdue(session) ? 'bg-destructive/5' : ''} cursor-pointer hover:bg-muted/50`}
                                onClick={() => navigate(`/session/${session.id}`)}
                              >
                                <TableCell>
                                  <Badge variant="outline" className="font-mono">
                                    {getSessionLabel(session, isRTL)}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {session.session_date}
                                    {isToday(session.session_date) && (
                                      <Badge variant="secondary" className="text-xs">
                                        {isRTL ? 'اليوم' : 'Today'}
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    <Clock className="h-3 w-3 mr-1" />
                                    <SessionTimeDisplay sessionDate={session.session_date} sessionTime={session.session_time} isRTL={isRTL} />
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {language === 'ar' 
                                    ? (session.topic_ar || session.topic || '-')
                                    : (session.topic || session.topic_ar || '-')
                                  }
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    {getStatusBadge(session.status)}
                                    {session.is_makeup && (
                                      <Badge
                                        className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 text-xs"
                                        title={
                                          session.original_date
                                            ? isRTL
                                              ? `تعويضية عن ${session.original_date} ${session.original_time}`
                                              : `Makeup of ${session.original_date} ${session.original_time}`
                                            : undefined
                                        }
                                      >
                                        {getMakeupBadgeText(session, isRTL)}
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                {canManageGroup(group) && (
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Button 
                                        variant="ghost" 
                                        size="icon"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(`/session/${session.id}`);
                                        }}
                                        title={isRTL ? 'تفاصيل السيشن' : 'Session Details'}
                                      >
                                        <Eye className="h-4 w-4 text-primary" />
                                      </Button>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                                          {session.status !== 'cancelled' && session.status === 'scheduled' && (
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMarkComplete(session); }}>
                                              <CheckCircle className="h-4 w-4 mr-2" />
                                              {isRTL ? 'تحديد كمكتمل' : 'Mark Complete'}
                                            </DropdownMenuItem>
                                          )}
                                          {session.status !== 'cancelled' && (
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(session); }}>
                                              <Pencil className="h-4 w-4 mr-2" />
                                              {t.common.edit}
                                            </DropdownMenuItem>
                                          )}
                                          {role !== 'instructor' && session.status !== 'cancelled' && session.status === 'scheduled' && (
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenOnlineDialog(session); }}>
                                              <Globe className="h-4 w-4 mr-2" />
                                              {isRTL ? 'تحويل لأونلاين' : 'Convert to Online'}
                                            </DropdownMenuItem>
                                          )}
                                          {(role === 'admin' || role === 'reception') && session.status !== 'cancelled' && (
                                            <DropdownMenuItem
                                              onClick={(e) => { e.stopPropagation(); handleDelete(session.id); }}
                                              className="text-destructive"
                                            >
                                              <Trash2 className="h-4 w-4 mr-2" />
                                              {t.common.delete}
                                            </DropdownMenuItem>
                                          )}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </DashboardLayout>
  );
}
