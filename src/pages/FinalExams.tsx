import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Target, CalendarClock, AlertTriangle, Search } from 'lucide-react';

interface ExamCandidate {
  progress_id: string;
  student_id: string;
  group_id: string;
  current_level_id: string;
  status: string;
  exam_scheduled_at: string | null;
  exam_submitted_at: string | null;
  graded_at: string | null;
  full_name: string;
  full_name_ar: string | null;
  avatar_url: string | null;
  group_name: string;
  group_name_ar: string | null;
  level_name: string;
  level_name_ar: string | null;
  final_exam_quiz_id: string | null;
}

type FilterType = 'all' | 'awaiting_exam' | 'exam_scheduled';

export default function FinalExams() {
  const { isRTL, language } = useLanguage();
  const { role } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isAdmin = role === 'admin';

  const [candidates, setCandidates] = useState<ExamCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Scheduling dialog
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleDuration, setScheduleDuration] = useState(30);
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('final_exam_candidates' as any)
        .select('*');
      if (error) throw error;
      setCandidates((data || []) as unknown as ExamCandidate[]);
    } catch (err: any) {
      console.error('Error fetching candidates:', err);
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let result = candidates;
    if (filter === 'awaiting_exam') result = result.filter(c => c.status === 'awaiting_exam');
    if (filter === 'exam_scheduled') result = result.filter(c => c.status === 'exam_scheduled');
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.full_name?.toLowerCase().includes(q) ||
        c.full_name_ar?.toLowerCase().includes(q) ||
        c.group_name?.toLowerCase().includes(q) ||
        c.group_name_ar?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [candidates, filter, searchQuery]);

  // Group selected candidates by group_id for validation
  const selectedCandidates = useMemo(() =>
    candidates.filter(c => selectedIds.has(c.progress_id)),
    [candidates, selectedIds]
  );

  const selectedGroupIds = useMemo(() =>
    new Set(selectedCandidates.map(c => c.group_id)),
    [selectedCandidates]
  );

  const canSchedule = selectedCandidates.length > 0 && selectedGroupIds.size === 1;

  const handleToggleSelect = (progressId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(progressId)) next.delete(progressId);
      else next.add(progressId);
      return next;
    });
  };

  const handleSelectAllInGroup = (groupId: string) => {
    const groupCandidates = filtered.filter(c => c.group_id === groupId && c.status === 'awaiting_exam');
    setSelectedIds(new Set(groupCandidates.map(c => c.progress_id)));
  };

  const handleOpenScheduleDialog = () => {
    if (!canSchedule) return;
    // Check if level has final_exam_quiz_id
    const firstCandidate = selectedCandidates[0];
    if (!firstCandidate.final_exam_quiz_id) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'لا يوجد كويز نهائي' : 'No Final Quiz',
        description: isRTL
          ? 'هذا المستوى ليس له كويز نهائي مربوط. يرجى ربط كويز نهائي بالمستوى أولاً.'
          : 'This level has no final exam quiz linked. Please link a final exam quiz to the level first.',
      });
      return;
    }
    setShowScheduleDialog(true);
  };

  const handleSchedule = async () => {
    if (!scheduleDate || !scheduleTime) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'يرجى تحديد التاريخ والوقت' : 'Please set date and time' });
      return;
    }

    setScheduling(true);
    try {
      const groupId = Array.from(selectedGroupIds)[0];
      const studentIds = selectedCandidates.map(c => c.student_id);
      const dateTime = `${scheduleDate}T${scheduleTime}:00+02:00`; // Cairo timezone

      const { data, error } = await supabase.rpc('schedule_final_exam_for_students', {
        p_group_id: groupId,
        p_student_ids: studentIds,
        p_date: dateTime,
        p_duration: scheduleDuration,
      });

      if (error) throw error;

      const result = data as any;
      toast({
        title: isRTL ? 'تمت الجدولة' : 'Scheduled',
        description: isRTL
          ? `تم جدولة الامتحان النهائي لـ ${result?.scheduled_count || studentIds.length} طالب`
          : `Final exam scheduled for ${result?.scheduled_count || studentIds.length} student(s)`,
      });

      setShowScheduleDialog(false);
      setSelectedIds(new Set());
      setScheduleDate('');
      setScheduleTime('');
      fetchCandidates();
    } catch (err: any) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: err.message });
    } finally {
      setScheduling(false);
    }
  };

  const filterCounts = {
    all: candidates.length,
    awaiting_exam: candidates.filter(c => c.status === 'awaiting_exam').length,
    exam_scheduled: candidates.filter(c => c.status === 'exam_scheduled').length,
  };

  const getName = (c: ExamCandidate) => language === 'ar' ? c.full_name_ar || c.full_name : c.full_name;
  const getGroupName = (c: ExamCandidate) => language === 'ar' ? c.group_name_ar || c.group_name : c.group_name;
  const getLevelName = (c: ExamCandidate) => language === 'ar' ? c.level_name_ar || c.level_name : c.level_name;

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              {isRTL ? 'الامتحانات النهائية' : 'Final Exams'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isRTL ? 'إدارة وجدولة الامتحانات النهائية للطلاب' : 'Manage and schedule student final exams'}
            </p>
          </div>
          {isAdmin && (
            <Button
              onClick={handleOpenScheduleDialog}
              disabled={!canSchedule}
            >
              <CalendarClock className="h-4 w-4 mr-2" />
              {isRTL ? 'جدولة امتحان' : 'Schedule Exam'}
            </Button>
          )}
        </div>

        {/* Multi-group warning */}
        {selectedGroupIds.size > 1 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{isRTL ? 'تنبيه' : 'Warning'}</AlertTitle>
            <AlertDescription>
              {isRTL
                ? 'لا يمكن جدولة طلاب من مجموعات مختلفة في نفس الوقت. يرجى اختيار طلاب من مجموعة واحدة فقط.'
                : 'Cannot schedule students from different groups at once. Please select students from one group only.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={isRTL ? 'بحث بالاسم أو المجموعة...' : 'Search by name or group...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              ['all', isRTL ? 'الكل' : 'All'],
              ['awaiting_exam', isRTL ? 'في انتظار الجدولة' : 'Awaiting Scheduling'],
              ['exam_scheduled', isRTL ? 'مجدول' : 'Scheduled'],
            ] as [FilterType, string][]).map(([key, label]) => (
              <Badge
                key={key}
                variant={filter === key ? 'default' : 'outline'}
                className="cursor-pointer px-3 py-1"
                onClick={() => setFilter(key)}
              >
                {label} ({filterCounts[key]})
              </Badge>
            ))}
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isRTL ? `${filtered.length} طالب` : `${filtered.length} student(s)`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">
                {isRTL ? 'جاري التحميل...' : 'Loading...'}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {isRTL ? 'لا يوجد طلاب في هذه الحالة حالياً' : 'No students in this status currently'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && <TableHead className="w-10"></TableHead>}
                    <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                    <TableHead>{isRTL ? 'المجموعة' : 'Group'}</TableHead>
                    <TableHead>{isRTL ? 'المستوى' : 'Level'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'موعد الامتحان' : 'Exam Date'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'كويز نهائي' : 'Final Quiz'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => (
                    <TableRow key={c.progress_id} className="hover:bg-muted/50">
                      {isAdmin && (
                        <TableCell onClick={e => e.stopPropagation()}>
                          {c.status === 'awaiting_exam' && (
                            <Checkbox
                              checked={selectedIds.has(c.progress_id)}
                              onCheckedChange={() => handleToggleSelect(c.progress_id)}
                            />
                          )}
                        </TableCell>
                      )}
                      <TableCell
                        className="cursor-pointer"
                        onClick={() => navigate(`/student/${c.student_id}`)}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={c.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">{getName(c)?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{getName(c)}</span>
                        </div>
                      </TableCell>
                      <TableCell
                        className="cursor-pointer text-sm"
                        onClick={() => navigate(`/group/${c.group_id}`)}
                      >
                        {getGroupName(c)}
                      </TableCell>
                      <TableCell className="text-sm">{getLevelName(c)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={c.status === 'exam_scheduled' ? 'default' : 'secondary'} className="text-xs">
                          {c.status === 'awaiting_exam'
                            ? (isRTL ? 'في انتظار الجدولة' : 'Awaiting')
                            : (isRTL ? 'مجدول' : 'Scheduled')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {c.exam_scheduled_at
                          ? new Date(c.exam_scheduled_at).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
                              year: 'numeric', month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })
                          : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {c.final_exam_quiz_id ? (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                            {isRTL ? 'مربوط' : 'Linked'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                            {isRTL ? 'غير مربوط' : 'Not linked'}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Schedule Dialog */}
        <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{isRTL ? 'جدولة الامتحان النهائي' : 'Schedule Final Exam'}</DialogTitle>
              <DialogDescription>
                {isRTL
                  ? `${selectedCandidates.length} طالب من مجموعة "${getGroupName(selectedCandidates[0] || {} as ExamCandidate)}"`
                  : `${selectedCandidates.length} student(s) from group "${getGroupName(selectedCandidates[0] || {} as ExamCandidate)}"`}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Selected students list */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">{isRTL ? 'الطلاب المختارون' : 'Selected Students'}</Label>
                <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                  {selectedCandidates.map(c => (
                    <div key={c.progress_id} className="flex items-center gap-2 text-sm">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={c.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">{getName(c)?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span>{getName(c)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="exam-date">{isRTL ? 'تاريخ الامتحان' : 'Exam Date'}</Label>
                <Input
                  id="exam-date"
                  type="date"
                  value={scheduleDate}
                  onChange={e => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="exam-time">{isRTL ? 'وقت الامتحان' : 'Exam Time'}</Label>
                <Input
                  id="exam-time"
                  type="time"
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="exam-duration">{isRTL ? 'المدة (بالدقائق)' : 'Duration (minutes)'}</Label>
                <Input
                  id="exam-duration"
                  type="number"
                  min={5}
                  max={180}
                  value={scheduleDuration}
                  onChange={e => setScheduleDuration(Number(e.target.value))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button onClick={handleSchedule} disabled={scheduling || !scheduleDate || !scheduleTime}>
                {scheduling ? (isRTL ? 'جاري الجدولة...' : 'Scheduling...') : (isRTL ? 'تأكيد الجدولة' : 'Confirm Schedule')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
