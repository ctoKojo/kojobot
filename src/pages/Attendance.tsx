import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, UserCheck, UserX, Clock, AlertCircle, Calendar, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatTime12Hour } from '@/lib/timeUtils';

interface Group {
  id: string;
  name: string;
  name_ar: string;
  instructor_id: string;
}

interface Session {
  id: string;
  group_id: string;
  session_date: string;
  session_time: string;
  status: string;
}

interface Student {
  user_id: string;
  full_name: string;
  full_name_ar: string | null;
  avatar_url: string | null;
}

interface AttendanceRecord {
  id?: string;
  session_id: string;
  student_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
}

export default function AttendancePage() {
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { user, role } = useAuth();
  const [searchParams] = useSearchParams();
  const urlSessionId = searchParams.get('session');
  const urlGroupId = searchParams.get('group');
  
  const [groups, setGroups] = useState<Group[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>(urlGroupId || '');
  const [selectedSession, setSelectedSession] = useState<string>(urlSessionId || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, [role, user]);

  useEffect(() => {
    if (selectedGroup) {
      fetchSessionsAndStudents();
    }
  }, [selectedGroup]);

  useEffect(() => {
    if (selectedSession) {
      fetchAttendance();
    }
  }, [selectedSession]);

  const fetchGroups = async () => {
    try {
      let query = supabase.from('groups').select('id, name, name_ar, instructor_id').eq('is_active', true);
      
      // Instructors only see their groups
      if (role === 'instructor' && user) {
        query = query.eq('instructor_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setGroups(data || []);
      
      // Auto-select first group if available
      if (data && data.length > 0) {
        setSelectedGroup(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionsAndStudents = async () => {
    try {
      // Fetch sessions for the group
      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('*')
        .eq('group_id', selectedGroup)
        .order('session_date', { ascending: false })
        .limit(30);

      setSessions(sessionsData || []);

      // Auto-select today's session or latest
      const today = new Date().toISOString().split('T')[0];
      const todaySession = sessionsData?.find(s => s.session_date === today);
      if (todaySession) {
        setSelectedSession(todaySession.id);
      } else if (sessionsData && sessionsData.length > 0) {
        setSelectedSession(sessionsData[0].id);
      }

      // Fetch students in the group
      const { data: groupStudents } = await supabase
        .from('group_students')
        .select('student_id')
        .eq('group_id', selectedGroup)
        .eq('is_active', true);

      if (groupStudents && groupStudents.length > 0) {
        const studentIds = groupStudents.map(gs => gs.student_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, full_name_ar, avatar_url')
          .in('user_id', studentIds);

        setStudents(profilesData || []);
      } else {
        setStudents([]);
      }
    } catch (error) {
      console.error('Error fetching sessions/students:', error);
    }
  };

  const fetchAttendance = async () => {
    try {
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('session_id', selectedSession);

      // Map existing records
      const records: AttendanceRecord[] = students.map(student => {
        const existing = data?.find(a => a.student_id === student.user_id);
        return {
          id: existing?.id,
          session_id: selectedSession,
          student_id: student.user_id,
          status: (existing?.status as 'present' | 'absent' | 'late' | 'excused') || 'absent',
          notes: existing?.notes || '',
        };
      });

      setAttendanceRecords(records);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const updateStatus = (studentId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
    setAttendanceRecords(prev =>
      prev.map(record =>
        record.student_id === studentId ? { ...record, status } : record
      )
    );
  };

  const saveAttendance = async () => {
    if (!user || !selectedSession) return;
    setSaving(true);

    try {
      // Upsert attendance records
      for (const record of attendanceRecords) {
        if (record.id) {
          // Update existing
          await supabase
            .from('attendance')
            .update({ status: record.status, notes: record.notes })
            .eq('id', record.id);
        } else {
          // Insert new
          await supabase
            .from('attendance')
            .insert({
              session_id: selectedSession,
              student_id: record.student_id,
              status: record.status,
              recorded_by: user.id,
              notes: record.notes,
            });
        }
      }

      toast({
        title: t.common.success,
        description: isRTL ? 'تم حفظ الحضور' : 'Attendance saved successfully',
      });

      fetchAttendance();
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في حفظ الحضور' : 'Failed to save attendance',
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      present: 'bg-green-100 text-green-800 border-green-200',
      absent: 'bg-red-100 text-red-800 border-red-200',
      late: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      excused: 'bg-blue-100 text-blue-800 border-blue-200',
    };

    const labels: Record<string, { en: string; ar: string }> = {
      present: { en: 'Present', ar: 'حاضر' },
      absent: { en: 'Absent', ar: 'غائب' },
      late: { en: 'Late', ar: 'متأخر' },
      excused: { en: 'Excused', ar: 'معذور' },
    };

    return (
      <Badge className={styles[status] || styles.absent}>
        {labels[status]?.[language] || status}
      </Badge>
    );
  };

  const getSelectedSessionInfo = () => {
    const session = sessions.find(s => s.id === selectedSession);
    if (!session) return null;
    return `${session.session_date} - ${formatTime12Hour(session.session_time, isRTL)}`;
  };

  const canManage = role === 'admin' || role === 'instructor';

  return (
    <DashboardLayout title={t.attendance.title}>
      <div className="space-y-6">
        {/* Filters */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label>{t.students.group}</Label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
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

          <div className="grid gap-2">
            <Label>{t.attendance.sessionDate}</Label>
            <Select value={selectedSession} onValueChange={setSelectedSession}>
              <SelectTrigger>
                <SelectValue placeholder={isRTL ? 'اختر سيشن' : 'Select session'} />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.session_date} - {formatTime12Hour(session.session_time, isRTL)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {canManage && selectedSession && (
            <div className="flex items-end">
              <Button className="kojo-gradient w-full" onClick={saveAttendance} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : t.common.save}
              </Button>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {attendanceRecords.filter(r => r.status === 'present').length}
                  </p>
                  <p className="text-sm text-muted-foreground">{t.attendance.present}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <UserX className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {attendanceRecords.filter(r => r.status === 'absent').length}
                  </p>
                  <p className="text-sm text-muted-foreground">{t.attendance.absent}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {attendanceRecords.filter(r => r.status === 'late').length}
                  </p>
                  <p className="text-sm text-muted-foreground">{t.attendance.late}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {attendanceRecords.filter(r => r.status === 'excused').length}
                  </p>
                  <p className="text-sm text-muted-foreground">{t.attendance.excused}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Attendance Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {getSelectedSessionInfo() || (isRTL ? 'اختر سيشن' : 'Select a session')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                  <TableHead className="text-center">{t.attendance.present}</TableHead>
                  <TableHead className="text-center">{t.attendance.absent}</TableHead>
                  <TableHead className="text-center">{t.attendance.late}</TableHead>
                  <TableHead className="text-center">{t.attendance.excused}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      {t.common.loading}
                    </TableCell>
                  </TableRow>
                ) : students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <UserCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        {isRTL ? 'لا يوجد طلاب في هذه المجموعة' : 'No students in this group'}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map((student) => {
                    const record = attendanceRecords.find(r => r.student_id === student.user_id);
                    const currentStatus = record?.status || 'absent';

                    return (
                      <TableRow key={student.user_id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={student.avatar_url || ''} />
                              <AvatarFallback>
                                {(student.full_name || '?').charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">
                              {language === 'ar' && student.full_name_ar
                                ? student.full_name_ar
                                : student.full_name}
                            </span>
                          </div>
                        </TableCell>
                        {(['present', 'absent', 'late', 'excused'] as const).map((status) => (
                          <TableCell key={status} className="text-center">
                            {canManage ? (
                              <Button
                                variant={currentStatus === status ? 'default' : 'outline'}
                                size="sm"
                                className={currentStatus === status ? 'kojo-gradient' : ''}
                                onClick={() => updateStatus(student.user_id, status)}
                              >
                                {currentStatus === status && '✓'}
                              </Button>
                            ) : (
                              currentStatus === status && getStatusBadge(status)
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
