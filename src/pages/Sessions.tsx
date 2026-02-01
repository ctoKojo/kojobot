import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MoreHorizontal, Pencil, Trash2, Calendar, Clock, RefreshCw, CheckCircle, Users, ChevronDown, FolderOpen, Snowflake } from 'lucide-react';
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
import { formatTime12Hour } from '@/lib/timeUtils';
import { logUpdate, logDelete } from '@/lib/activityLogger';

interface Session {
  id: string;
  group_id: string;
  session_date: string;
  session_time: string;
  duration_minutes: number;
  topic: string | null;
  topic_ar: string | null;
  status: string;
  notes: string | null;
  session_number: number | null;
}

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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [formData, setFormData] = useState({
    topic: '',
    topic_ar: '',
    status: 'scheduled',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, [role, user]);

  const fetchData = async () => {
    try {
      let groupsQuery = supabase.from('groups').select('id, name, name_ar, schedule_day, schedule_time, status').eq('is_active', true);
      
      if (role === 'instructor' && user) {
        groupsQuery = groupsQuery.eq('instructor_id', user.id);
      }

      const { data: groupsData } = await groupsQuery;
      setGroups(groupsData || []);

      let sessionsQuery = supabase.from('sessions').select('*').order('session_number', { ascending: true });

      if (role === 'instructor' && user && groupsData) {
        const groupIds = groupsData.map(g => g.id);
        if (groupIds.length > 0) {
          sessionsQuery = sessionsQuery.in('group_id', groupIds);
        }
      }

      const { data: sessionsData } = await sessionsQuery;
      setSessions(sessionsData || []);
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

  const handleEdit = (session: Session) => {
    setEditingSession(session);
    setFormData({
      topic: session.topic || '',
      topic_ar: session.topic_ar || '',
      status: session.status,
      notes: session.notes || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingSession) return;
    
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          topic: formData.topic || null,
          topic_ar: formData.topic_ar || null,
          status: formData.status,
          notes: formData.notes || null,
        })
        .eq('id', editingSession.id);

      if (error) throw error;
      
      // Log activity
      await logUpdate('session', editingSession.id, {
        session_number: editingSession.session_number,
        changes: {
          topic: formData.topic,
          status: formData.status,
        }
      });
      
      toast({
        title: t.common.success,
        description: isRTL ? 'تم تحديث السيشن' : 'Session updated successfully',
      });
      
      setIsEditDialogOpen(false);
      setEditingSession(null);
      fetchData();
    } catch (error) {
      console.error('Error updating session:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في تحديث السيشن' : 'Failed to update session',
      });
    }
  };

  const handleMarkComplete = async (session: Session) => {
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

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };

    const labels: Record<string, { en: string; ar: string }> = {
      scheduled: { en: 'Scheduled', ar: 'مجدول' },
      completed: { en: 'Completed', ar: 'مكتمل' },
      cancelled: { en: 'Cancelled', ar: 'ملغي' },
    };

    return (
      <Badge className={styles[status] || styles.scheduled}>
        {labels[status]?.[language] || status}
      </Badge>
    );
  };

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  // Filter sessions based on search and status
  const getFilteredSessionsForGroup = (groupId: string) => {
    return sessions.filter((session) => {
      if (session.group_id !== groupId) return false;
      
      const matchesSearch = 
        session.topic?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.topic_ar?.includes(searchQuery) ||
        session.session_date.includes(searchQuery);
      const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  };

  // Get session stats for a group
  const getGroupStats = (groupId: string) => {
    const groupSessions = sessions.filter(s => s.group_id === groupId);
    const completed = groupSessions.filter(s => s.status === 'completed').length;
    const total = groupSessions.length;
    const todaySession = groupSessions.find(s => isToday(s.session_date));
    return { completed, total, todaySession };
  };
  // Check if a group allows management (not frozen for non-admin)
  const canManageGroup = (group: Group) => {
    if (role === 'admin') return true;
    if (role === 'instructor' && group.status !== 'frozen') return true;
    return false;
  };

  const canManage = role === 'admin' || role === 'instructor';

  // Get groups that have sessions matching the filter
  const filteredGroups = groups.filter(group => {
    const groupSessions = getFilteredSessionsForGroup(group.id);
    return groupSessions.length > 0 || (searchQuery === '' && statusFilter === 'all');
  });

  return (
    <DashboardLayout title={t.groups.sessions}>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-4 flex-1 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.common.search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
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

          {role === 'admin' && (
            <Button 
              className="kojo-gradient" 
              onClick={generateSessions}
              disabled={generating}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
              {isRTL ? 'توليد السيشنات' : 'Generate Sessions'}
            </Button>
          )}
        </div>

        {/* Edit Dialog */}
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
                <Label>{isRTL ? 'الموضوع' : 'Topic'} (English)</Label>
                <Input
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  placeholder="e.g., Introduction to Scratch"
                />
              </div>
              <div className="grid gap-2">
                <Label>{isRTL ? 'الموضوع' : 'Topic'} (عربي)</Label>
                <Input
                  value={formData.topic_ar}
                  onChange={(e) => setFormData({ ...formData, topic_ar: e.target.value })}
                  placeholder="مثال: مقدمة في سكراتش"
                  dir="rtl"
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
                            {group.schedule_day} - {formatTime12Hour(group.schedule_time, isRTL)}
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
                        <Badge variant="outline" className="text-xs">
                          {stats.completed}/{stats.total}
                        </Badge>
                        <Badge variant="secondary" className="text-xs hidden sm:inline-flex">
                          {groupSessions.length} {isRTL ? 'سيشن' : 'sessions'}
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
                            className={`p-3 ${isToday(session.session_date) ? 'bg-primary/5' : ''} cursor-pointer hover:bg-muted/50`}
                            onClick={() => navigate(`/attendance?session=${session.id}&group=${session.group_id}`)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1.5 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="font-mono text-xs">
                                    {isRTL ? `سيشن ${session.session_number}` : `#${session.session_number}`}
                                  </Badge>
                                  {getStatusBadge(session.status)}
                                  {isToday(session.session_date) && (
                                    <Badge variant="secondary" className="text-xs">
                                      {isRTL ? 'اليوم' : 'Today'}
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
                                    {formatTime12Hour(session.session_time, isRTL)}
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
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/attendance?session=${session.id}&group=${session.group_id}`); }}>
                                      <Users className="h-4 w-4 mr-2" />
                                      {isRTL ? 'تسجيل الحضور' : 'Attendance'}
                                    </DropdownMenuItem>
                                    {session.status === 'scheduled' && (
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMarkComplete(session); }}>
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        {isRTL ? 'تحديد كمكتمل' : 'Mark Complete'}
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(session); }}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      {t.common.edit}
                                    </DropdownMenuItem>
                                    {role === 'admin' && (
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
                            {canManageGroup(group) && <TableHead className="w-[60px]"></TableHead>}
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
                                className={`${isToday(session.session_date) ? 'bg-primary/5' : ''} cursor-pointer hover:bg-muted/50`}
                                onClick={() => navigate(`/attendance?session=${session.id}&group=${session.group_id}`)}
                              >
                                <TableCell>
                                  <Badge variant="outline" className="font-mono">
                                    {isRTL ? `سيشن ${session.session_number}` : `Session ${session.session_number}`}
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
                                    {formatTime12Hour(session.session_time, isRTL)}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {language === 'ar' 
                                    ? (session.topic_ar || session.topic || '-')
                                    : (session.topic || session.topic_ar || '-')
                                  }
                                </TableCell>
                                <TableCell>{getStatusBadge(session.status)}</TableCell>
                                {canManageGroup(group) && (
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Button 
                                        variant="ghost" 
                                        size="icon"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(`/attendance?session=${session.id}&group=${session.group_id}`);
                                        }}
                                        title={isRTL ? 'تسجيل الحضور' : 'Record Attendance'}
                                      >
                                        <Users className="h-4 w-4 text-primary" />
                                      </Button>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                                          {session.status === 'scheduled' && (
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMarkComplete(session); }}>
                                              <CheckCircle className="h-4 w-4 mr-2" />
                                              {isRTL ? 'تحديد كمكتمل' : 'Mark Complete'}
                                            </DropdownMenuItem>
                                          )}
                                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(session); }}>
                                            <Pencil className="h-4 w-4 mr-2" />
                                            {t.common.edit}
                                          </DropdownMenuItem>
                                          {role === 'admin' && (
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
