import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, MoreHorizontal, Pencil, Trash2, Calendar, Clock, RefreshCw, CheckCircle, Users } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

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
}

interface Group {
  id: string;
  name: string;
  name_ar: string;
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
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
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
      let groupsQuery = supabase.from('groups').select('id, name, name_ar').eq('is_active', true);
      
      if (role === 'instructor' && user) {
        groupsQuery = groupsQuery.eq('instructor_id', user.id);
      }

      const { data: groupsData } = await groupsQuery;
      setGroups(groupsData || []);

      let sessionsQuery = supabase.from('sessions').select('*').order('session_date', { ascending: true });

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
    try {
      const { error } = await supabase.from('sessions').delete().eq('id', id);
      if (error) throw error;
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

  const getGroupName = (id: string) => {
    const group = groups.find((g) => g.id === id);
    return group ? (language === 'ar' ? group.name_ar : group.name) : '-';
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
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

  const isPast = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr < today;
  };

  const filteredSessions = sessions.filter((session) => {
    const matchesSearch = 
      session.topic?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.topic_ar?.includes(searchQuery) ||
      session.session_date.includes(searchQuery) ||
      getGroupName(session.group_id).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGroup = selectedGroup === 'all' || session.group_id === selectedGroup;
    const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
    return matchesSearch && matchesGroup && matchesStatus;
  });

  // Separate today's sessions
  const todaySessions = filteredSessions.filter(s => isToday(s.session_date));
  const upcomingSessions = filteredSessions.filter(s => !isToday(s.session_date) && !isPast(s.session_date));
  const pastSessions = filteredSessions.filter(s => isPast(s.session_date));

  const canManage = role === 'admin' || role === 'instructor';

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
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={isRTL ? 'كل المجموعات' : 'All Groups'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? 'كل المجموعات' : 'All Groups'}</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {language === 'ar' ? group.name_ar : group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

        {/* Today's Sessions */}
        {todaySessions.length > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {isRTL ? 'سيشنات اليوم' : "Today's Sessions"}
                <Badge variant="secondary">{todaySessions.length}</Badge>
              </h3>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {todaySessions.map((session) => (
                  <Card key={session.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{getGroupName(session.group_id)}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            {session.session_time}
                          </p>
                          {(session.topic || session.topic_ar) && (
                            <p className="text-sm mt-2">
                              {language === 'ar' ? session.topic_ar : session.topic}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          {getStatusBadge(session.status)}
                          {session.status === 'scheduled' && canManage && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleMarkComplete(session)}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {isRTL ? 'اكتمل' : 'Complete'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* All Sessions Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.students.group}</TableHead>
                  <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                  <TableHead>{isRTL ? 'الوقت' : 'Time'}</TableHead>
                  <TableHead>{isRTL ? 'الموضوع' : 'Topic'}</TableHead>
                  <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                  {canManage && <TableHead className="w-[100px]">{t.common.actions}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      {t.common.loading}
                    </TableCell>
                  </TableRow>
                ) : filteredSessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">
                        {isRTL ? 'لا توجد سيشنات' : 'No sessions found'}
                      </p>
                      {role === 'admin' && (
                        <Button onClick={generateSessions} disabled={generating}>
                          <RefreshCw className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
                          {isRTL ? 'توليد السيشنات' : 'Generate Sessions'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSessions.map((session) => (
                    <TableRow 
                      key={session.id}
                      className={`${isToday(session.session_date) ? 'bg-primary/5' : ''} cursor-pointer hover:bg-muted/50`}
                      onClick={() => navigate(`/attendance?session=${session.id}&group=${session.group_id}`)}
                    >
                      <TableCell className="font-medium">
                        {getGroupName(session.group_id)}
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
                          {session.session_time}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {language === 'ar' 
                          ? (session.topic_ar || session.topic || '-')
                          : (session.topic || session.topic_ar || '-')
                        }
                      </TableCell>
                      <TableCell>{getStatusBadge(session.status)}</TableCell>
                      {canManage && (
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
                                <DropdownMenuItem
                                  onClick={(e) => { e.stopPropagation(); handleDelete(session.id); }}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {t.common.delete}
                                </DropdownMenuItem>
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
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
