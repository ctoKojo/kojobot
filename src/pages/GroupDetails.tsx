import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Users, Calendar, Clock, User, BookOpen, 
  FileText, ArrowLeft, CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

interface GroupData {
  group: any;
  instructor: any;
  students: any[];
  sessions: any[];
  assignments: any[];
  quizAssignments: any[];
}

export default function GroupDetails() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { isRTL, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GroupData | null>(null);

  useEffect(() => {
    if (groupId) fetchGroupData();
  }, [groupId]);

  const fetchGroupData = async () => {
    try {
      // Fetch group with related data
      const { data: group } = await supabase
        .from('groups')
        .select('*, age_groups(name, name_ar), levels(name, name_ar)')
        .eq('id', groupId)
        .single();

      // Fetch instructor
      const { data: instructor } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', group?.instructor_id)
        .maybeSingle();

      // Fetch students in group
      const { data: groupStudents } = await supabase
        .from('group_students')
        .select('student_id')
        .eq('group_id', groupId)
        .eq('is_active', true);

      const studentIds = groupStudents?.map(gs => gs.student_id) || [];
      let students: any[] = [];
      if (studentIds.length > 0) {
        const { data: studentsData } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', studentIds);
        students = studentsData || [];
      }

      // Fetch sessions
      const { data: sessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('group_id', groupId)
        .order('session_date', { ascending: false })
        .limit(20);

      // Fetch assignments for this group
      const { data: assignments } = await supabase
        .from('assignments')
        .select('*')
        .eq('group_id', groupId)
        .order('due_date', { ascending: false });

      // Fetch quiz assignments for this group
      const { data: quizAssignments } = await supabase
        .from('quiz_assignments')
        .select('*, quizzes(title, title_ar, duration_minutes)')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      setData({
        group,
        instructor,
        students,
        sessions: sessions || [],
        assignments: assignments || [],
        quizAssignments: quizAssignments || [],
      });
    } catch (error) {
      console.error('Error fetching group data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDayName = (day: string) => {
    const days: { [key: string]: { en: string; ar: string } } = {
      Sunday: { en: 'Sunday', ar: 'الأحد' },
      Monday: { en: 'Monday', ar: 'الاثنين' },
      Tuesday: { en: 'Tuesday', ar: 'الثلاثاء' },
      Wednesday: { en: 'Wednesday', ar: 'الأربعاء' },
      Thursday: { en: 'Thursday', ar: 'الخميس' },
      Friday: { en: 'Friday', ar: 'الجمعة' },
      Saturday: { en: 'Saturday', ar: 'السبت' },
    };
    return language === 'ar' ? days[day]?.ar || day : days[day]?.en || day;
  };

  const getGroupTypeName = (type: string) => {
    const types: { [key: string]: { en: string; ar: string } } = {
      kojo_squad: { en: 'Kojo Squad', ar: 'كوجو سكواد' },
      kojo_core: { en: 'Kojo Core', ar: 'كوجو كور' },
      kojo_x: { en: 'Kojo X', ar: 'كوجو اكس' },
    };
    return language === 'ar' ? types[type]?.ar || type : types[type]?.en || type;
  };

  const getSessionStats = () => {
    const total = data?.sessions.length || 0;
    const completed = data?.sessions.filter(s => s.status === 'completed').length || 0;
    const scheduled = data?.sessions.filter(s => s.status === 'scheduled').length || 0;
    return { total, completed, scheduled };
  };

  if (loading) {
    return (
      <DashboardLayout title={isRTL ? 'تفاصيل المجموعة' : 'Group Details'}>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!data?.group) {
    return (
      <DashboardLayout title={isRTL ? 'تفاصيل المجموعة' : 'Group Details'}>
        <div className="text-center py-12">
          <p className="text-muted-foreground">{isRTL ? 'لم يتم العثور على المجموعة' : 'Group not found'}</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isRTL ? 'رجوع' : 'Go Back'}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const sessionStats = getSessionStats();

  return (
    <DashboardLayout title={isRTL ? 'تفاصيل المجموعة' : 'Group Details'}>
      <div className="space-y-6">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {isRTL ? 'رجوع' : 'Back'}
        </Button>

        {/* Group Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <div className="p-4 rounded-lg bg-primary/10">
                <Users className="h-12 w-12 text-primary" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">
                  {language === 'ar' ? data.group.name_ar : data.group.name}
                </h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary">
                    {getGroupTypeName(data.group.group_type)}
                  </Badge>
                  {data.group.age_groups && (
                    <Badge variant="outline">
                      {language === 'ar' ? data.group.age_groups.name_ar : data.group.age_groups.name}
                    </Badge>
                  )}
                  {data.group.levels && (
                    <Badge variant="outline">
                      {language === 'ar' ? data.group.levels.name_ar : data.group.levels.name}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {getDayName(data.group.schedule_day)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {data.group.schedule_time}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {data.group.duration_minutes} {isRTL ? 'دقيقة' : 'min'}
                  </span>
                </div>
              </div>

              {/* Instructor Info */}
              {data.instructor && (
                <div 
                  className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/instructor/${data.instructor.user_id}`)}
                >
                  <Avatar>
                    <AvatarImage src={data.instructor.avatar_url} />
                    <AvatarFallback>{data.instructor.full_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm text-muted-foreground">{isRTL ? 'المدرب' : 'Instructor'}</p>
                    <p className="font-medium">
                      {language === 'ar' ? data.instructor.full_name_ar || data.instructor.full_name : data.instructor.full_name}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.students.length}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'الطلاب' : 'Students'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <Calendar className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{sessionStats.total}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'الجلسات' : 'Sessions'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                  <BookOpen className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.quizAssignments.length}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'الكويزات' : 'Quizzes'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100">
                  <FileText className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.assignments.length}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'الواجبات' : 'Assignments'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Tabs */}
        <Tabs defaultValue="students" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="students">{isRTL ? 'الطلاب' : 'Students'}</TabsTrigger>
            <TabsTrigger value="sessions">{isRTL ? 'الجلسات' : 'Sessions'}</TabsTrigger>
            <TabsTrigger value="quizzes">{isRTL ? 'الكويزات' : 'Quizzes'}</TabsTrigger>
            <TabsTrigger value="assignments">{isRTL ? 'الواجبات' : 'Assignments'}</TabsTrigger>
          </TabsList>

          {/* Students Tab */}
          <TabsContent value="students">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {isRTL ? 'طلاب المجموعة' : 'Group Students'}
                </CardTitle>
                <CardDescription>
                  {data.students.length} {isRTL ? 'طالب' : 'student(s)'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.students.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {isRTL ? 'لا يوجد طلاب' : 'No students in this group'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.students.map((student: any) => (
                      <div 
                        key={student.id} 
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate(`/student/${student.user_id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={student.avatar_url} />
                            <AvatarFallback>{student.full_name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {language === 'ar' ? student.full_name_ar || student.full_name : student.full_name}
                            </p>
                            <p className="text-sm text-muted-foreground">{student.email}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {isRTL ? 'الجلسات' : 'Sessions'}
                </CardTitle>
                <CardDescription>
                  {sessionStats.completed} {isRTL ? 'مكتملة' : 'completed'}, {sessionStats.scheduled} {isRTL ? 'مجدولة' : 'scheduled'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.sessions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {isRTL ? 'لا توجد جلسات' : 'No sessions'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.sessions.map((session: any) => (
                      <div key={session.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">
                            {language === 'ar' ? session.topic_ar || session.topic : session.topic || (isRTL ? 'جلسة' : 'Session')}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(session.session_date)} - {session.session_time}
                          </p>
                        </div>
                        <Badge className={
                          session.status === 'completed' ? 'bg-green-100 text-green-800' :
                          session.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }>
                          {session.status === 'completed' ? (isRTL ? 'مكتملة' : 'Completed') :
                           session.status === 'cancelled' ? (isRTL ? 'ملغية' : 'Cancelled') :
                           (isRTL ? 'مجدولة' : 'Scheduled')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quizzes Tab */}
          <TabsContent value="quizzes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  {isRTL ? 'الكويزات المعينة' : 'Assigned Quizzes'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.quizAssignments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {isRTL ? 'لا توجد كويزات' : 'No quizzes assigned'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.quizAssignments.map((qa: any) => (
                      <div key={qa.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">
                            {language === 'ar' ? qa.quizzes?.title_ar : qa.quizzes?.title}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {qa.quizzes?.duration_minutes} {isRTL ? 'دقيقة' : 'min'}
                            {qa.due_date && ` • ${isRTL ? 'موعد التسليم: ' : 'Due: '}${formatDate(qa.due_date)}`}
                          </p>
                        </div>
                        <Badge variant={qa.is_active ? 'default' : 'secondary'}>
                          {qa.is_active ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'منتهي' : 'Closed')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {isRTL ? 'الواجبات' : 'Assignments'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.assignments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {isRTL ? 'لا توجد واجبات' : 'No assignments'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.assignments.map((assignment: any) => (
                      <div 
                        key={assignment.id} 
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate(`/assignment-submissions/${assignment.id}`)}
                      >
                        <div>
                          <p className="font-medium">
                            {language === 'ar' ? assignment.title_ar : assignment.title}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {isRTL ? 'موعد التسليم: ' : 'Due: '}{formatDate(assignment.due_date)}
                          </p>
                        </div>
                        <Badge variant={assignment.is_active ? 'default' : 'secondary'}>
                          {assignment.is_active ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'منتهي' : 'Closed')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
