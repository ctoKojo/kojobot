import { useEffect, useState } from 'react';
import { Calendar, TrendingUp, GraduationCap, Users, AlertTriangle, CheckCircle, Award, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';

interface MonthlyStats {
  month: string;
  year: number;
  attendance: { present: number; absent: number; late: number; total: number; rate: number };
  quizzes: { completed: number; avgScore: number; passRate: number };
  assignments: { submitted: number; graded: number; avgScore: number; total: number };
  evaluations: { count: number; avgPercentage: number; avgBehavior: number };
  warnings: number;
}

interface StudentSummary {
  id: string;
  name: string;
  nameAr: string;
  attendanceRate: number;
  quizAvg: number;
  assignmentAvg: number;
  evaluationAvg: number;
  warnings: number;
}

export default function MonthlyReports() {
  const { user, role: userRole, loading: authLoading } = useAuth();
  const { isRTL, language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [studentSummaries, setStudentSummaries] = useState<StudentSummary[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState<string>('all');
  const [instructors, setInstructors] = useState<any[]>([]);

  const months = [
    { en: 'January', ar: 'يناير' },
    { en: 'February', ar: 'فبراير' },
    { en: 'March', ar: 'مارس' },
    { en: 'April', ar: 'أبريل' },
    { en: 'May', ar: 'مايو' },
    { en: 'June', ar: 'يونيو' },
    { en: 'July', ar: 'يوليو' },
    { en: 'August', ar: 'أغسطس' },
    { en: 'September', ar: 'سبتمبر' },
    { en: 'October', ar: 'أكتوبر' },
    { en: 'November', ar: 'نوفمبر' },
    { en: 'December', ar: 'ديسمبر' },
  ];

  useEffect(() => {
    if (user && userRole) {
      fetchReportData();
      if (userRole === 'admin') {
        fetchInstructors();
      }
    }
  }, [user, userRole, currentMonth, currentYear, selectedInstructor]);

  const fetchInstructors = async () => {
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'instructor');

    const instructorIds = (roleData || []).map(r => r.user_id);
    if (instructorIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id, full_name, full_name_ar')
        .in('user_id', instructorIds)
        .neq('employment_status', 'terminated');
      setInstructors((profileData || []).map(p => ({
        user_id: p.user_id,
        profiles: { full_name: p.full_name, full_name_ar: p.full_name_ar }
      })));
    } else {
      setInstructors([]);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const startDate = new Date(currentYear, currentMonth, 1);
      const endDate = new Date(currentYear, currentMonth + 1, 0);
      
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      let groupIds: string[] = [];
      let studentIds: string[] = [];

      // Determine scope based on role
      if (userRole === 'student') {
        studentIds = [user!.id];
        const { data: gs } = await supabase
          .from('group_students')
          .select('group_id')
          .eq('student_id', user!.id)
          .eq('is_active', true);
        groupIds = gs?.map(g => g.group_id) || [];
      } else if (userRole === 'instructor') {
        const { data: groups } = await supabase
          .from('groups')
          .select('id')
          .eq('instructor_id', user!.id)
          .eq('is_active', true);
        groupIds = groups?.map(g => g.id) || [];
        
        if (groupIds.length > 0) {
          const { data: gs } = await supabase
            .from('group_students')
            .select('student_id')
            .in('group_id', groupIds)
            .eq('is_active', true);
          studentIds = [...new Set(gs?.map(g => g.student_id) || [])];
        }
      } else if (userRole === 'admin') {
        if (selectedInstructor !== 'all') {
          const { data: groups } = await supabase
            .from('groups')
            .select('id')
            .eq('instructor_id', selectedInstructor)
            .eq('is_active', true);
          groupIds = groups?.map(g => g.id) || [];
        }
        
        if (groupIds.length > 0) {
          const { data: gs } = await supabase
            .from('group_students')
            .select('student_id')
            .in('group_id', groupIds)
            .eq('is_active', true);
          studentIds = [...new Set(gs?.map(g => g.student_id) || [])];
        } else if (selectedInstructor === 'all') {
          const { data: allStudents } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'student');
          studentIds = allStudents?.map(s => s.user_id) || [];
        }
      }

      // Fetch sessions for the month
      let sessionsQuery = supabase
        .from('sessions')
        .select('id, group_id')
        .gte('session_date', startStr)
        .lte('session_date', endStr);
      
      if (groupIds.length > 0) {
        sessionsQuery = sessionsQuery.in('group_id', groupIds);
      }
      
      const { data: sessions } = await sessionsQuery;
      const sessionIds = sessions?.map(s => s.id) || [];

      // Fetch attendance
      let attendanceData: any[] = [];
      if (sessionIds.length > 0 && studentIds.length > 0) {
        const { data } = await supabase
          .from('attendance')
          .select('*')
          .in('session_id', sessionIds)
          .in('student_id', studentIds);
        attendanceData = data || [];
      }

      const present = attendanceData.filter(a => a.status === 'present').length;
      const absent = attendanceData.filter(a => a.status === 'absent').length;
      const late = attendanceData.filter(a => a.status === 'late').length;
      const totalAttendance = attendanceData.length;
      const attendanceRate = totalAttendance > 0 ? Math.round((present / totalAttendance) * 100) : 0;

      // Fetch quiz submissions
      let quizData: any[] = [];
      if (studentIds.length > 0) {
        const { data } = await supabase
          .from('quiz_submissions')
          .select('*')
          .in('student_id', studentIds)
          .eq('is_auto_generated', false)
          .gte('submitted_at', startDate.toISOString())
          .lte('submitted_at', endDate.toISOString())
          .eq('status', 'completed');
        quizData = data || [];
      }

      const quizCompleted = quizData.length;
      const quizAvgScore = quizData.length > 0 
        ? Math.round(quizData.reduce((sum, q) => sum + (q.percentage || 0), 0) / quizData.length)
        : 0;
      const quizPassRate = quizData.length > 0
        ? Math.round((quizData.filter(q => (q.percentage || 0) >= 60).length / quizData.length) * 100)
        : 0;

      // Fetch assignment submissions
      let assignmentData: any[] = [];
      if (studentIds.length > 0) {
        const { data } = await supabase
          .from('assignment_submissions')
          .select('*')
          .in('student_id', studentIds)
          .eq('is_auto_generated', false)
          .gte('submitted_at', startDate.toISOString())
          .lte('submitted_at', endDate.toISOString());
        assignmentData = data || [];
      }

      const assignmentSubmitted = assignmentData.length;
      const assignmentGraded = assignmentData.filter(a => a.status === 'graded').length;
      const assignmentAvgScore = assignmentData.filter(a => a.score != null).length > 0
        ? Math.round(assignmentData.filter(a => a.score != null).reduce((sum, a) => sum + a.score, 0) / assignmentData.filter(a => a.score != null).length)
        : 0;

      // Fetch warnings
      let warningsCount = 0;
      if (studentIds.length > 0) {
        const { count } = await supabase
          .from('warnings')
          .select('id', { count: 'exact' })
          .in('student_id', studentIds)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());
        warningsCount = count || 0;
      }

      // Fetch session evaluations for the month
      let evalData: any[] = [];
      if (sessionIds.length > 0 && studentIds.length > 0) {
        const { data: evals } = await supabase
          .from('session_evaluations')
          .select('percentage, total_behavior_score, max_behavior_score')
          .in('session_id', sessionIds)
          .in('student_id', studentIds);
        evalData = evals || [];
      }

      const evalCount = evalData.length;
      const evalAvgPct = evalCount > 0
        ? Math.round(evalData.filter(e => e.percentage != null).reduce((sum: number, e: any) => sum + (e.percentage || 0), 0) / Math.max(1, evalData.filter(e => e.percentage != null).length))
        : 0;
      const evalAvgBehavior = evalCount > 0
        ? Math.round(evalData.reduce((sum: number, e: any) => sum + (e.total_behavior_score || 0), 0) / evalCount)
        : 0;

      setStats({
        month: months[currentMonth][language === 'ar' ? 'ar' : 'en'],
        year: currentYear,
        attendance: { present, absent, late, total: totalAttendance, rate: attendanceRate },
        quizzes: { completed: quizCompleted, avgScore: quizAvgScore, passRate: quizPassRate },
        assignments: { submitted: assignmentSubmitted, graded: assignmentGraded, avgScore: assignmentAvgScore, total: assignmentSubmitted },
        evaluations: { count: evalCount, avgPercentage: evalAvgPct, avgBehavior: evalAvgBehavior },
        warnings: warningsCount,
      });

      // Fetch trend data for last 6 months
      await fetchTrendData(studentIds);

      // Fetch student summaries (for instructor/admin)
      if (userRole !== 'student' && studentIds.length > 0) {
        await fetchStudentSummaries(studentIds, sessionIds);
      }

    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendData = async (studentIds: string[]) => {
    const trends = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - i, 1);
      const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      // Get sessions for this month
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id')
        .gte('session_date', startStr)
        .lte('session_date', endStr);
      
      const sessionIds = sessions?.map(s => s.id) || [];

      let attendanceRate = 0;
      if (sessionIds.length > 0 && studentIds.length > 0) {
        const { data: attendance } = await supabase
          .from('attendance')
          .select('status')
          .in('session_id', sessionIds)
          .in('student_id', studentIds);
        
        if (attendance && attendance.length > 0) {
          const present = attendance.filter(a => a.status === 'present').length;
          attendanceRate = Math.round((present / attendance.length) * 100);
        }
      }

      let quizAvg = 0;
      if (studentIds.length > 0) {
        const { data: quizzes } = await supabase
          .from('quiz_submissions')
          .select('percentage')
          .in('student_id', studentIds)
          .eq('is_auto_generated', false)
          .gte('submitted_at', startDate.toISOString())
          .lte('submitted_at', endDate.toISOString())
          .eq('status', 'completed');
        
        if (quizzes && quizzes.length > 0) {
          quizAvg = Math.round(quizzes.reduce((sum, q) => sum + (q.percentage || 0), 0) / quizzes.length);
        }
      }

      trends.push({
        month: months[date.getMonth()][language === 'ar' ? 'ar' : 'en'],
        attendance: attendanceRate,
        quizzes: quizAvg,
      });
    }
    setTrendData(trends);
  };

  const fetchStudentSummaries = async (studentIds: string[], sessionIds: string[]) => {
    const summaries: StudentSummary[] = [];
    
    // Get profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, full_name_ar')
      .in('user_id', studentIds.slice(0, 20)); // Limit to 20 students

    for (const profile of profiles || []) {
      // Attendance
      let attendanceRate = 0;
      if (sessionIds.length > 0) {
        const { data: attendance } = await supabase
          .from('attendance')
          .select('status')
          .eq('student_id', profile.user_id)
          .in('session_id', sessionIds);
        
        if (attendance && attendance.length > 0) {
          const present = attendance.filter(a => a.status === 'present').length;
          attendanceRate = Math.round((present / attendance.length) * 100);
        }
      }

      // Quiz avg
      const { data: quizzes } = await supabase
        .from('quiz_submissions')
        .select('percentage')
        .eq('student_id', profile.user_id)
        .eq('is_auto_generated', false)
        .eq('status', 'completed');
      
      const quizAvg = quizzes && quizzes.length > 0
        ? Math.round(quizzes.reduce((sum, q) => sum + (q.percentage || 0), 0) / quizzes.length)
        : 0;

      // Assignment avg
      const { data: assignments } = await supabase
        .from('assignment_submissions')
        .select('score')
        .eq('student_id', profile.user_id)
        .eq('is_auto_generated', false)
        .not('score', 'is', null);
      
      const assignmentAvg = assignments && assignments.length > 0
        ? Math.round(assignments.reduce((sum, a) => sum + a.score, 0) / assignments.length)
        : 0;

      // Warnings
      const { count: warnings } = await supabase
        .from('warnings')
        .select('id', { count: 'exact' })
        .eq('student_id', profile.user_id)
        .eq('is_active', true);

      // Evaluation avg
      const { data: evals } = await supabase
        .from('session_evaluations')
        .select('percentage')
        .eq('student_id', profile.user_id)
        .in('session_id', sessionIds);
      
      const evalWithPct = (evals || []).filter(e => e.percentage != null);
      const evaluationAvg = evalWithPct.length > 0
        ? Math.round(evalWithPct.reduce((sum, e) => sum + (e.percentage || 0), 0) / evalWithPct.length)
        : 0;

      summaries.push({
        id: profile.user_id,
        name: profile.full_name,
        nameAr: profile.full_name_ar || profile.full_name,
        attendanceRate,
        quizAvg,
        assignmentAvg,
        evaluationAvg,
        warnings: warnings || 0,
      });
    }

    // Sort by overall performance
    summaries.sort((a, b) => {
      const scoreA = (a.attendanceRate * 0.2 + a.quizAvg * 0.4 + a.assignmentAvg * 0.4);
      const scoreB = (b.attendanceRate * 0.2 + b.quizAvg * 0.4 + b.assignmentAvg * 0.4);
      return scoreB - scoreA;
    });

    setStudentSummaries(summaries);
  };

  const navigateMonth = (direction: number) => {
    let newMonth = currentMonth + direction;
    let newYear = currentYear;
    
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  };

  const COLORS = ['#22c55e', '#ef4444', '#eab308'];

  const attendancePieData = stats ? [
    { name: isRTL ? 'حاضر' : 'Present', value: stats.attendance.present },
    { name: isRTL ? 'غائب' : 'Absent', value: stats.attendance.absent },
    { name: isRTL ? 'متأخر' : 'Late', value: stats.attendance.late },
  ] : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              {isRTL ? 'التقارير الشهرية' : 'Monthly Reports'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isRTL ? 'تتبع الأداء والتطور عبر الزمن' : 'Track performance and progress over time'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {userRole === 'admin' && (
              <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={isRTL ? 'كل المدربين' : 'All Instructors'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? 'كل المدربين' : 'All Instructors'}</SelectItem>
                  {instructors.map((inst: any) => (
                    <SelectItem key={inst.user_id} value={inst.user_id}>
                      {language === 'ar' ? inst.profiles?.full_name_ar || inst.profiles?.full_name : inst.profiles?.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
              <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
                {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
              <span className="font-medium min-w-[150px] text-center">
                {months[currentMonth][language === 'ar' ? 'ar' : 'en']} {currentYear}
              </span>
              <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
                {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {loading || authLoading || !userRole ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    {isRTL ? 'نسبة الحضور' : 'Attendance Rate'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{stats?.attendance.rate || 0}%</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.attendance.total || 0} {isRTL ? 'سجل' : 'records'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Award className="h-4 w-4 text-blue-500" />
                    {isRTL ? 'متوسط الكويزات' : 'Quiz Average'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">{stats?.quizzes.avgScore || 0}%</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.quizzes.completed || 0} {isRTL ? 'كويز' : 'quizzes'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-500" />
                    {isRTL ? 'متوسط الواجبات' : 'Assignment Average'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">{stats?.assignments.avgScore || 0}%</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.assignments.submitted || 0} {isRTL ? 'تسليم' : 'submitted'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-500" />
                    {isRTL ? 'التقييم السلوكي' : 'Behavior Eval'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-amber-600">{stats?.evaluations.avgPercentage || 0}%</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.evaluations.count || 0} {isRTL ? 'تقييم' : 'evaluations'}
                  </p>
                </CardContent>
              </Card>

              <Card className={stats?.warnings && stats.warnings > 0 ? 'border-warning' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    {isRTL ? 'الإنذارات' : 'Warnings'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${stats?.warnings ? 'text-warning' : ''}`}>{stats?.warnings || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? 'هذا الشهر' : 'this month'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Attendance Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>{isRTL ? 'توزيع الحضور' : 'Attendance Distribution'}</CardTitle>
                </CardHeader>
                <CardContent>
                  {stats?.attendance.total ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={attendancePieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {attendancePieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                      {isRTL ? 'لا توجد بيانات' : 'No data available'}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>{isRTL ? 'تطور الأداء' : 'Performance Trend'}</CardTitle>
                  <CardDescription>{isRTL ? 'آخر 6 أشهر' : 'Last 6 months'}</CardDescription>
                </CardHeader>
                <CardContent>
                  {trendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" fontSize={12} />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Area 
                          type="monotone" 
                          dataKey="attendance" 
                          stroke="#22c55e" 
                          fill="#22c55e" 
                          fillOpacity={0.3}
                          name={isRTL ? 'الحضور' : 'Attendance'}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="quizzes" 
                          stroke="#3b82f6" 
                          fill="#3b82f6"
                          fillOpacity={0.3}
                          name={isRTL ? 'الكويزات' : 'Quizzes'}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                      {isRTL ? 'لا توجد بيانات' : 'No data available'}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quiz Pass Rate */}
            <Card>
              <CardHeader>
                <CardTitle>{isRTL ? 'نسبة النجاح في الكويزات' : 'Quiz Pass Rate'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all duration-500"
                      style={{ width: `${stats?.quizzes.passRate || 0}%` }}
                    />
                  </div>
                  <span className="font-bold text-lg">{stats?.quizzes.passRate || 0}%</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {isRTL 
                    ? `${Math.round((stats?.quizzes.completed || 0) * (stats?.quizzes.passRate || 0) / 100)} ناجح من ${stats?.quizzes.completed || 0}`
                    : `${Math.round((stats?.quizzes.completed || 0) * (stats?.quizzes.passRate || 0) / 100)} passed out of ${stats?.quizzes.completed || 0}`
                  }
                </p>
              </CardContent>
            </Card>

            {/* Student Performance Table (for instructor/admin) */}
            {userRole !== 'student' && studentSummaries.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{isRTL ? 'أداء الطلاب' : 'Student Performance'}</CardTitle>
                  <CardDescription>
                    {isRTL ? 'ملخص أداء الطلاب هذا الشهر' : 'Student performance summary this month'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                        <TableHead className="text-center">{isRTL ? 'الحضور' : 'Attendance'}</TableHead>
                        <TableHead className="text-center">{isRTL ? 'الكويزات' : 'Quizzes'}</TableHead>
                        <TableHead className="text-center">{isRTL ? 'الواجبات' : 'Assignments'}</TableHead>
                        <TableHead className="text-center">{isRTL ? 'التقييم' : 'Evaluation'}</TableHead>
                        <TableHead className="text-center">{isRTL ? 'الإنذارات' : 'Warnings'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentSummaries.map((student) => (
                        <TableRow 
                          key={student.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/student/${student.id}`)}
                        >
                          <TableCell className="font-medium">
                            {language === 'ar' ? student.nameAr : student.name}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={
                              student.attendanceRate >= 80 ? 'bg-green-100 text-green-800' :
                              student.attendanceRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }>
                              {student.attendanceRate}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={
                              student.quizAvg >= 80 ? 'bg-green-100 text-green-800' :
                              student.quizAvg >= 60 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }>
                              {student.quizAvg}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={
                              student.assignmentAvg >= 80 ? 'bg-green-100 text-green-800' :
                              student.assignmentAvg >= 60 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }>
                              {student.assignmentAvg}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={
                              student.evaluationAvg >= 80 ? 'bg-green-100 text-green-800' :
                              student.evaluationAvg >= 60 ? 'bg-yellow-100 text-yellow-800' :
                              student.evaluationAvg > 0 ? 'bg-red-100 text-red-800' :
                              'bg-muted text-muted-foreground'
                            }>
                              {student.evaluationAvg > 0 ? `${student.evaluationAvg}%` : '-'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {student.warnings > 0 ? (
                              <Badge variant="destructive">{student.warnings}</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-green-100 text-green-800">0</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
