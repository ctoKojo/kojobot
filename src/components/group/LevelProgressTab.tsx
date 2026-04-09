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
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getStudentProgressStatusLabel, getStudentOutcomeLabel } from '@/lib/constants';
import { Target, GraduationCap, Calculator, ArrowUpCircle, RotateCcw, Info } from 'lucide-react';

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

type FilterType = 'all' | 'in_progress' | 'awaiting_exam' | 'graded' | 'passed' | 'failed' | 'pending_group_assignment';

export function LevelProgressTab({ groupId, levelId, levelName, onRefresh }: LevelProgressTabProps) {
  const { isRTL, language } = useLanguage();
  const { role } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isAdmin = role === 'admin';

  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [grades, setGrades] = useState<LevelGrade[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [studentSessionCounts, setStudentSessionCounts] = useState<Record<string, number>>({});
  const [expectedSessions, setExpectedSessions] = useState<number>(12);

  // Upgrade dialog
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [upgradeStudentId, setUpgradeStudentId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [chosenTrackId, setChosenTrackId] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, [groupId]);

  useEffect(() => {
    if (levelId) {
      supabase.from('levels').select('expected_sessions_count').eq('id', levelId).single()
        .then(({ data }) => { if (data) setExpectedSessions(data.expected_sessions_count); });
    }
  }, [levelId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [progressRes, gradesRes, tracksRes] = await Promise.all([
        supabase.from('group_student_progress').select('*').eq('group_id', groupId),
        supabase.from('level_grades').select('*').eq('group_id', groupId),
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

      // Fetch per-student completed session counts for current level
      if (levelId && studentIds.length > 0) {
        const { data: attendanceCounts } = await supabase
          .from('attendance')
          .select('student_id, session_id, status, sessions!inner(group_id, level_id, status)')
          .eq('sessions.group_id', groupId)
          .eq('sessions.level_id', levelId)
          .eq('sessions.status', 'completed')
          .in('student_id', studentIds)
          .in('status', ['present', 'late']);

        const counts: Record<string, Set<string>> = {};
        (attendanceCounts || []).forEach((a: any) => {
          if (!counts[a.student_id]) counts[a.student_id] = new Set();
          counts[a.student_id].add(a.session_id);
        });
        const countMap: Record<string, number> = {};
        Object.entries(counts).forEach(([sid, set]) => { countMap[sid] = set.size; });
        setStudentSessionCounts(countMap);
      }

      setProgress(enrichedProgress);
      setGrades((gradesRes.data || []) as LevelGrade[]);
      setTracks(tracksRes.data || []);
    } catch (err) {
      console.error('Error fetching level progress:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProgress = progress.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'in_progress') return p.status === 'in_progress';
    if (filter === 'awaiting_exam') return p.status === 'awaiting_exam' || p.status === 'exam_scheduled';
    if (filter === 'graded') return p.status === 'graded';
    if (filter === 'passed') return p.outcome === 'passed';
    if (filter === 'failed') return p.outcome === 'failed' || p.outcome === 'repeat';
    return true;
  });

  const getGrade = (studentId: string) => grades.find(g => g.student_id === studentId);

  // Banner message
  const getBanner = () => {
    const awaitingCount = progress.filter(p => p.status === 'awaiting_exam').length;
    const gradedCount = progress.filter(p => p.status === 'graded').length;
    
    if (awaitingCount > 0) {
      return {
        icon: <Target className="h-5 w-5" />,
        title: isRTL ? 'طلاب جاهزون للامتحان النهائي' : 'Students Ready for Final Exam',
        desc: isRTL 
          ? `${awaitingCount} طالب أكمل السيشنات وتم إزالتهم من المجموعة تلقائياً.`
          : `${awaitingCount} student(s) completed sessions and were auto-removed.`,
        link: '/final-exams',
      };
    }
    if (gradedCount > 0) {
      return {
        icon: <Calculator className="h-5 w-5" />,
        title: isRTL ? 'الدرجات محسوبة' : 'Grades Computed',
        desc: isRTL ? 'راجع النتائج وقرر الترقية' : 'Review results and decide promotions',
      };
    }
    return null;
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
    in_progress: progress.filter(p => p.status === 'in_progress').length,
    awaiting_exam: progress.filter(p => p.status === 'awaiting_exam' || p.status === 'exam_scheduled').length,
    graded: progress.filter(p => p.status === 'graded').length,
    passed: progress.filter(p => p.outcome === 'passed').length,
    failed: progress.filter(p => p.outcome === 'failed' || p.outcome === 'repeat').length,
    pending_group_assignment: progress.filter(p => p.status === 'pending_group_assignment').length,
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
          <AlertDescription className="flex items-center justify-between">
            <span>{banner.desc}</span>
            {'link' in banner && banner.link && (
              <Button variant="outline" size="sm" className="ml-2 shrink-0" onClick={() => navigate(banner.link!)}>
                {isRTL ? 'عرض الامتحانات النهائية' : 'View Final Exams'}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Admin Actions */}
      {isAdmin && (
        <div className="flex flex-wrap gap-2 items-center">
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
          ['in_progress', isRTL ? 'قيد التقدم' : 'In Progress'],
          ['awaiting_exam', isRTL ? 'جاهز للامتحان' : 'Awaiting Exam'],
          ['graded', isRTL ? 'تم التقييم' : 'Graded'],
          ['passed', isRTL ? 'ناجح' : 'Passed'],
          ['failed', isRTL ? 'راسب' : 'Failed'],
          ['pending_group_assignment', isRTL ? 'في انتظار جروب' : 'Pending Group'],
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
                <TableHead className="text-center">{isRTL ? 'سيشنات' : 'Sessions'}</TableHead>
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
                      <span className={`text-xs font-medium ${(studentSessionCounts[p.student_id] || 0) >= expectedSessions ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {studentSessionCounts[p.student_id] || 0}/{expectedSessions}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={
                        p.status === 'awaiting_exam' ? 'default' 
                        : p.status === 'pending_group_assignment' ? 'secondary'
                        : 'secondary'
                      } className={`text-xs ${p.status === 'pending_group_assignment' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-0' : ''}`}>
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