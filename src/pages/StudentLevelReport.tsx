import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, ArrowRight, Printer, Loader2, GraduationCap, ClipboardCheck, FileText, BookOpen, Award, CalendarCheck } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { formatDate } from '@/lib/timeUtils';
import { cn } from '@/lib/utils';
import { getStudentOutcomeLabel } from '@/lib/constants';

interface ReportData {
  student: { user_id: string; full_name: string; full_name_ar: string | null; email: string; phone: string | null; avatar_url: string | null };
  level: { id: string; name: string; name_ar: string; expected_sessions: number | null };
  group: { id: string; name: string; name_ar: string; status: string } | null;
  attendance: Array<{
    session_id: string; session_number: number | null; session_date: string; session_time: string;
    topic: string | null; topic_ar: string | null; session_status: string; is_makeup: boolean;
    attendance_status: string | null; recorded_at: string | null; notes: string | null;
  }>;
  attendance_stats: {
    total_sessions: number; present: number; absent: number; late: number; excused: number;
    unrecorded: number; attendance_rate: number;
  };
  evaluations: Array<{
    id: string; session_number: number | null; session_date: string; topic_ar: string | null; topic: string | null;
    total_behavior_score: number; max_behavior_score: number; quiz_score: number | null; quiz_max_score: number | null;
    assignment_score: number | null; assignment_max_score: number | null;
    total_score: number | null; max_total_score: number | null; percentage: number | null;
    tags: string[] | null; notes: string | null;
  }>;
  quizzes: Array<{
    assignment_id: string; quiz_id: string; title: string; title_ar: string;
    session_number: number | null; session_date: string | null;
    due_date: string | null; passing_score: number;
    submission_status: string | null; submitted_at: string | null;
    score: number | null; max_score: number | null; percentage: number | null; grading_status: string | null;
  }>;
  assignments: Array<{
    assignment_id: string; title: string; title_ar: string;
    session_number: number | null; session_date: string | null;
    due_date: string; max_score: number | null;
    submission_status: string | null; submitted_at: string | null;
    score: number | null; feedback: string | null; feedback_ar: string | null;
  }>;
  final_exam: {
    quiz_id: string | null; title: string | null; title_ar: string | null; passing_score: number | null;
    assignment_id: string | null; submission_id: string | null; submission_status: string | null;
    started_at: string | null; submitted_at: string | null; graded_at: string | null;
    score: number | null; max_score: number | null; percentage: number | null; grading_status: string | null;
  } | null;
  grade: {
    evaluation_avg: number | null; final_exam_score: number | null;
    total_score: number | null; percentage: number | null; outcome: string | null; notes: string | null;
  } | null;
  generated_at: string;
}

function pctColor(pct: number | null | undefined) {
  if (pct == null) return 'text-muted-foreground';
  if (pct >= 85) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 70) return 'text-lime-600 dark:text-lime-400';
  if (pct >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-destructive';
}

