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
import { Separator } from '@/components/ui/separator';
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
  GraduationCap, Users, Loader2, FileText, ArrowRight, Timer,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { QuizResultsDialog } from '@/components/session/QuizResultsDialog';
import { ExamLiveMonitor } from '@/components/exam/ExamLiveMonitor';

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

type FilterType = 'all' | 'awaiting_exam' | 'exam_scheduled' | 'graded';

export default function FinalExams() {
  const { isRTL, language } = useLanguage();
  const { role } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isAdmin = role === 'admin' || role === 'reception';
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
  const [scheduling, setScheduling] = useState(false);


  // Grading dialog
  const [showGradingDialog, setShowGradingDialog] = useState(false);
  const [gradingCandidate, setGradingCandidate] = useState<ExamCandidate | null>(null);

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
    if (filter === 'graded') result = result.filter(c => c.status === 'graded');
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

  // Reschedule state
  const [rescheduleCandidate, setRescheduleCandidate] = useState<ExamCandidate | null>(null);

  const handleToggleSelect = (progressId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(progressId)) next.delete(progressId);
      else next.add(progressId);
      return next;
    });
  };

  const handleSelectAll = () => {
    const awaitingInView = filtered.filter(c => c.status === 'awaiting_exam');
    const allSelected = awaitingInView.every(c => selectedIds.has(c.progress_id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(awaitingInView.map(c => c.progress_id)));
    }
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
    setRescheduleCandidate(null);
    setShowScheduleDialog(true);
  };

  const handleOpenReschedule = (candidate: ExamCandidate) => {
    if (!candidate.final_exam_quiz_id) return;
    setRescheduleCandidate(candidate);
    // Pre-fill with existing schedule
    if (candidate.exam_scheduled_at) {
      const d = new Date(candidate.exam_scheduled_at);
      setScheduleDate(d.toISOString().split('T')[0]);
      setScheduleTime(d.toTimeString().slice(0, 5));
    }
    setSelectedIds(new Set([candidate.progress_id]));
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

      // Fetch quiz duration to use as submission window
      const quizId = selectedCandidates[0]?.final_exam_quiz_id;
      let examDuration = 60; // fallback
      if (quizId) {
        const { data: quizData } = await supabase.from('quizzes').select('duration_minutes').eq('id', quizId).single();
        if (quizData) examDuration = quizData.duration_minutes;
      }

      const { data, error } = await supabase.rpc('schedule_final_exam_for_students', {
        p_group_id: groupId,
        p_student_ids: studentIds,
        p_date: dateTime,
        p_duration: examDuration,
      });

      if (error) throw error;

      const result = data as any;
      const scheduledCount = result?.scheduled ?? result?.scheduled_count ?? 0;
      const skippedCount = result?.skipped ?? 0;

      if (scheduledCount === 0) {
        toast({
          variant: 'destructive',
          title: isRTL ? 'لم يتم جدولة أي طالب' : 'No students scheduled',
          description: isRTL
            ? `الطلاب المحددون لم يستوفوا شرط عدد الحصص المكتملة المطلوبة للامتحان النهائي`
            : `Selected students have not completed the required number of sessions for the final exam`,
        });
      } else {
        toast({
          title: isRTL ? 'تمت الجدولة' : 'Scheduled',
          description: isRTL
            ? `تم جدولة الامتحان النهائي لـ ${scheduledCount} طالب${skippedCount > 0 ? ` (تم تخطي ${skippedCount})` : ''}`
            : `Final exam scheduled for ${scheduledCount} student(s)${skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}`,
        });
      }

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
    graded: candidates.filter(c => c.status === 'graded').length,
  };

  const getName = (c: ExamCandidate) => language === 'ar' ? c.full_name_ar || c.full_name : c.full_name;
  const getGroupName = (c: ExamCandidate) => language === 'ar' ? c.group_name_ar || c.group_name : c.group_name;
  const getLevelName = (c: ExamCandidate) => language === 'ar' ? c.level_name_ar || c.level_name : c.level_name;

  const getWaitDays = (c: ExamCandidate): number => {
    if (!c.status_changed_at) return 0;
    return Math.floor((Date.now() - new Date(c.status_changed_at).getTime()) / (1000 * 60 * 60 * 24));
  };

  const formatExamDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // Group candidates by group for better visual grouping
  const groupedCandidates = useMemo(() => {
    const groups = new Map<string, { groupName: string; candidates: ExamCandidate[] }>();
    filtered.forEach(c => {
      const key = c.group_id;
      if (!groups.has(key)) {
        groups.set(key, { groupName: getGroupName(c), candidates: [] });
      }
      groups.get(key)!.candidates.push(c);
    });
    return Array.from(groups.entries());
  }, [filtered, language]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
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
              size="default"
              className="gap-2 shadow-sm"
            >
              <CalendarClock className="h-4 w-4" />
              {isRTL ? 'جدولة امتحان' : 'Schedule Exam'}
              {selectedCandidates.length > 0 && (
                <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground text-xs px-1.5 ms-1">
                  {selectedCandidates.length}
                </Badge>
              )}
            </Button>
          ) : undefined}
        />

        {/* Stats Strip */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'all' as FilterType, label: isRTL ? 'الإجمالي' : 'Total', count: filterCounts.all, icon: Users, color: 'text-primary', bgColor: 'bg-primary/10', borderColor: 'border-primary/20' },
            { key: 'awaiting_exam' as FilterType, label: isRTL ? 'في الانتظار' : 'Awaiting', count: filterCounts.awaiting_exam, icon: Clock, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/20' },
            { key: 'exam_scheduled' as FilterType, label: isRTL ? 'مجدول' : 'Scheduled', count: filterCounts.exam_scheduled, icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20' },
            { key: 'graded' as FilterType, label: isRTL ? 'تصحيح يدوي' : 'Needs Grading', count: filterCounts.graded, icon: FileText, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20' },
          ].map(stat => (
            <button
              key={stat.key}
              onClick={() => setFilter(filter === stat.key ? 'all' : stat.key)}
              className={`relative flex items-center gap-3 rounded-xl border p-3 sm:p-4 transition-all duration-200 text-start ${
                filter === stat.key
                  ? `${stat.borderColor} ${stat.bgColor} shadow-sm ring-1 ring-inset ${stat.borderColor}`
                  : 'border-border bg-card hover:bg-muted/50'
              }`}
            >
              <div className={`p-2 rounded-lg ${stat.bgColor} flex-shrink-0`}>
                <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold tabular-nums leading-none">{stat.count}</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">{stat.label}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Multi-group warning */}
        {selectedGroupIds.size > 1 && (
          <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 duration-300">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{isRTL ? 'تنبيه' : 'Warning'}</AlertTitle>
            <AlertDescription>
              {isRTL
                ? 'لا يمكن جدولة طلاب من مجموعات مختلفة في نفس الوقت. يرجى اختيار طلاب من مجموعة واحدة فقط.'
                : 'Cannot schedule students from different groups at once. Please select students from one group only.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Live Exam Monitor - show for groups with scheduled exams */}
        {(() => {
          const scheduledGroups = new Map<string, { groupId: string; quizId: string; groupName: string }>();
          candidates.filter(c => c.status === 'exam_scheduled' && c.final_exam_quiz_id).forEach(c => {
            if (!scheduledGroups.has(c.group_id)) {
              scheduledGroups.set(c.group_id, { groupId: c.group_id, quizId: c.final_exam_quiz_id!, groupName: getGroupName(c) });
            }
          });
          if (scheduledGroups.size === 0) return null;
          return (
            <div className="space-y-3">
              {Array.from(scheduledGroups.values()).map(g => (
                <ExamLiveMonitor key={g.groupId} quizId={g.quizId} groupId={g.groupId} />
              ))}
            </div>
          );
        })()}

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground`} />
          <Input
            placeholder={isRTL ? 'بحث بالاسم أو المجموعة...' : 'Search by name or group...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="ps-9 bg-card"
          />
        </div>

        {/* Content */}
        {loading ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
                <div className="relative p-4 rounded-full bg-primary/10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-5 rounded-2xl bg-muted/50 mb-5">
                <Target className="h-12 w-12 text-muted-foreground/30" />
              </div>
              <h3 className="text-lg font-semibold mb-1.5">
                {isRTL ? 'لا يوجد طلاب حالياً' : 'No Students Yet'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                {isRTL
                  ? 'سيظهر هنا الطلاب الذين أكملوا عدد السيشنات المطلوبة وجاهزين للامتحان النهائي'
                  : 'Students who complete their required sessions will appear here ready for final exam scheduling'}
              </p>
            </CardContent>
          </Card>
        ) : isMobile ? (
          /* ─── Mobile: Grouped Card View ─── */
          <div className="space-y-4">
            {groupedCandidates.map(([groupId, { groupName, candidates: groupCandidates }]) => (
              <div key={groupId} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{groupName}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{groupCandidates.length}</Badge>
                </div>
                <div className="space-y-2">
                  {groupCandidates.map(c => {
                    const waitDays = getWaitDays(c);
                    const slaThreshold = c.status === 'awaiting_exam' ? 7 : 14;
                    const isOverdue = waitDays >= slaThreshold;

                    return (
                      <Card
                        key={c.progress_id}
                        className={`overflow-hidden transition-all duration-200 ${
                          selectedIds.has(c.progress_id)
                            ? 'ring-2 ring-primary/30 bg-primary/[0.02]'
                            : 'hover:shadow-sm'
                        }`}
                      >
                        <CardContent className="p-3.5">
                          <div className="flex items-start gap-3">
                            {isAdmin && c.status === 'awaiting_exam' && (
                              <div className="pt-0.5" onClick={e => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedIds.has(c.progress_id)}
                                  onCheckedChange={() => handleToggleSelect(c.progress_id)}
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0" onClick={() => navigate(`/student/${c.student_id}`)}>
                              <div className="flex items-center gap-2.5 mb-2.5">
                                <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
                                  <AvatarImage src={c.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                                    {getName(c)?.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold truncate">{getName(c)}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                                      {getLevelName(c)}
                                    </Badge>
                                    {c.status === 'graded' ? (
                                      <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-0 text-[10px] py-0 px-1.5">
                                        <FileText className="h-2.5 w-2.5 me-0.5" />
                                        {isRTL ? 'تصحيح يدوي' : 'Needs Grading'}
                                      </Badge>
                                    ) : c.status === 'exam_scheduled' ? (
                                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0 text-[10px] py-0 px-1.5">
                                        <CheckCircle2 className="h-2.5 w-2.5 me-0.5" />
                                        {isRTL ? 'مجدول' : 'Scheduled'}
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0 text-[10px] py-0 px-1.5">
                                        <Clock className="h-2.5 w-2.5 me-0.5" />
                                        {isRTL ? 'في الانتظار' : 'Awaiting'}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Bottom info row */}
                              <div className="flex items-center gap-2 flex-wrap">
                                {c.exam_scheduled_at && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 rounded-md px-2 py-0.5">
                                    <CalendarClock className="h-3 w-3" />
                                    {formatExamDate(c.exam_scheduled_at)}
                                  </span>
                                )}
                                {waitDays > 0 && (
                                  <span className={`inline-flex items-center gap-1 text-[11px] rounded-md px-2 py-0.5 ${
                                    isOverdue
                                      ? 'bg-destructive/10 text-destructive'
                                      : 'bg-muted/50 text-muted-foreground'
                                  }`}>
                                    <Timer className="h-3 w-3" />
                                    {waitDays} {isRTL ? 'يوم' : 'd'}
                                  </span>
                                )}
                                {c.final_exam_quiz_id ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="h-3 w-3" />
                                    {isRTL ? 'كويز' : 'Quiz'}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
                                    <AlertTriangle className="h-3 w-3" />
                                    {isRTL ? 'بدون كويز' : 'No quiz'}
                                  </span>
                                )}
                              </div>

                              {/* Action buttons */}
                              {isAdmin && (c.status === 'exam_scheduled' || c.status === 'graded') && c.exam_submitted_at && c.final_exam_quiz_id && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 mt-2.5 w-full"
                                  onClick={(e) => { e.stopPropagation(); setGradingCandidate(c); setShowGradingDialog(true); }}
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  {isRTL ? 'تصحيح الامتحان' : 'Grade Exam'}
                                </Button>
                              )}
                              {isAdmin && c.status === 'exam_scheduled' && !c.exam_submitted_at && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1.5 mt-2.5 w-full"
                                  onClick={(e) => { e.stopPropagation(); handleOpenReschedule(c); }}
                                >
                                  <CalendarClock className="h-3.5 w-3.5" />
                                  {isRTL ? 'إعادة جدولة' : 'Reschedule'}
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ─── Desktop: Clean Table View ─── */
          <Card className="overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  {isRTL
                    ? `${filtered.length} طالب`
                    : `${filtered.length} student${filtered.length !== 1 ? 's' : ''}`}
                </p>
                {selectedCandidates.length > 0 && (
                  <>
                    <Separator orientation="vertical" className="h-4" />
                    <Badge className="bg-primary/10 text-primary border-0 text-xs gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {isRTL ? `${selectedCandidates.length} محدد` : `${selectedCandidates.length} selected`}
                    </Badge>
                  </>
                )}
              </div>
              {isAdmin && filtered.some(c => c.status === 'awaiting_exam') && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleSelectAll}>
                  {filtered.filter(c => c.status === 'awaiting_exam').every(c => selectedIds.has(c.progress_id))
                    ? (isRTL ? 'إلغاء تحديد الكل' : 'Deselect All')
                    : (isRTL ? 'تحديد الكل' : 'Select All')}
                </Button>
              )}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/20">
                    {isAdmin && <TableHead className="w-12 text-center"></TableHead>}
                    <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                    <TableHead>{isRTL ? 'المجموعة' : 'Group'}</TableHead>
                    <TableHead>{isRTL ? 'المستوى' : 'Level'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'الموعد' : 'Date'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'الانتظار' : 'Wait'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'الكويز' : 'Quiz'}</TableHead>
                    {isAdmin && <TableHead className="text-center w-28">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => {
                    const waitDays = getWaitDays(c);
                    const slaThreshold = c.status === 'awaiting_exam' ? 7 : 14;
                    const isOverdue = waitDays >= slaThreshold;
                    const isSelected = selectedIds.has(c.progress_id);

                    return (
                      <TableRow
                        key={c.progress_id}
                        className={`transition-colors group ${
                          isSelected
                            ? 'bg-primary/[0.04] hover:bg-primary/[0.07]'
                            : 'hover:bg-muted/40'
                        }`}
                      >
                        {isAdmin && (
                          <TableCell onClick={e => e.stopPropagation()} className="text-center px-3">
                            {c.status === 'awaiting_exam' && (
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleToggleSelect(c.progress_id)}
                              />
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <div
                            className="flex items-center gap-2.5 cursor-pointer group/name"
                            onClick={() => navigate(`/student/${c.student_id}`)}
                          >
                            <Avatar className="h-8 w-8 ring-1 ring-border shadow-sm">
                              <AvatarImage src={c.avatar_url || undefined} />
                              <AvatarFallback className="text-[11px] font-bold bg-primary/10 text-primary">
                                {getName(c)?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium group-hover/name:text-primary transition-colors">
                              {getName(c)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                            onClick={() => navigate(`/group/${c.group_id}`)}
                          >
                            {getGroupName(c)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-normal px-2">
                            {getLevelName(c)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {c.status === 'exam_scheduled' ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0 text-xs gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              {isRTL ? 'مجدول' : 'Scheduled'}
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0 text-xs gap-1">
                              <Clock className="h-3 w-3" />
                              {isRTL ? 'في الانتظار' : 'Awaiting'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {c.exam_scheduled_at ? (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <CalendarClock className="h-3.5 w-3.5" />
                              {formatExamDate(c.exam_scheduled_at)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {waitDays > 0 ? (
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                              isOverdue
                                ? 'bg-destructive/10 text-destructive'
                                : 'text-muted-foreground'
                            }`}>
                              {isOverdue && <AlertTriangle className="h-3 w-3" />}
                              {waitDays} {isRTL ? 'يوم' : 'd'}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {c.final_exam_quiz_id ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-destructive">
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-center">
                            {c.status === 'exam_scheduled' && c.exam_submitted_at && c.final_exam_quiz_id ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 h-7 text-xs"
                                onClick={() => { setGradingCandidate(c); setShowGradingDialog(true); }}
                              >
                                <FileText className="h-3 w-3" />
                                {isRTL ? 'تصحيح' : 'Grade'}
                              </Button>
                            ) : c.status === 'exam_scheduled' && !c.exam_submitted_at ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 h-7 text-xs"
                                onClick={() => handleOpenReschedule(c)}
                              >
                                <CalendarClock className="h-3 w-3" />
                                {isRTL ? 'إعادة جدولة' : 'Reschedule'}
                              </Button>
                            ) : (
                              <span className="text-muted-foreground/20">—</span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        {/* Schedule Dialog */}
        <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CalendarClock className="h-5 w-5 text-primary" />
                </div>
                {rescheduleCandidate
                  ? (isRTL ? 'إعادة جدولة الامتحان النهائي' : 'Reschedule Final Exam')
                  : (isRTL ? 'جدولة الامتحان النهائي' : 'Schedule Final Exam')}
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
                <div className="max-h-32 overflow-y-auto border rounded-xl p-3 space-y-2 bg-muted/20">
                  {selectedCandidates.map(c => (
                    <div key={c.progress_id} className="flex items-center gap-2.5 text-sm">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={c.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">{getName(c)?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{getName(c)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="exam-date" className="text-sm">{isRTL ? 'تاريخ الامتحان' : 'Exam Date'}</Label>
                  <Input
                    id="exam-date"
                    type="date"
                    value={scheduleDate}
                    onChange={e => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="bg-card"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="exam-time" className="text-sm">{isRTL ? 'الوقت' : 'Time'}</Label>
                    <Input
                      id="exam-time"
                      type="time"
                      value={scheduleTime}
                      onChange={e => setScheduleTime(e.target.value)}
                      className="bg-card"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button onClick={handleSchedule} disabled={scheduling || !scheduleDate || !scheduleTime} className="gap-2">
                {scheduling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isRTL ? 'جاري الجدولة...' : 'Scheduling...'}
                  </>
                ) : (
                  <>
                    <CalendarClock className="h-4 w-4" />
                    {isRTL ? 'تأكيد الجدولة' : 'Confirm Schedule'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Grading Dialog */}
        {gradingCandidate && gradingCandidate.final_exam_quiz_id && (
          <QuizResultsDialog
            open={showGradingDialog}
            onOpenChange={(open) => { setShowGradingDialog(open); if (!open) setGradingCandidate(null); }}
            quizAssignmentId=""
            quizId={gradingCandidate.final_exam_quiz_id}
            quizTitle={`Final Exam - ${gradingCandidate.level_name}`}
            quizTitleAr={`الامتحان النهائي - ${gradingCandidate.level_name_ar || gradingCandidate.level_name}`}
            groupId={gradingCandidate.group_id}
            passingScore={60}
            isFinalExam
          />
        )}
      </div>
    </DashboardLayout>
  );
}
