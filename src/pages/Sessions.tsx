import { useState, useEffect } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Calendar, Clock, Users } from 'lucide-react';
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
  const [sessions, setSessions] = useState<Session[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [formData, setFormData] = useState({
    group_id: '',
    session_date: '',
    session_time: '',
    duration_minutes: 60,
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

      let sessionsQuery = supabase.from('sessions').select('*').order('session_date', { ascending: false });

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

  const handleSubmit = async () => {
    try {
      const payload = {
        group_id: formData.group_id,
        session_date: formData.session_date,
        session_time: formData.session_time,
        duration_minutes: formData.duration_minutes,
        topic: formData.topic || null,
        topic_ar: formData.topic_ar || null,
        status: formData.status,
        notes: formData.notes || null,
      };

      if (editingSession) {
        const { error } = await supabase
          .from('sessions')
          .update(payload)
          .eq('id', editingSession.id);

        if (error) throw error;
        toast({
          title: t.common.success,
          description: isRTL ? 'تم تحديث السيشن' : 'Session updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('sessions')
          .insert([payload]);

        if (error) throw error;
        toast({
          title: t.common.success,
          description: isRTL ? 'تم إضافة السيشن' : 'Session added successfully',
        });
      }

      setIsDialogOpen(false);
      setEditingSession(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving session:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في حفظ السيشن' : 'Failed to save session',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      group_id: '',
      session_date: '',
      session_time: '',
      duration_minutes: 60,
      topic: '',
      topic_ar: '',
      status: 'scheduled',
      notes: '',
    });
  };

  const handleEdit = (session: Session) => {
    setEditingSession(session);
    setFormData({
      group_id: session.group_id,
      session_date: session.session_date,
      session_time: session.session_time,
      duration_minutes: session.duration_minutes,
      topic: session.topic || '',
      topic_ar: session.topic_ar || '',
      status: session.status,
      notes: session.notes || '',
    });
    setIsDialogOpen(true);
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

  const filteredSessions = sessions.filter((session) => {
    const matchesSearch = 
      session.topic?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.topic_ar?.includes(searchQuery) ||
      session.session_date.includes(searchQuery);
    const matchesGroup = selectedGroup === 'all' || session.group_id === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  const canManage = role === 'admin' || role === 'instructor';

  return (
    <DashboardLayout title={t.groups.sessions}>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-4 flex-1">
            <div className="relative flex-1 max-w-xs">
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
          </div>

          {canManage && (
            <Button className="kojo-gradient" onClick={() => {
              setEditingSession(null);
              resetForm();
              setIsDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              {isRTL ? 'إضافة سيشن' : 'Add Session'}
            </Button>
          )}
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingSession 
                  ? (isRTL ? 'تعديل السيشن' : 'Edit Session')
                  : (isRTL ? 'إضافة سيشن' : 'Add Session')
                }
              </DialogTitle>
              <DialogDescription>
                {isRTL ? 'أدخل بيانات السيشن' : 'Enter session details'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>{t.students.group}</Label>
                <Select
                  value={formData.group_id}
                  onValueChange={(value) => setFormData({ ...formData, group_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? 'اختر مجموعة' : 'Select group'} />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {language === 'ar' ? group.name_ar : group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{t.groups.duration} ({isRTL ? 'دقيقة' : 'min'})</Label>
                  <Input
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 60 })}
                  />
                </div>
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
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button className="kojo-gradient" onClick={handleSubmit}>
                {t.common.save}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Table */}
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
                  <TableHead className="w-[100px]">{t.common.actions}</TableHead>
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
                      <p className="text-muted-foreground">
                        {isRTL ? 'لا توجد سيشنات' : 'No sessions found'}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">
                        {getGroupName(session.group_id)}
                      </TableCell>
                      <TableCell>{session.session_date}</TableCell>
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
                      <TableCell>
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                              <DropdownMenuItem onClick={() => handleEdit(session)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                {t.common.edit}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(session.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t.common.delete}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
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
