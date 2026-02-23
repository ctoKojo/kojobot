import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getStudentProgressStatusLabel, getStudentOutcomeLabel, getGroupLevelStatusLabel } from '@/lib/constants';
import { Target, GraduationCap, Calculator, ArrowUpCircle, RotateCcw, CalendarCheck, Info } from 'lucide-react';

interface LevelProgressTabProps {
  groupId: string;
  levelId: string | null;
  levelName: string;
  onRefresh: () => void;
}

interface ProgressRecord {
  id: string;
  student_id: string;
  current_level_id: string;
  status: string;
  outcome: string | null;
  exam_scheduled_at: string | null;
  exam_submitted_at: string | null;
  graded_at: string | null;
  profiles?: { full_name: string; full_name_ar: string | null; avatar_url: string | null };
}

interface LevelGrade {
  student_id: string;
  evaluation_avg: number | null;
  final_exam_score: number | null;
  total_score: number | null;
  percentage: number | null;
  outcome: string | null;
}

type FilterType = 'all' | 'awaiting_exam' | 'exam_scheduled' | 'graded' | 'passed' | 'failed';

export function LevelProgressTab({ groupId, levelId, levelName, onRefresh }: LevelProgressTabProps) {
  const { isRTL, language } = useLanguage();
  const { role } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isAdmin = role === 'admin';

  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [grades, setGrades] = useState<LevelGrade[]>([]);
  const [levelStatus, setLevelStatus] = useState<any>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Schedule exam dialog
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [examDate, setExamDate] = useState('');
  const [examDuration, setExamDuration] = useState(60);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  // Upgrade dialog
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [upgradeStudentId, setUpgradeStudentId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [chosenTrackId, setChosenTrackId] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, [groupId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [progressRes, gradesRes, statusRes, tracksRes] = await Promise.all([
        supabase.from('group_student_progress').select('*').eq('group_id', groupId),
        supabase.from('level_grades').select('*').eq('group_id', groupId),
        supabase.rpc('get_group_level_status', { p_group_id: groupId }),
        supabase.from('tracks').select('*').eq('is_active', true),
      ]);

      // Fetch profile names for progress students
      const studentIds = (progressRes.data || []).map((p: any) => p.student_id);
      let profiles: any[] = [];
      if (studentIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, full_name_ar, avatar_url')
          .in('user_id', studentIds);
        profiles = profilesData || [];
      }

      const enrichedProgress = (progressRes.data || []).map((p: any) => ({
        ...p,
        profiles: profiles.find((pr: any) => pr.user_id === p.student_id),
      }));

      setProgress(enrichedProgress);
      setGrades((gradesRes.data || []) as LevelGrade[]);
      setLevelStatus(statusRes.data);
      setTracks(tracksRes.data || []);
    } catch (err) {
      console.error('Error fetching level progress:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProgress = progress.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'awaiting_exam') return p.status === 'awaiting_exam' || p.status === 'in_progress';
    if (filter === 'exam_scheduled') return p.status === 'exam_scheduled';
    if (filter === 'graded') return p.status === 'graded';
    if (filter === 'passed') return p.outcome === 'passed';
    if (filter === 'failed') return p.outcome === 'failed' || p.outcome === 'repeat';
    return true;
  });

  const getGrade = (studentId: string) => grades.find(g => g.student_id === studentId);

  // Banner message based on level status
  const getBanner = () => {
    if (!levelStatus) return null;
    const total = levelStatus.total_students || 0;
    if (total === 0) return null;

    const graded = levelStatus.graded || 0;
    const examScheduled = levelStatus.exam_scheduled || 0;
    const examSubmitted = levelStatus.exam_submitted || 0;
    const awaitingExam = levelStatus.awaiting_exam || 0;
    const inProgress = levelStatus.in_progress || 0;

    if (graded > 0 && graded >= examScheduled + awaitingExam) {
      return { icon: <Calculator className="h-5 w-5" />, variant: 'default' as const,
        title: isRTL ? 'الدرجات محسوبة' : 'Grades Computed',
        desc: isRTL ? 'راجع النتائج وقرر الترقية' : 'Review results and decide promotions' };
    }
    if (examScheduled > 0) {
      return { icon: <CalendarCheck className="h-5 w-5" />, variant: 'default' as const,
        title: isRTL ? 'الامتحان النهائي مجدول' : 'Final Exam Scheduled',
        desc: isRTL ? `${examSubmitted}/${examScheduled} سلموا الامتحان` : `${examSubmitted}/${examScheduled} submitted` };
    }
    if (awaitingExam > 0 || (inProgress === 0 && total > 0)) {
      return { icon: <Target className="h-5 w-5" />, variant: 'default' as const,
        title: isRTL ? 'السيشنات اكتملت' : 'Sessions Completed',
        desc: isRTL ? 'حدد موعد الامتحان النهائي' : 'Schedule the final exam' };
    }
    return null;
  };

  const handleScheduleExam = async () => {
    if (!examDate || selectedStudents.length === 0) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('schedule_final_exam_for_students', {
        p_group_id: groupId,
        p_student_ids: selectedStudents,
        p_date: new Date(examDate).toISOString(),
        p_duration: examDuration,
      });
      if (error) throw error;
      const result = data as any;
      toast({
        title: isRTL ? 'تم الجدولة' : 'Scheduled',
        description: isRTL ? `تم جدولة ${result.scheduled} طالب` : `${result.scheduled} students scheduled`,
      });
      setShowScheduleDialog(false);
      fetchData();
      onRefresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleComputeGrades = async () => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('compute_level_grades_batch', { p_group_id: groupId });
      if (error) throw error;
      const result = data as any;
      toast({
        title: isRTL ? 'تم الحساب' : 'Computed',
        description: isRTL ? `تم حساب درجات ${result.graded_count} طالب` : `${result.graded_count} students graded`,
      });
      fetchData();
      onRefresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!upgradeStudentId) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('upgrade_student_level', {
        p_student_id: upgradeStudentId,
        p_group_id: groupId,
        p_chosen_track_id: chosenTrackId || null,
      });
      if (error) throw error;
      const result = data as any;
      if (!result.upgraded) {
        toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: result.reason });
      } else {
        toast({ title: isRTL ? 'تمت الترقية' : 'Upgraded', description: isRTL ? 'تم ترقية الطالب للمستوى التالي' : 'Student promoted to next level' });
      }
      setShowUpgradeDialog(false);
      setUpgradeStudentId(null);
      setChosenTrackId('');
      fetchData();
      onRefresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRepeat = async (studentId: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('mark_student_repeat', {
        p_student_id: studentId,
        p_group_id: groupId,
      });
      if (error) throw error;
      toast({ title: isRTL ? 'تم' : 'Done', description: isRTL ? 'تم تسجيل إعادة المستوى' : 'Student marked for repeat' });
      fetchData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const banner = getBanner();
  const filterCounts = {
    all: progress.length,
    awaiting_exam: progress.filter(p => p.status === 'awaiting_exam' || p.status === 'in_progress').length,
    exam_scheduled: progress.filter(p => p.status === 'exam_scheduled').length,
    graded: progress.filter(p => p.status === 'graded').length,
    passed: progress.filter(p => p.outcome === 'passed').length,
    failed: progress.filter(p => p.outcome === 'failed' || p.outcome === 'repeat').length,
  };

  if (loading) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</CardContent></Card>;
  }

  if (progress.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
          {isRTL ? 'لا توجد بيانات تقدم بعد. يتم إنشاؤها تلقائياً عند إضافة الطلاب.' : 'No progress data yet. Created automatically when students join.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Banner */}
      {banner && (
        <Alert>
          {banner.icon}
          <AlertTitle>{banner.title}</AlertTitle>
          <AlertDescription>{banner.desc}</AlertDescription>
        </Alert>
      )}

      {/* Admin Actions */}
      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            setSelectedStudents(progress.filter(p => p.status === 'in_progress' || p.status === 'awaiting_exam').map(p => p.student_id));
            setShowScheduleDialog(true);
          }}>
            <CalendarCheck className="h-4 w-4 mr-2" />
            {isRTL ? 'جدول الامتحان النهائي' : 'Schedule Final Exam'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleComputeGrades} disabled={actionLoading}>
            <Calculator className="h-4 w-4 mr-2" />
            {isRTL ? 'احسب الدرجات النهائية' : 'Compute Final Grades'}
          </Button>
        </div>
      )}

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {([
          ['all', isRTL ? 'الكل' : 'All'],
          ['awaiting_exam', isRTL ? 'جاهزين' : 'Ready'],
          ['exam_scheduled', isRTL ? 'مجدول' : 'Scheduled'],
          ['graded', isRTL ? 'تم التقييم' : 'Graded'],
          ['passed', isRTL ? 'ناجح' : 'Passed'],
          ['failed', isRTL ? 'راسب' : 'Failed'],
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

      {/* Progress Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            {isRTL ? 'تقدم المستوى' : 'Level Progress'} - {levelName}
          </CardTitle>
          <CardDescription>
            {isRTL ? `${progress.length} طالب` : `${progress.length} students`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                <TableHead className="text-center">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                <TableHead className="text-center">{isRTL ? 'النتيجة' : 'Outcome'}</TableHead>
                <TableHead className="text-center">{isRTL ? 'تقييم' : 'Eval'}</TableHead>
                <TableHead className="text-center">{isRTL ? 'امتحان' : 'Exam'}</TableHead>
                <TableHead className="text-center">%</TableHead>
                {isAdmin && <TableHead className="text-center">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProgress.map(p => {
                const grade = getGrade(p.student_id);
                const name = language === 'ar' ? p.profiles?.full_name_ar || p.profiles?.full_name : p.profiles?.full_name;
                return (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/student/${p.student_id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={p.profiles?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">{name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-xs">
                        {getStudentProgressStatusLabel(p.status, isRTL)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {p.outcome ? (
                        <Badge variant={p.outcome === 'passed' ? 'default' : 'destructive'} className="text-xs">
                          {getStudentOutcomeLabel(p.outcome, isRTL)}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-center text-sm">{grade?.evaluation_avg ?? '-'}</TableCell>
                    <TableCell className="text-center text-sm">{grade?.final_exam_score ?? '-'}</TableCell>
                    <TableCell className="text-center text-sm font-bold">
                      {grade?.percentage != null ? `${Math.round(grade.percentage)}%` : '-'}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 justify-center">
                          {p.outcome === 'passed' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                              setUpgradeStudentId(p.student_id);
                              setShowUpgradeDialog(true);
                            }}>
                              <ArrowUpCircle className="h-3 w-3 mr-1" />
                              {isRTL ? 'ترقية' : 'Upgrade'}
                            </Button>
                          )}
                          {(p.outcome === 'failed') && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleRepeat(p.student_id)}>
                              <RotateCcw className="h-3 w-3 mr-1" />
                              {isRTL ? 'إعادة' : 'Repeat'}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Schedule Exam Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? 'جدولة الامتحان النهائي' : 'Schedule Final Exam'}</DialogTitle>
            <DialogDescription>{isRTL ? `${selectedStudents.length} طالب مؤهل` : `${selectedStudents.length} eligible students`}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{isRTL ? 'تاريخ ووقت الامتحان' : 'Exam Date & Time'}</Label>
              <Input type="datetime-local" value={examDate} onChange={e => setExamDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>{isRTL ? 'المدة (دقيقة)' : 'Duration (minutes)'}</Label>
              <Input type="number" value={examDuration} onChange={e => setExamDuration(parseInt(e.target.value) || 60)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleScheduleExam} disabled={actionLoading || !examDate}>{isRTL ? 'جدولة' : 'Schedule'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? 'ترقية الطالب' : 'Upgrade Student'}</DialogTitle>
            <DialogDescription>{isRTL ? 'اختر المسار لو المستوى يتفرع' : 'Choose track if level branches'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {tracks.length > 0 && (
              <div className="grid gap-2">
                <Label>{isRTL ? 'المسار' : 'Track'}</Label>
                <Select value={chosenTrackId} onValueChange={setChosenTrackId}>
                  <SelectTrigger><SelectValue placeholder={isRTL ? 'بدون مسار' : 'No track'} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{isRTL ? 'بدون مسار' : 'No track (linear)'}</SelectItem>
                    {tracks.map(t => (
                      <SelectItem key={t.id} value={t.id}>{isRTL ? t.name_ar : t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUpgradeDialog(false); setUpgradeStudentId(null); }}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleUpgrade} disabled={actionLoading}>{isRTL ? 'ترقية' : 'Upgrade'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