function attBadge(status: string | null, isRTL: boolean) {
  if (!status) return <Badge variant="outline" className="text-xs">{isRTL ? 'لم يُسجل' : 'Unrecorded'}</Badge>;
  const map: Record<string, { label_ar: string; label_en: string; cls: string }> = {
    present: { label_ar: 'حاضر', label_en: 'Present', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
    absent: { label_ar: 'غائب', label_en: 'Absent', cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
    late: { label_ar: 'متأخر', label_en: 'Late', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
    excused: { label_ar: 'بعذر', label_en: 'Excused', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  };
  const m = map[status];
  if (!m) return <Badge variant="outline">{status}</Badge>;
  return <Badge className={cn('text-xs', m.cls)}>{isRTL ? m.label_ar : m.label_en}</Badge>;
}

export default function StudentLevelReport() {
  const { studentId, levelId } = useParams<{ studentId: string; levelId: string }>();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('group') || undefined;
  const navigate = useNavigate();
  const { isRTL, language } = useLanguage();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      if (!studentId || !levelId) return;
      setLoading(true);
      setError(null);
      try {
        const { data: result, error: rpcError } = await supabase.rpc('get_student_level_report', {
          p_student_id: studentId,
          p_level_id: levelId,
          p_group_id: groupId ?? null,
        });
        if (rpcError) throw rpcError;
        setData(result as unknown as ReportData);
      } catch (err: any) {
        console.error('Level report error:', err);
        setError(err.message || 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [studentId, levelId, groupId]);

  const studentName = data?.student
    ? (language === 'ar' ? (data.student.full_name_ar || data.student.full_name) : data.student.full_name)
    : '';
  const levelName = data?.level
    ? (language === 'ar' ? data.level.name_ar : data.level.name)
    : '';
  const groupName = data?.group
    ? (language === 'ar' ? (data.group.name_ar || data.group.name) : data.group.name)
    : '';

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <Card className="max-w-2xl mx-auto mt-8">
          <CardContent className="p-8 text-center">
            <p className="text-destructive mb-4">{error || (isRTL ? 'لا توجد بيانات' : 'No data')}</p>
            <Button onClick={() => navigate(-1)}>{isRTL ? 'رجوع' : 'Back'}</Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Toolbar — hidden on print */}
        <div className="flex items-center justify-between gap-3 print:hidden">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <BackIcon className="h-4 w-4 me-2" />
            {isRTL ? 'رجوع' : 'Back'}
          </Button>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" />
            {isRTL ? 'طباعة / حفظ PDF' : 'Print / Save PDF'}
          </Button>
        </div>

        {/* Header */}
        <Card className="border-2 border-primary/20 print:border-primary print:shadow-none">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <GraduationCap className="h-6 w-6 text-primary" />
                  {isRTL ? 'تقرير المستوى الشامل' : 'Comprehensive Level Report'}
                </CardTitle>
                <CardDescription className="mt-1">
                  {isRTL ? `تم الإنشاء في ${formatDate(data.generated_at)}` : `Generated on ${formatDate(data.generated_at)}`}
                </CardDescription>
              </div>
              {data.grade?.outcome && (
                <Badge
                  variant={data.grade.outcome === 'passed' ? 'default' : 'destructive'}
                  className="text-base px-4 py-2"
                >
                  {getStudentOutcomeLabel(data.grade.outcome, isRTL)}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? 'الطالب' : 'Student'}</p>
                <p className="font-semibold">{studentName}</p>
                <p className="text-xs text-muted-foreground">{data.student.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? 'المستوى' : 'Level'}</p>
                <p className="font-semibold">{levelName}</p>
                {data.level.expected_sessions != null && (
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? `${data.level.expected_sessions} حصة متوقعة` : `${data.level.expected_sessions} expected sessions`}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? 'المجموعة' : 'Group'}</p>
                <p className="font-semibold">{groupName || '-'}</p>
                {data.group?.status && (
                  <p className="text-xs text-muted-foreground capitalize">{data.group.status}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Final Grade Summary */}
        {data.grade && (
          <Card className="border-2 print:shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                {isRTL ? 'النتيجة النهائية للمستوى' : 'Final Level Result'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className={cn('text-3xl font-bold', pctColor(data.grade.evaluation_avg))}>
                    {data.grade.evaluation_avg != null ? `${Math.round(data.grade.evaluation_avg)}%` : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{isRTL ? 'متوسط التقييمات' : 'Evaluations Avg'}</p>
                  <p className="text-[10px] text-muted-foreground">60%</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className={cn('text-3xl font-bold', pctColor(data.grade.final_exam_score))}>
                    {data.grade.final_exam_score != null ? `${Math.round(data.grade.final_exam_score)}%` : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{isRTL ? 'الامتحان النهائي' : 'Final Exam'}</p>
                  <p className="text-[10px] text-muted-foreground">40%</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-primary/10">
                  <p className={cn('text-3xl font-bold', pctColor(data.grade.percentage))}>
                    {data.grade.percentage != null ? `${Math.round(data.grade.percentage)}%` : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{isRTL ? 'النسبة الإجمالية' : 'Overall %'}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50 flex flex-col items-center justify-center">
                  {data.grade.outcome ? (
                    <Badge
                      variant={data.grade.outcome === 'passed' ? 'default' : 'destructive'}
                      className="text-base px-3 py-1"
                    >
                      {getStudentOutcomeLabel(data.grade.outcome, isRTL)}
                    </Badge>
                  ) : (
                    <p className="text-sm text-muted-foreground">{isRTL ? 'لم يُحدد بعد' : 'Not graded yet'}</p>
                  )}
                </div>
              </div>
              {data.grade.notes && (
                <>
                  <Separator className="my-4" />
                  <p className="text-sm"><span className="font-semibold">{isRTL ? 'ملاحظات: ' : 'Notes: '}</span>{data.grade.notes}</p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Attendance */}
        <Card className="print:shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              {isRTL ? 'الحضور والغياب' : 'Attendance'}
            </CardTitle>
            <CardDescription>
              {isRTL
                ? `إجمالي ${data.attendance_stats.total_sessions} حصة • نسبة الحضور ${data.attendance_stats.attendance_rate}%`
                : `${data.attendance_stats.total_sessions} sessions • ${data.attendance_stats.attendance_rate}% attendance`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              {([
                ['present', 'حاضر', 'Present', 'text-emerald-600'],
                ['absent', 'غائب', 'Absent', 'text-destructive'],
                ['late', 'متأخر', 'Late', 'text-amber-600'],
                ['excused', 'بعذر', 'Excused', 'text-blue-600'],
                ['unrecorded', 'لم يُسجل', 'Unrecorded', 'text-muted-foreground'],
              ] as const).map(([key, ar, en, color]) => (
                <div key={key} className="text-center p-3 rounded-lg bg-muted/50">
                  <p className={cn('text-2xl font-bold', color)}>{(data.attendance_stats as any)[key] ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">{isRTL ? ar : en}</p>
                </div>
              ))}
            </div>
            {data.attendance.length > 0 ? (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                      <TableHead>{isRTL ? 'الموضوع' : 'Topic'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.attendance.map((s) => (
                      <TableRow key={s.session_id}>
                        <TableCell className="text-center text-sm font-medium">
                          {s.session_number ?? '-'}
                          {s.is_makeup && <Badge variant="outline" className="ms-1 text-[10px]">{isRTL ? 'تعويضي' : 'M'}</Badge>}
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(s.session_date)}</TableCell>
                        <TableCell className="text-sm">
                          {(language === 'ar' ? s.topic_ar : s.topic) || '-'}
                        </TableCell>
                        <TableCell className="text-center">{attBadge(s.attendance_status, isRTL)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4 text-sm">{isRTL ? 'لا توجد حصص' : 'No sessions'}</p>
            )}
          </CardContent>
        </Card>

        {/* Evaluations */}
        <Card className="print:shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              {isRTL ? 'تقييمات السيشن' : 'Session Evaluations'}
            </CardTitle>
            <CardDescription>
              {isRTL ? `${data.evaluations.length} تقييم` : `${data.evaluations.length} evaluations`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.evaluations.length > 0 ? (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'السلوك' : 'Behavior'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'كويز' : 'Quiz'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'واجب' : 'Assign.'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'الإجمالي' : 'Total'}</TableHead>
                      <TableHead className="text-center">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.evaluations.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-center text-sm">{e.session_number ?? '-'}</TableCell>
                        <TableCell className="text-sm">{formatDate(e.session_date)}</TableCell>
                        <TableCell className="text-center text-sm">{e.total_behavior_score}/{e.max_behavior_score}</TableCell>
                        <TableCell className="text-center text-sm">{e.quiz_score != null ? `${e.quiz_score}/${e.quiz_max_score}` : '-'}</TableCell>
                        <TableCell className="text-center text-sm">{e.assignment_score != null ? `${e.assignment_score}/${e.assignment_max_score}` : '-'}</TableCell>
                        <TableCell className="text-center text-sm font-medium">
                          {e.total_score != null ? `${e.total_score}/${e.max_total_score}` : '-'}
                        </TableCell>
                        <TableCell className={cn('text-center text-sm font-bold', pctColor(e.percentage))}>
                          {e.percentage != null ? `${e.percentage}%` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4 text-sm">{isRTL ? 'لا توجد تقييمات' : 'No evaluations'}</p>
            )}
          </CardContent>
        </Card>

        {/* Quizzes */}
        <Card className="print:shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {isRTL ? 'الكويزات' : 'Quizzes'}
            </CardTitle>
            <CardDescription>
              {isRTL ? `${data.quizzes.length} كويز` : `${data.quizzes.length} quizzes`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.quizzes.length > 0 ? (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'الكويز' : 'Quiz'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'سيشن' : 'Session'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'الدرجة' : 'Score'}</TableHead>
                      <TableHead className="text-center">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.quizzes.map((q) => {
                      const passed = q.percentage != null && q.percentage >= (q.passing_score ?? 60);
                      return (
                        <TableRow key={q.assignment_id}>
                          <TableCell className="text-sm font-medium">{language === 'ar' ? q.title_ar : q.title}</TableCell>
                          <TableCell className="text-center text-sm">{q.session_number ?? '-'}</TableCell>
                          <TableCell className="text-center">
                            {q.submission_status ? (
                              <Badge variant={q.submission_status === 'graded' ? 'default' : 'secondary'} className="text-xs capitalize">
                                {q.submission_status}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">{isRTL ? 'لم يُحل' : 'Not taken'}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {q.score != null ? `${q.score}/${q.max_score}` : '-'}
                          </TableCell>
                          <TableCell className={cn('text-center text-sm font-bold', pctColor(q.percentage))}>
                            {q.percentage != null ? `${q.percentage}%${passed ? ' ✓' : ' ✗'}` : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4 text-sm">{isRTL ? 'لا توجد كويزات' : 'No quizzes'}</p>
            )}
          </CardContent>
        </Card>

        {/* Assignments */}
        <Card className="print:shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {isRTL ? 'الواجبات' : 'Assignments'}
            </CardTitle>
            <CardDescription>
              {isRTL ? `${data.assignments.length} واجب` : `${data.assignments.length} assignments`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.assignments.length > 0 ? (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'الواجب' : 'Assignment'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'سيشن' : 'Session'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'الدرجة' : 'Score'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.assignments.map((a) => (
                      <TableRow key={a.assignment_id}>
                        <TableCell className="text-sm font-medium">{language === 'ar' ? a.title_ar : a.title}</TableCell>
                        <TableCell className="text-center text-sm">{a.session_number ?? '-'}</TableCell>
                        <TableCell className="text-center">
                          {a.submission_status ? (
                            <Badge variant={a.submission_status === 'graded' ? 'default' : 'secondary'} className="text-xs capitalize">
                              {a.submission_status}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">{isRTL ? 'لم يُسلم' : 'Not submitted'}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-sm font-medium">
                          {a.score != null ? `${a.score}/${a.max_score ?? 100}` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4 text-sm">{isRTL ? 'لا توجد واجبات' : 'No assignments'}</p>
            )}
          </CardContent>
        </Card>

        {/* Final Exam */}
        {data.final_exam?.quiz_id && (
          <Card className="border-2 border-amber-500/30 print:shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                {isRTL ? 'الامتحان النهائي' : 'Final Exam'}
              </CardTitle>
              <CardDescription>
                {language === 'ar' ? data.final_exam.title_ar : data.final_exam.title}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">{isRTL ? 'الحالة' : 'Status'}</p>
                  {data.final_exam.submission_status ? (
                    <Badge className="text-xs capitalize">{data.final_exam.submission_status}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">{isRTL ? 'لم يبدأ' : 'Not started'}</Badge>
                  )}
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">{isRTL ? 'الدرجة' : 'Score'}</p>
                  <p className="text-lg font-bold">
                    {data.final_exam.score != null ? `${data.final_exam.score}/${data.final_exam.max_score}` : '-'}
                  </p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">%</p>
                  <p className={cn('text-lg font-bold', pctColor(data.final_exam.percentage))}>
                    {data.final_exam.percentage != null ? `${data.final_exam.percentage}%` : '-'}
                  </p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">{isRTL ? 'تم التسليم' : 'Submitted'}</p>
                  <p className="text-sm font-medium">
                    {data.final_exam.submitted_at ? formatDate(data.final_exam.submitted_at) : '-'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
