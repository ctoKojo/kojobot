import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/timeUtils';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FileQuestion, Users, Trophy, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

interface QuizStats {
  totalQuizzes: number;
  totalSubmissions: number;
  averageScore: number;
  passRate: number;
}

interface QuizSubmission {
  id: string;
  student_name: string;
  student_name_ar: string;
  quiz_title: string;
  quiz_title_ar: string;
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  status: string;
  submitted_at: string | null;
}

interface QuizPerformance {
  quiz_id: string;
  quiz_title: string;
  quiz_title_ar: string;
  submissions_count: number;
  average_score: number;
  pass_count: number;
  fail_count: number;
}

export default function QuizReportsPage() {
  const { t, isRTL, language } = useLanguage();
  const { role } = useAuth();
  const [stats, setStats] = useState<QuizStats>({
    totalQuizzes: 0,
    totalSubmissions: 0,
    averageScore: 0,
    passRate: 0,
  });
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [quizPerformance, setQuizPerformance] = useState<QuizPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState<string>('all');
  const [quizzes, setQuizzes] = useState<{ id: string; title: string; title_ar: string }[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch all quizzes
      const { data: quizzesData } = await supabase
        .from('quizzes')
        .select('id, title, title_ar')
        .eq('is_active', true);

      setQuizzes(quizzesData || []);

      // Fetch all submissions with student and quiz info
      const { data: submissionsData } = await supabase
        .from('quiz_submissions')
        .select(`
          id,
          score,
          max_score,
          percentage,
          status,
          submitted_at,
          student_id,
          quiz_assignment_id
        `)
        .order('submitted_at', { ascending: false });

      if (submissionsData && submissionsData.length > 0) {
        // Fetch student profiles and quiz assignments
        const studentIds = [...new Set(submissionsData.map(s => s.student_id))];
        const assignmentIds = [...new Set(submissionsData.map(s => s.quiz_assignment_id))];

        const [profilesRes, assignmentsRes] = await Promise.all([
          supabase.from('profiles').select('user_id, full_name, full_name_ar').in('user_id', studentIds),
          supabase.from('quiz_assignments').select('id, quiz_id').in('id', assignmentIds),
        ]);

        const profiles = profilesRes.data || [];
        const assignments = assignmentsRes.data || [];

        // Get quiz details for assignments
        const quizIds = [...new Set(assignments.map(a => a.quiz_id))];
        const { data: quizDetailsData } = await supabase
          .from('quizzes')
          .select('id, title, title_ar, passing_score')
          .in('id', quizIds);

        const quizDetails = quizDetailsData || [];

        // Build enriched submissions
        const enrichedSubmissions: QuizSubmission[] = submissionsData.map(sub => {
          const profile = profiles.find(p => p.user_id === sub.student_id);
          const assignment = assignments.find(a => a.id === sub.quiz_assignment_id);
          const quiz = quizDetails.find(q => q.id === assignment?.quiz_id);

          return {
            id: sub.id,
            student_name: profile?.full_name || 'Unknown',
            student_name_ar: profile?.full_name_ar || 'غير معروف',
            quiz_title: quiz?.title || 'Unknown Quiz',
            quiz_title_ar: quiz?.title_ar || 'كويز غير معروف',
            score: sub.score,
            max_score: sub.max_score,
            percentage: sub.percentage,
            status: sub.status,
            submitted_at: sub.submitted_at,
          };
        });

        setSubmissions(enrichedSubmissions);

        // Calculate stats
        const completedSubmissions = submissionsData.filter(s => s.status === 'graded' && s.percentage !== null);
        const passedSubmissions = completedSubmissions.filter(s => (s.percentage || 0) >= 60);

        setStats({
          totalQuizzes: quizzesData?.length || 0,
          totalSubmissions: submissionsData.length,
          averageScore: completedSubmissions.length > 0
            ? Math.round(completedSubmissions.reduce((sum, s) => sum + (s.percentage || 0), 0) / completedSubmissions.length)
            : 0,
          passRate: completedSubmissions.length > 0
            ? Math.round((passedSubmissions.length / completedSubmissions.length) * 100)
            : 0,
        });

        // Calculate per-quiz performance
        const quizPerfMap = new Map<string, QuizPerformance>();
        
        for (const sub of submissionsData) {
          const assignment = assignments.find(a => a.id === sub.quiz_assignment_id);
          if (!assignment) continue;
          
          const quiz = quizDetails.find(q => q.id === assignment.quiz_id);
          if (!quiz) continue;

          if (!quizPerfMap.has(quiz.id)) {
            quizPerfMap.set(quiz.id, {
              quiz_id: quiz.id,
              quiz_title: quiz.title,
              quiz_title_ar: quiz.title_ar,
              submissions_count: 0,
              average_score: 0,
              pass_count: 0,
              fail_count: 0,
            });
          }

          const perf = quizPerfMap.get(quiz.id)!;
          perf.submissions_count++;

          if (sub.status === 'graded' && sub.percentage !== null) {
            perf.average_score += sub.percentage;
            if (sub.percentage >= (quiz.passing_score || 60)) {
              perf.pass_count++;
            } else {
              perf.fail_count++;
            }
          }
        }

        // Calculate averages
        const perfArray = Array.from(quizPerfMap.values()).map(p => ({
          ...p,
          average_score: p.submissions_count > 0 ? Math.round(p.average_score / p.submissions_count) : 0,
        }));

        setQuizPerformance(perfArray);
      }
    } catch (error) {
      console.error('Error fetching quiz reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubmissions = selectedQuiz === 'all'
    ? submissions
    : submissions.filter(s => {
        const quiz = quizzes.find(q => q.title === s.quiz_title || q.title_ar === s.quiz_title_ar);
        return quiz?.id === selectedQuiz;
      });

  const COLORS = ['#22c55e', '#ef4444'];

  const pieData = [
    { name: isRTL ? 'ناجح' : 'Passed', value: stats.passRate },
    { name: isRTL ? 'راسب' : 'Failed', value: 100 - stats.passRate },
  ];

  const barData = quizPerformance.map(q => ({
    name: language === 'ar' ? q.quiz_title_ar : q.quiz_title,
    average: q.average_score,
    submissions: q.submissions_count,
  }));

  const getStatusBadge = (status: string, percentage: number | null) => {
    if (status === 'in_progress') {
      return <Badge variant="outline">{isRTL ? 'جاري' : 'In Progress'}</Badge>;
    }
    if (status === 'graded' && percentage !== null) {
      const passed = percentage >= 60;
      return (
        <Badge variant={passed ? 'default' : 'destructive'} className={passed ? 'bg-green-500' : ''}>
          {passed ? (isRTL ? 'ناجح' : 'Passed') : (isRTL ? 'راسب' : 'Failed')}
        </Badge>
      );
    }
    return <Badge variant="secondary">{isRTL ? 'في الانتظار' : 'Pending'}</Badge>;
  };

  if (role !== 'admin') {
    return (
      <DashboardLayout title={isRTL ? 'تقارير الكويزات' : 'Quiz Reports'}>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {isRTL ? 'غير مصرح لك بالوصول لهذه الصفحة' : 'You are not authorized to access this page'}
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={isRTL ? 'تقارير الكويزات' : 'Quiz Reports'}>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {isRTL ? 'إجمالي الكويزات' : 'Total Quizzes'}
              </CardTitle>
              <FileQuestion className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalQuizzes}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {isRTL ? 'إجمالي المحاولات' : 'Total Attempts'}
              </CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSubmissions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {isRTL ? 'متوسط الدرجات' : 'Average Score'}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageScore}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {isRTL ? 'نسبة النجاح' : 'Pass Rate'}
              </CardTitle>
              <Trophy className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.passRate}%</div>
              <Progress value={stats.passRate} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Bar Chart - Quiz Performance */}
          <Card>
            <CardHeader>
              <CardTitle>{isRTL ? 'أداء الكويزات' : 'Quiz Performance'}</CardTitle>
              <CardDescription>
                {isRTL ? 'متوسط الدرجات لكل كويز' : 'Average scores per quiz'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="average" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  {isRTL ? 'لا توجد بيانات' : 'No data available'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pie Chart - Pass/Fail Rate */}
          <Card>
            <CardHeader>
              <CardTitle>{isRTL ? 'نسبة النجاح/الرسوب' : 'Pass/Fail Distribution'}</CardTitle>
              <CardDescription>
                {isRTL ? 'توزيع نتائج الطلاب' : 'Student results distribution'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats.totalSubmissions > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}%`}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  {isRTL ? 'لا توجد بيانات' : 'No data available'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Submissions Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>{isRTL ? 'نتائج الطلاب' : 'Student Results'}</CardTitle>
                <CardDescription>
                  {isRTL ? 'جميع محاولات حل الكويزات' : 'All quiz submission attempts'}
                </CardDescription>
              </div>
              <Select value={selectedQuiz} onValueChange={setSelectedQuiz}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={isRTL ? 'اختر كويز' : 'Select quiz'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? 'جميع الكويزات' : 'All Quizzes'}</SelectItem>
                  {quizzes.map(quiz => (
                    <SelectItem key={quiz.id} value={quiz.id}>
                      {language === 'ar' ? quiz.title_ar : quiz.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">
                {t.common.loading}
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {isRTL ? 'لا توجد نتائج' : 'No results found'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                      <TableHead>{isRTL ? 'الكويز' : 'Quiz'}</TableHead>
                      <TableHead>{isRTL ? 'الدرجة' : 'Score'}</TableHead>
                      <TableHead>{isRTL ? 'النسبة' : 'Percentage'}</TableHead>
                      <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead>{isRTL ? 'تاريخ التسليم' : 'Submitted'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubmissions.slice(0, 50).map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">
                          {language === 'ar' ? sub.student_name_ar : sub.student_name}
                        </TableCell>
                        <TableCell>
                          {language === 'ar' ? sub.quiz_title_ar : sub.quiz_title}
                        </TableCell>
                        <TableCell>
                          {sub.score !== null ? `${sub.score}/${sub.max_score}` : '-'}
                        </TableCell>
                        <TableCell>
                          {sub.percentage !== null ? (
                            <div className="flex items-center gap-2">
                              <span>{sub.percentage}%</span>
                              {sub.percentage >= 60 ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(sub.status, sub.percentage)}
                        </TableCell>
                        <TableCell>
                          {sub.submitted_at 
                            ? formatDate(sub.submitted_at, language)
                            : '-'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
