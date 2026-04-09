import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Target, CalendarClock, AlertTriangle, Search, Clock, CheckCircle2,
  GraduationCap, Users, Loader2,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatsGrid } from '@/components/shared/StatsGrid';
import { useIsMobile } from '@/hooks/use-mobile';

interface ExamCandidate {
  progress_id: string;
  student_id: string;
  group_id: string;
  current_level_id: string;
  status: string;
  exam_scheduled_at: string | null;
  exam_submitted_at: string | null;
  graded_at: string | null;
  status_changed_at: string | null;
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
  const isMobile = useIsMobile();

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

  const handleOpenScheduleDialog = () => {
    if (!canSchedule) return;
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
      const dateTime = `${scheduleDate}T${scheduleTime}:00+02:00`;

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

  const getWaitDays = (c: ExamCandidate): number => {
    if (!c.status_changed_at) return 0;
    return Math.floor((Date.now() - new Date(c.status_changed_at).getTime()) / (1000 * 60 * 60 * 24));
  };

  // ─── Summary Stats ───
  const statsCards = [
    {
      label: isRTL ? 'إجمالي الطلاب' : 'Total Students',
      value: filterCounts.all,
      icon: Users,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: isRTL ? 'في انتظار الجدولة' : 'Awaiting Scheduling',
      value: filterCounts.awaiting_exam,
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: isRTL ? 'مجدول' : 'Scheduled',
      value: filterCounts.exam_scheduled,
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <PageHeader
          title={isRTL ? 'الامتحانات النهائية' : 'Final Exams'}
          subtitle={isRTL ? 'إدارة وجدولة الامتحانات النهائية للطلاب' : 'Manage and schedule student final exams'}
          icon={GraduationCap}
          gradient="from-teal-500 to-cyan-600"
          actions={isAdmin ? (
            <Button
              onClick={handleOpenScheduleDialog}
              disabled={!canSchedule}
              className="gap-2"
            >
              <CalendarClock className="h-4 w-4" />
              {isRTL ? 'جدولة امتحان' : 'Schedule Exam'}
              {selectedCandidates.length > 0 && (
                <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground text-xs px-1.5">
                  {selectedCandidates.length}
                </Badge>
              )}
            </Button>
          ) : undefined}
        />

        {/* Stats Cards */}
        <StatsGrid
          columns={3}
          stats={[
            { label: isRTL ? 'إجمالي الطلاب' : 'Total Students', value: filterCounts.all, icon: Users, gradient: 'from-blue-500 to-blue-600' },
            { label: isRTL ? 'في انتظار الجدولة' : 'Awaiting Scheduling', value: filterCounts.awaiting_exam, icon: Clock, gradient: 'from-amber-500 to-orange-500' },
            { label: isRTL ? 'مجدول' : 'Scheduled', value: filterCounts.exam_scheduled, icon: CheckCircle2, gradient: 'from-emerald-500 to-emerald-600' },
          ]}
        />

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
            <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground`} />
            <Input
              placeholder={isRTL ? 'بحث بالاسم أو المجموعة...' : 'Search by name or group...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="ps-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              ['all', isRTL ? 'الكل' : 'All'],
              ['awaiting_exam', isRTL ? 'في انتظار الجدولة' : 'Awaiting'],
              ['exam_scheduled', isRTL ? 'مجدول' : 'Scheduled'],
            ] as [FilterType, string][]).map(([key, label]) => (
              <Badge
                key={key}
                variant={filter === key ? 'default' : 'outline'}
                className={`cursor-pointer px-3 py-1.5 transition-all ${
                  filter === key ? 'shadow-sm' : 'hover:bg-muted'
                }`}
                onClick={() => setFilter(key)}
              >
                {label} ({filterCounts[key]})
              </Badge>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <Target className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <h3 className="text-base font-semibold mb-1">
                {isRTL ? 'لا يوجد طلاب حالياً' : 'No Students Yet'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {isRTL
                  ? 'سيظهر هنا الطلاب الذين أكملوا عدد السيشنات المطلوبة وجاهزين للامتحان النهائي'
                  : 'Students who complete their required sessions will appear here ready for final exam scheduling'}
              </p>
            </CardContent>
          </Card>
        ) : isMobile ? (
          /* ─── Mobile: Card View ─── */
          <div className="space-y-3">
            {filtered.map(c => (
              <Card
                key={c.progress_id}
                className="overflow-hidden hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {isAdmin && c.status === 'awaiting_exam' && (
                      <div className="pt-1" onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(c.progress_id)}
                          onCheckedChange={() => handleToggleSelect(c.progress_id)}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0" onClick={() => navigate(`/student/${c.student_id}`)}>
                      <div className="flex items-center gap-2.5 mb-2">
                        <Avatar className="h-9 w-9 ring-2 ring-border">
                          <AvatarImage src={c.avatar_url || undefined} />
                          <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                            {getName(c)?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{getName(c)}</p>
                          <p className="text-xs text-muted-foreground truncate">{getGroupName(c)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] py-0">
                          {getLevelName(c)}
                        </Badge>
                        <Badge
                          variant={c.status === 'exam_scheduled' ? 'default' : 'secondary'}
                          className="text-[10px] py-0"
                        >
                          {c.status === 'awaiting_exam'
                            ? (isRTL ? 'في انتظار الجدولة' : 'Awaiting')
                            : (isRTL ? 'مجدول' : 'Scheduled')}
                        </Badge>
                        {c.final_exam_quiz_id ? (
                          <Badge variant="outline" className="text-[10px] py-0 text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700">
                            {isRTL ? 'كويز مربوط' : 'Quiz linked'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] py-0 text-destructive border-destructive/30">
                            {isRTL ? 'بدون كويز' : 'No quiz'}
                          </Badge>
                        )}
                      </div>
                      {c.exam_scheduled_at && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          {new Date(c.exam_scheduled_at).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      )}
                      {/* Wait days */}
                      {(() => {
                        const days = getWaitDays(c);
                        const slaThreshold = c.status === 'awaiting_exam' ? 7 : 14;
                        return days > 0 ? (
                          <Badge variant="outline" className={`text-[10px] mt-1 ${days >= slaThreshold ? 'text-destructive border-destructive/30' : ''}`}>
                            {days} {isRTL ? 'يوم' : 'days'}
                          </Badge>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* ─── Desktop: Table View ─── */
          <Card className="overflow-hidden">
            <CardHeader className="pb-0 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {isRTL ? `عرض ${filtered.length} من ${candidates.length} طالب` : `Showing ${filtered.length} of ${candidates.length} students`}
                </CardTitle>
                {selectedCandidates.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {isRTL ? `${selectedCandidates.length} محدد` : `${selectedCandidates.length} selected`}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0 pt-3">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {isAdmin && <TableHead className="w-10"></TableHead>}
                    <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                    <TableHead>{isRTL ? 'المجموعة' : 'Group'}</TableHead>
                    <TableHead>{isRTL ? 'المستوى' : 'Level'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'موعد الامتحان' : 'Exam Date'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'أيام الانتظار' : 'Wait Days'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'كويز نهائي' : 'Final Quiz'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => (
                    <TableRow
                      key={c.progress_id}
                      className={`transition-colors ${
                        selectedIds.has(c.progress_id)
                          ? 'bg-primary/5 hover:bg-primary/10'
                          : 'hover:bg-muted/50'
                      }`}
                    >
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
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8 ring-2 ring-border">
                            <AvatarImage src={c.avatar_url || undefined} />
                            <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                              {getName(c)?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium hover:underline">{getName(c)}</span>
                        </div>
                      </TableCell>
                      <TableCell
                        className="cursor-pointer text-sm hover:underline"
                        onClick={() => navigate(`/group/${c.group_id}`)}
                      >
                        {getGroupName(c)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-normal">
                          {getLevelName(c)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {c.status === 'exam_scheduled' ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {isRTL ? 'مجدول' : 'Scheduled'}
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0 text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {isRTL ? 'في الانتظار' : 'Awaiting'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {c.exam_scheduled_at ? (
                          <span className="flex items-center justify-center gap-1">
                            <CalendarClock className="h-3.5 w-3.5" />
                            {new Date(c.exam_scheduled_at).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
                              month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {c.final_exam_quiz_id ? (
                          <div className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {isRTL ? 'مربوط' : 'Linked'}
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-xs text-destructive">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {isRTL ? 'غير مربوط' : 'Missing'}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Schedule Dialog */}
        <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                {isRTL ? 'جدولة الامتحان النهائي' : 'Schedule Final Exam'}
              </DialogTitle>
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
                <div className="max-h-32 overflow-y-auto border rounded-lg p-2.5 space-y-1.5 bg-muted/30">
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
