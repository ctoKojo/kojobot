import { useState, useEffect } from 'react';
import { Calendar, Clock, Search, Filter, CheckCircle, XCircle, AlertTriangle, Users, GraduationCap, RefreshCw } from 'lucide-react';
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
}

interface EnrichedMakeupSession extends MakeupSession {
  student_name: string;
  group_name: string;
  level_name: string;
  original_session_number: number | null;
}

export default function MakeupSessionsPage() {
  const { isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { role } = useAuth();
  const [makeupSessions, setMakeupSessions] = useState<EnrichedMakeupSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<EnrichedMakeupSession | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ date: '', time: '', notes: '' });

  useEffect(() => {
    fetchMakeupSessions();
  }, []);

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

      // Enrich with student names, group names, level names
      const studentIds = [...new Set(msData.map(m => m.student_id))];
      const groupIds = [...new Set(msData.map(m => m.group_id))];
      const levelIds = [...new Set(msData.filter(m => m.level_id).map(m => m.level_id!))];
      const sessionIds = [...new Set(msData.filter(m => m.original_session_id).map(m => m.original_session_id!))];

      const [profilesRes, groupsRes, levelsRes, sessionsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, full_name_ar').in('user_id', studentIds),
        supabase.from('groups').select('id, name, name_ar').in('id', groupIds),
        levelIds.length > 0 ? supabase.from('levels').select('id, name, name_ar').in('id', levelIds) : { data: [] },
        sessionIds.length > 0 ? supabase.from('sessions').select('id, session_number').in('id', sessionIds) : { data: [] },
      ]);

      const profilesMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
      const groupsMap = new Map((groupsRes.data || []).map(g => [g.id, g]));
      const levelsMap = new Map(((levelsRes as any).data || []).map((l: { id: string; name: string; name_ar: string }) => [l.id, l]));
      const sessionsMap = new Map(((sessionsRes as any).data || []).map((s: { id: string; session_number: number }) => [s.id, s]));

      const enriched: EnrichedMakeupSession[] = msData.map(m => {
        const profile = profilesMap.get(m.student_id);
        const group = groupsMap.get(m.group_id);
        const level = m.level_id ? levelsMap.get(m.level_id) as { id: string; name: string; name_ar: string } | undefined : null;
        const origSession = m.original_session_id ? sessionsMap.get(m.original_session_id) as { id: string; session_number: number } | undefined : null;

        return {
          ...m,
          student_name: language === 'ar' ? (profile?.full_name_ar || profile?.full_name || '-') : (profile?.full_name || '-'),
          group_name: language === 'ar' ? (group?.name_ar || group?.name || '-') : (group?.name || '-'),
          level_name: level ? (language === 'ar' ? (level.name_ar || level.name) : level.name) : '-',
          original_session_number: origSession?.session_number || null,
        };
      });

      setMakeupSessions(enriched);
    } catch (error) {
      console.error('Error fetching makeup sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = (session: EnrichedMakeupSession) => {
    setSelectedSession(session);
    setScheduleForm({ date: session.scheduled_date || '', time: session.scheduled_time || '', notes: session.notes || '' });
    setScheduleDialogOpen(true);
  };

  const handleSaveSchedule = async () => {
    if (!selectedSession || !scheduleForm.date || !scheduleForm.time) return;
    try {
      const { error } = await supabase
        .from('makeup_sessions')
        .update({
          scheduled_date: scheduleForm.date,
          scheduled_time: scheduleForm.time,
          notes: scheduleForm.notes || null,
          status: 'scheduled',
        })
        .eq('id', selectedSession.id);

      if (error) throw error;
      toast({ title: isRTL ? 'تم الجدولة' : 'Scheduled', description: isRTL ? 'تم جدولة السيشن التعويضية' : 'Makeup session scheduled' });
      setScheduleDialogOpen(false);
      fetchMakeupSessions();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error' });
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'completed') updateData.completed_at = new Date().toISOString();
      const { error } = await supabase.from('makeup_sessions').update(updateData).eq('id', id);
      if (error) throw error;
      toast({ title: isRTL ? 'تم التحديث' : 'Updated' });
      fetchMakeupSessions();
    } catch (error) {
      console.error(error);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      expired: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    };
    const labels: Record<string, string> = {
      pending: isRTL ? 'معلق' : 'Pending',
      scheduled: isRTL ? 'مجدول' : 'Scheduled',
      completed: isRTL ? 'مكتمل' : 'Completed',
      expired: isRTL ? 'منتهي' : 'Expired',
    };
    return <Badge className={styles[status] || ''}>{labels[status] || status}</Badge>;
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
    const matchesSearch = m.student_name.toLowerCase().includes(searchQuery.toLowerCase()) || m.group_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesReason && matchesSearch;
  });

  const stats = {
    pending: makeupSessions.filter(m => m.status === 'pending').length,
    scheduled: makeupSessions.filter(m => m.status === 'scheduled').length,
    completed: makeupSessions.filter(m => m.status === 'completed').length,
    free: makeupSessions.filter(m => m.is_free).length,
  };

  return (
    <DashboardLayout title={isRTL ? 'السيشنات التعويضية' : 'Makeup Sessions'}>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'معلق' : 'Pending'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.scheduled}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'مجدول' : 'Scheduled'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'مكتمل' : 'Completed'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.free}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'مجانية' : 'Free'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-12">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{isRTL ? 'لا توجد سيشنات تعويضية' : 'No makeup sessions found'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                      <TableHead>{isRTL ? 'المجموعة' : 'Group'}</TableHead>
                      <TableHead>{isRTL ? 'السبب' : 'Reason'}</TableHead>
                      <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead>{isRTL ? 'مجانية' : 'Free'}</TableHead>
                      <TableHead>{isRTL ? 'الموعد' : 'Schedule'}</TableHead>
                      {role === 'admin' && <TableHead>{isRTL ? 'إجراءات' : 'Actions'}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(session => (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">{session.student_name}</TableCell>
                        <TableCell>{session.group_name}</TableCell>
                        <TableCell>{getReasonBadge(session.reason)}</TableCell>
                        <TableCell>{getStatusBadge(session.status)}</TableCell>
                        <TableCell>
                          {session.is_free ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{isRTL ? 'مجاني' : 'Free'}</Badge>
                          ) : (
                            <Badge variant="outline">{isRTL ? 'مدفوع' : 'Paid'}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {session.scheduled_date ? (
                            <span className="text-sm">{session.scheduled_date} {session.scheduled_time}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">{isRTL ? 'غير محدد' : 'Not set'}</span>
                          )}
                        </TableCell>
                        {role === 'admin' && (
                          <TableCell>
                            <div className="flex gap-1">
                              {session.status === 'pending' && (
                                <Button size="sm" variant="outline" onClick={() => handleSchedule(session)}>
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {isRTL ? 'جدولة' : 'Schedule'}
                                </Button>
                              )}
                              {session.status === 'scheduled' && (
                                <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(session.id, 'completed')}>
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  {isRTL ? 'مكتمل' : 'Complete'}
                                </Button>
                              )}
                              {(session.status === 'pending' || session.status === 'scheduled') && (
                                <Button size="sm" variant="ghost" onClick={() => handleUpdateStatus(session.id, 'expired')}>
                                  <XCircle className="h-3 w-3 mr-1" />
                                  {isRTL ? 'إنهاء' : 'Expire'}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

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
                <Label>{isRTL ? 'التاريخ' : 'Date'}</Label>
                <Input type="date" value={scheduleForm.date} onChange={e => setScheduleForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>{isRTL ? 'الوقت' : 'Time'}</Label>
                <Input type="time" value={scheduleForm.time} onChange={e => setScheduleForm(f => ({ ...f, time: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>{isRTL ? 'ملاحظات' : 'Notes'}</Label>
                <Textarea value={scheduleForm.notes} onChange={e => setScheduleForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
              <Button className="kojo-gradient" onClick={handleSaveSchedule}>{isRTL ? 'جدولة' : 'Schedule'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
