import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, LineChart, Line, Area, AreaChart
} from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';
import { TrendingUp, TrendingDown, Minus, Trophy, Target, BookOpen, Calendar, User } from 'lucide-react';

interface StudentPerformanceChartsProps {
  attendance: any[];
  quizSubmissions: any[];
  assignmentSubmissions: any[];
  instructor?: {
    full_name: string;
    full_name_ar?: string;
  };
  groupName?: string;
  groupNameAr?: string;
}

export function StudentPerformanceCharts({
  attendance,
  quizSubmissions,
  assignmentSubmissions,
  instructor,
  groupName,
  groupNameAr,
}: StudentPerformanceChartsProps) {
  const { isRTL, language } = useLanguage();

  // Attendance Chart Data
  const attendanceData = useMemo(() => {
    const present = attendance.filter(a => a.status === 'present').length;
    const absent = attendance.filter(a => a.status === 'absent').length;
    const late = attendance.filter(a => a.status === 'late').length;
    
    return [
      { name: isRTL ? 'حاضر' : 'Present', value: present, color: '#22c55e' },
      { name: isRTL ? 'غائب' : 'Absent', value: absent, color: '#ef4444' },
      { name: isRTL ? 'متأخر' : 'Late', value: late, color: '#f59e0b' },
    ].filter(d => d.value > 0);
  }, [attendance, isRTL]);

  // Quiz Performance Data
  const quizData = useMemo(() => {
    return quizSubmissions
      .filter(q => q.status === 'completed' && q.percentage !== null)
      .slice(0, 10)
      .reverse()
      .map((q, index) => ({
        name: `${isRTL ? 'كويز' : 'Quiz'} ${index + 1}`,
        fullName: language === 'ar' 
          ? q.quiz_assignments?.quizzes?.title_ar 
          : q.quiz_assignments?.quizzes?.title,
        score: q.percentage || 0,
        passing: 60,
      }));
  }, [quizSubmissions, isRTL, language]);

  // Assignment Performance Data
  const assignmentData = useMemo(() => {
    return assignmentSubmissions
      .filter(a => a.status === 'graded' && a.score !== null)
      .slice(0, 10)
      .reverse()
      .map((a, index) => {
        const maxScore = a.assignments?.max_score || 100;
        const percentage = Math.round((a.score / maxScore) * 100);
        return {
          name: `${isRTL ? 'واجب' : 'HW'} ${index + 1}`,
          fullName: language === 'ar' 
            ? a.assignments?.title_ar 
            : a.assignments?.title,
          score: percentage,
          passing: 60,
        };
      });
  }, [assignmentSubmissions, isRTL, language]);

  // Calculate overall stats
  const overallStats = useMemo(() => {
    const totalAttendance = attendance.length;
    const presentCount = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
    const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

    const completedQuizzes = quizSubmissions.filter(q => q.status === 'completed');
    const avgQuizScore = completedQuizzes.length > 0
      ? Math.round(completedQuizzes.reduce((sum, q) => sum + (q.percentage || 0), 0) / completedQuizzes.length)
      : 0;

    const gradedAssignments = assignmentSubmissions.filter(a => a.status === 'graded' && a.score !== null);
    const avgAssignmentScore = gradedAssignments.length > 0
      ? Math.round(gradedAssignments.reduce((sum, a) => {
          const maxScore = a.assignments?.max_score || 100;
          return sum + ((a.score / maxScore) * 100);
        }, 0) / gradedAssignments.length)
      : 0;

    // Overall performance (weighted average)
    const weights = { attendance: 0.2, quiz: 0.4, assignment: 0.4 };
    const overall = Math.round(
      (attendanceRate * weights.attendance) +
      (avgQuizScore * weights.quiz) +
      (avgAssignmentScore * weights.assignment)
    );

    return { attendanceRate, avgQuizScore, avgAssignmentScore, overall };
  }, [attendance, quizSubmissions, assignmentSubmissions]);

  // Performance trend
  const getTrend = (scores: number[]) => {
    if (scores.length < 2) return 'stable';
    const recent = scores.slice(-3);
    const earlier = scores.slice(0, Math.max(1, scores.length - 3));
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
    if (recentAvg > earlierAvg + 5) return 'up';
    if (recentAvg < earlierAvg - 5) return 'down';
    return 'stable';
  };

  const quizTrend = getTrend(quizData.map(q => q.score));

  const getPerformanceLevel = (score: number) => {
    if (score >= 90) return { label: isRTL ? 'ممتاز' : 'Excellent', color: 'bg-green-500' };
    if (score >= 75) return { label: isRTL ? 'جيد جداً' : 'Very Good', color: 'bg-blue-500' };
    if (score >= 60) return { label: isRTL ? 'جيد' : 'Good', color: 'bg-yellow-500' };
    if (score >= 50) return { label: isRTL ? 'مقبول' : 'Fair', color: 'bg-orange-500' };
    return { label: isRTL ? 'يحتاج تحسين' : 'Needs Improvement', color: 'bg-red-500' };
  };

  const performanceLevel = getPerformanceLevel(overallStats.overall);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border rounded-lg shadow-lg p-3">
          <p className="font-medium">{payload[0]?.payload?.fullName || label}</p>
          <p className="text-sm text-primary">
            {isRTL ? 'الدرجة: ' : 'Score: '}{payload[0]?.value}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Overall Performance Summary */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            {isRTL ? 'التقييم الشامل للمستوى' : 'Overall Performance Report'}
          </CardTitle>
          <CardDescription>
            {isRTL ? 'ملخص شامل لأداء الطالب' : 'Comprehensive student performance summary'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Overall Score Gauge */}
            <div className="flex flex-col items-center justify-center p-6 bg-background rounded-xl border">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${(overallStats.overall / 100) * 352} 352`}
                    className="text-primary transition-all duration-1000"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold">{overallStats.overall}%</span>
                  <span className="text-xs text-muted-foreground">{isRTL ? 'المستوى العام' : 'Overall'}</span>
                </div>
              </div>
              <Badge className={`mt-4 ${performanceLevel.color}`}>
                {performanceLevel.label}
              </Badge>
              <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                {quizTrend === 'up' && <><TrendingUp className="h-4 w-4 text-green-500" /> {isRTL ? 'في تحسن' : 'Improving'}</>}
                {quizTrend === 'down' && <><TrendingDown className="h-4 w-4 text-red-500" /> {isRTL ? 'يحتاج اهتمام' : 'Needs attention'}</>}
                {quizTrend === 'stable' && <><Minus className="h-4 w-4" /> {isRTL ? 'مستقر' : 'Stable'}</>}
              </div>
            </div>

            {/* Stats Breakdown */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-green-500" />
                    {isRTL ? 'نسبة الحضور' : 'Attendance Rate'}
                  </span>
                  <span className="font-medium">{overallStats.attendanceRate}%</span>
                </div>
                <Progress value={overallStats.attendanceRate} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-blue-500" />
                    {isRTL ? 'متوسط الكويزات' : 'Quiz Average'}
                  </span>
                  <span className="font-medium">{overallStats.avgQuizScore}%</span>
                </div>
                <Progress value={overallStats.avgQuizScore} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-purple-500" />
                    {isRTL ? 'متوسط الواجبات' : 'Assignment Average'}
                  </span>
                  <span className="font-medium">{overallStats.avgAssignmentScore}%</span>
                </div>
                <Progress value={overallStats.avgAssignmentScore} className="h-2" />
              </div>

              {instructor && (
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{isRTL ? 'المدرب:' : 'Instructor:'}</span>
                    <span className="font-medium">
                      {language === 'ar' ? instructor.full_name_ar || instructor.full_name : instructor.full_name}
                    </span>
                  </div>
                  {groupName && (
                    <div className="flex items-center gap-2 text-sm mt-1">
                      <span className="text-muted-foreground">{isRTL ? 'المجموعة:' : 'Group:'}</span>
                      <span className="font-medium">
                        {language === 'ar' ? groupNameAr || groupName : groupName}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Attendance Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-500" />
              {isRTL ? 'توزيع الحضور' : 'Attendance Distribution'}
            </CardTitle>
            <CardDescription>
              {isRTL ? `إجمالي السيشنات: ${attendance.length}` : `Total sessions: ${attendance.length}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attendanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={attendanceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {attendanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                {isRTL ? 'لا توجد بيانات حضور' : 'No attendance data'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quiz Performance Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-500" />
              {isRTL ? 'أداء الكويزات' : 'Quiz Performance'}
            </CardTitle>
            <CardDescription>
              {isRTL ? `${quizSubmissions.length} كويز مكتمل` : `${quizSubmissions.length} quizzes completed`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {quizData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={quizData}>
                  <defs>
                    <linearGradient id="quizGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#quizGradient)"
                  />
                  <Line
                    type="monotone"
                    dataKey="passing"
                    stroke="#ef4444"
                    strokeDasharray="5 5"
                    dot={false}
                    name={isRTL ? 'درجة النجاح' : 'Passing'}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                {isRTL ? 'لا توجد بيانات كويزات' : 'No quiz data'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assignment Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-500" />
            {isRTL ? 'أداء الواجبات' : 'Assignment Performance'}
          </CardTitle>
          <CardDescription>
            {isRTL 
              ? `${assignmentSubmissions.filter(a => a.status === 'graded').length} واجب مُقيّم` 
              : `${assignmentSubmissions.filter(a => a.status === 'graded').length} graded assignments`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignmentData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={assignmentData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="score" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                  name={isRTL ? 'الدرجة' : 'Score'}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              {isRTL ? 'لا توجد بيانات واجبات' : 'No assignment data'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
