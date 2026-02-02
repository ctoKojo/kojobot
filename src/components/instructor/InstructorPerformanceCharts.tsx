import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';
import { Trophy, Users, Calendar, BookOpen, Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface AttendanceStats {
  totalRecords: number;
  presentRate: number;
  absentRate: number;
  lateRate: number;
}

interface QuizStats {
  totalSubmissions: number;
  averageScore: number;
  passRate: number;
  submissionsPerQuiz: { quiz_id: string; title: string; title_ar: string; count: number; avgScore: number }[];
}

interface AssignmentStats {
  totalSubmissions: number;
  pendingGrading: number;
  averageScore: number;
  submissionRate: number;
}

interface InstructorPerformanceChartsProps {
  totalStudents: number;
  attendanceStats: AttendanceStats;
  quizStats: QuizStats;
  assignmentStats: AssignmentStats;
  attendanceTrend: { date: string; rate: number }[];
}

export function InstructorPerformanceCharts({
  totalStudents,
  attendanceStats,
  quizStats,
  assignmentStats,
  attendanceTrend,
}: InstructorPerformanceChartsProps) {
  const { isRTL, language } = useLanguage();

  // Attendance Pie Data
  const attendancePieData = useMemo(() => {
    return [
      { name: isRTL ? 'حاضر' : 'Present', value: attendanceStats.presentRate, color: '#22c55e' },
      { name: isRTL ? 'غائب' : 'Absent', value: attendanceStats.absentRate, color: '#ef4444' },
      { name: isRTL ? 'متأخر' : 'Late', value: attendanceStats.lateRate, color: '#f59e0b' },
    ].filter(d => d.value > 0);
  }, [attendanceStats, isRTL]);

  // Quiz Performance Bar Data
  const quizBarData = useMemo(() => {
    return quizStats.submissionsPerQuiz.slice(0, 8).map((q) => ({
      name: language === 'ar' ? q.title_ar || q.title : q.title,
      shortName: (language === 'ar' ? q.title_ar || q.title : q.title).slice(0, 15) + 
        ((language === 'ar' ? q.title_ar || q.title : q.title).length > 15 ? '...' : ''),
      score: Math.round(q.avgScore),
      submissions: q.count,
    }));
  }, [quizStats, language]);

  // Pass/Fail Pie Data
  const passFailData = useMemo(() => {
    const passed = quizStats.passRate;
    const failed = 100 - quizStats.passRate;
    return [
      { name: isRTL ? 'ناجح' : 'Passed', value: passed, color: '#22c55e' },
      { name: isRTL ? 'راسب' : 'Failed', value: failed, color: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [quizStats, isRTL]);

  // Overall Performance
  const overallStats = useMemo(() => {
    const weights = { attendance: 0.2, quiz: 0.4, assignment: 0.4 };
    const overall = Math.round(
      (attendanceStats.presentRate * weights.attendance) +
      (quizStats.averageScore * weights.quiz) +
      (assignmentStats.averageScore * weights.assignment)
    );
    return overall;
  }, [attendanceStats, quizStats, assignmentStats]);

  const getPerformanceLevel = (score: number) => {
    if (score >= 90) return { label: isRTL ? 'ممتاز' : 'Excellent', color: 'bg-green-500' };
    if (score >= 75) return { label: isRTL ? 'جيد جداً' : 'Very Good', color: 'bg-blue-500' };
    if (score >= 60) return { label: isRTL ? 'جيد' : 'Good', color: 'bg-yellow-500' };
    if (score >= 50) return { label: isRTL ? 'مقبول' : 'Fair', color: 'bg-orange-500' };
    return { label: isRTL ? 'يحتاج تحسين' : 'Needs Improvement', color: 'bg-red-500' };
  };

  const performanceLevel = getPerformanceLevel(overallStats);

  // Trend calculation
  const getTrend = () => {
    if (attendanceTrend.length < 2) return 'stable';
    const recent = attendanceTrend.slice(-7);
    const earlier = attendanceTrend.slice(0, Math.max(1, attendanceTrend.length - 7));
    const recentAvg = recent.reduce((a, b) => a + b.rate, 0) / recent.length;
    const earlierAvg = earlier.reduce((a, b) => a + b.rate, 0) / earlier.length;
    if (recentAvg > earlierAvg + 5) return 'up';
    if (recentAvg < earlierAvg - 5) return 'down';
    return 'stable';
  };

  const trend = getTrend();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border rounded-lg shadow-lg p-3">
          <p className="font-medium">{payload[0]?.payload?.name || label}</p>
          {payload.map((p: any, i: number) => (
            <p key={i} className="text-sm" style={{ color: p.color }}>
              {p.name}: {p.value}{typeof p.value === 'number' && p.value <= 100 ? '%' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Quick Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{totalStudents}</p>
                <p className="text-sm text-blue-600/70 dark:text-blue-400/70">
                  {isRTL ? 'إجمالي الطلاب' : 'Total Students'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {Math.round(attendanceStats.presentRate)}%
                </p>
                <p className="text-sm text-green-600/70 dark:text-green-400/70">
                  {isRTL ? 'نسبة الحضور' : 'Attendance Rate'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <BookOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {Math.round(quizStats.averageScore)}%
                </p>
                <p className="text-sm text-purple-600/70 dark:text-purple-400/70">
                  {isRTL ? 'متوسط الكويزات' : 'Quiz Average'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20 border-orange-200 dark:border-orange-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <Target className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                  {Math.round(assignmentStats.averageScore)}%
                </p>
                <p className="text-sm text-orange-600/70 dark:text-orange-400/70">
                  {isRTL ? 'متوسط الواجبات' : 'Assignment Average'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Performance Card */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            {isRTL ? 'مستوى الأداء العام للطلاب' : 'Overall Student Performance'}
          </CardTitle>
          <CardDescription>
            {isRTL ? 'ملخص شامل لأداء جميع الطلاب' : 'Comprehensive summary of all students performance'}
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
                    strokeDasharray={`${(overallStats / 100) * 352} 352`}
                    className="text-primary transition-all duration-1000"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold">{overallStats}%</span>
                  <span className="text-xs text-muted-foreground">{isRTL ? 'المستوى العام' : 'Overall'}</span>
                </div>
              </div>
              <Badge className={`mt-4 ${performanceLevel.color}`}>
                {performanceLevel.label}
              </Badge>
              <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                {trend === 'up' && <><TrendingUp className="h-4 w-4 text-green-500" /> {isRTL ? 'في تحسن' : 'Improving'}</>}
                {trend === 'down' && <><TrendingDown className="h-4 w-4 text-red-500" /> {isRTL ? 'يحتاج اهتمام' : 'Needs attention'}</>}
                {trend === 'stable' && <><Minus className="h-4 w-4" /> {isRTL ? 'مستقر' : 'Stable'}</>}
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
                  <span className="font-medium">{Math.round(attendanceStats.presentRate)}%</span>
                </div>
                <Progress value={attendanceStats.presentRate} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-purple-500" />
                    {isRTL ? 'متوسط الكويزات' : 'Quiz Average'}
                  </span>
                  <span className="font-medium">{Math.round(quizStats.averageScore)}%</span>
                </div>
                <Progress value={quizStats.averageScore} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-orange-500" />
                    {isRTL ? 'متوسط الواجبات' : 'Assignment Average'}
                  </span>
                  <span className="font-medium">{Math.round(assignmentStats.averageScore)}%</span>
                </div>
                <Progress value={assignmentStats.averageScore} className="h-2" />
              </div>

              <div className="pt-4 border-t grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-600">{Math.round(quizStats.passRate)}%</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'نسبة النجاح' : 'Pass Rate'}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-600">{assignmentStats.pendingGrading}</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'في انتظار التصحيح' : 'Pending Grading'}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Attendance Distribution Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-500" />
              {isRTL ? 'توزيع الحضور' : 'Attendance Distribution'}
            </CardTitle>
            <CardDescription>
              {isRTL 
                ? `إجمالي السجلات: ${attendanceStats.totalRecords}` 
                : `Total records: ${attendanceStats.totalRecords}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attendancePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={attendancePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${Math.round(value)}%`}
                  >
                    {attendancePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${Math.round(value)}%`} />
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

        {/* Pass/Fail Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              {isRTL ? 'نسبة النجاح / الرسوب' : 'Pass / Fail Rate'}
            </CardTitle>
            <CardDescription>
              {isRTL 
                ? `إجمالي المحاولات: ${quizStats.totalSubmissions}` 
                : `Total submissions: ${quizStats.totalSubmissions}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {quizStats.totalSubmissions > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={passFailData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${Math.round(value)}%`}
                  >
                    {passFailData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${Math.round(value)}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                {isRTL ? 'لا توجد بيانات كويزات' : 'No quiz data'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quiz Performance Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-purple-500" />
            {isRTL ? 'أداء الكويزات' : 'Quiz Performance'}
          </CardTitle>
          <CardDescription>
            {isRTL ? 'متوسط الدرجات لكل كويز' : 'Average score per quiz'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {quizBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={quizBarData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="shortName" 
                  tick={{ fontSize: 11 }} 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="score" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                  name={isRTL ? 'متوسط الدرجة' : 'Average Score'}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              {isRTL ? 'لا توجد بيانات كويزات' : 'No quiz data'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attendance Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            {isRTL ? 'ترند الحضور' : 'Attendance Trend'}
          </CardTitle>
          <CardDescription>
            {isRTL ? 'نسبة الحضور على مدار الفترة الماضية' : 'Attendance rate over the past period'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attendanceTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={attendanceTrend}>
                <defs>
                  <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { 
                    weekday: 'long',
                    month: 'short', 
                    day: 'numeric' 
                  })}
                  formatter={(value: number) => [`${Math.round(value)}%`, isRTL ? 'نسبة الحضور' : 'Attendance']}
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#attendanceGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              {isRTL ? 'لا توجد بيانات كافية' : 'Not enough data'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
