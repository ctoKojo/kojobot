import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, Calendar, Clock, Users, BookOpen, 
  FileText, ArrowLeft, Mail, Phone, Award
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { formatTime12Hour } from '@/lib/timeUtils';

interface InstructorData {
  profile: any;
  groups: any[];
  sessions: any[];
  quizzes: any[];
  assignments: any[];
}

export default function InstructorProfile() {
  const { instructorId } = useParams();
  const navigate = useNavigate();
  const { isRTL, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InstructorData | null>(null);

  useEffect(() => {
    if (instructorId) fetchInstructorData();
  }, [instructorId]);

  const fetchInstructorData = async () => {
    try {
      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', instructorId)
        .single();

      // Fetch groups
      const { data: groups } = await supabase
        .from('groups')
        .select('*, age_groups(name, name_ar), levels(name, name_ar)')
        .eq('instructor_id', instructorId)
        .eq('is_active', true);

      // Fetch upcoming sessions
      const { data: sessions } = await supabase
        .from('sessions')
        .select('*, groups(name, name_ar)')
        .in('group_id', (groups || []).map(g => g.id))
        .gte('session_date', new Date().toISOString().split('T')[0])
        .order('session_date', { ascending: true })
        .limit(10);

      // Fetch quizzes created
      const { data: quizzes } = await supabase
        .from('quizzes')
        .select('*')
        .eq('created_by', instructorId)
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch assignments created
      const { data: assignments } = await supabase
        .from('assignments')
        .select('*')
        .eq('assigned_by', instructorId)
        .order('created_at', { ascending: false })
        .limit(10);

      setData({
        profile,
        groups: groups || [],
        sessions: sessions || [],
        quizzes: quizzes || [],
        assignments: assignments || [],
      });
    } catch (error) {
      console.error('Error fetching instructor data:', error);
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

  const getTotalStudents = () => {
    // This would need actual count from group_students
    return data?.groups.length ? data.groups.length * 5 : 0; // Placeholder
  };

  if (loading) {
    return (
      <DashboardLayout title={isRTL ? 'ملف المدرب' : 'Instructor Profile'}>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!data?.profile) {
    return (
      <DashboardLayout title={isRTL ? 'ملف المدرب' : 'Instructor Profile'}>
        <div className="text-center py-12">
          <p className="text-muted-foreground">{isRTL ? 'لم يتم العثور على المدرب' : 'Instructor not found'}</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isRTL ? 'رجوع' : 'Go Back'}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={isRTL ? 'ملف المدرب' : 'Instructor Profile'}>
      <div className="space-y-6">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {isRTL ? 'رجوع' : 'Back'}
        </Button>

        {/* Profile Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <Avatar className="h-24 w-24">
                <AvatarImage src={data.profile.avatar_url} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {data.profile.full_name?.charAt(0) || 'I'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">
                  {language === 'ar' ? data.profile.full_name_ar || data.profile.full_name : data.profile.full_name}
                </h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary">
                    {isRTL ? 'مدرب' : 'Instructor'}
                  </Badge>
                  {data.profile.specialization && (
                    <Badge variant="outline">
                      {language === 'ar' ? data.profile.specialization_ar || data.profile.specialization : data.profile.specialization}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {data.profile.email}
                  </span>
                  {data.profile.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {data.profile.phone}
                    </span>
                  )}
                </div>
              </div>
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
                  <p className="text-2xl font-bold">{data.groups.length}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'المجموعات' : 'Groups'}</p>
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
                  <p className="text-2xl font-bold">{data.sessions.length}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'جلسات قادمة' : 'Upcoming Sessions'}</p>
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
                  <p className="text-2xl font-bold">{data.quizzes.length}</p>
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
        <Tabs defaultValue="groups" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="groups">{isRTL ? 'المجموعات' : 'Groups'}</TabsTrigger>
            <TabsTrigger value="sessions">{isRTL ? 'الجلسات' : 'Sessions'}</TabsTrigger>
            <TabsTrigger value="quizzes">{isRTL ? 'الكويزات' : 'Quizzes'}</TabsTrigger>
            <TabsTrigger value="assignments">{isRTL ? 'الواجبات' : 'Assignments'}</TabsTrigger>
          </TabsList>

          {/* Groups Tab */}
          <TabsContent value="groups">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {isRTL ? 'المجموعات' : 'Groups'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.groups.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {isRTL ? 'لا توجد مجموعات' : 'No groups assigned'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.groups.map((group: any) => (
                      <div 
                        key={group.id} 
                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate(`/group/${group.id}`)}
                      >
                        <div>
                          <p className="font-medium">
                            {language === 'ar' ? group.name_ar : group.name}
                          </p>
                          <div className="flex gap-2 mt-1">
                            {group.age_groups && (
                              <Badge variant="outline" className="text-xs">
                                {language === 'ar' ? group.age_groups.name_ar : group.age_groups.name}
                              </Badge>
                            )}
                            {group.levels && (
                              <Badge variant="secondary" className="text-xs">
                                {language === 'ar' ? group.levels.name_ar : group.levels.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline">
                            {group.schedule_day} - {formatTime12Hour(group.schedule_time, isRTL)}
                          </Badge>
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
                  {isRTL ? 'الجلسات القادمة' : 'Upcoming Sessions'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.sessions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {isRTL ? 'لا توجد جلسات قادمة' : 'No upcoming sessions'}
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
                            {language === 'ar' ? session.groups?.name_ar : session.groups?.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatDate(session.session_date)}</p>
                          <p className="text-sm text-muted-foreground">{formatTime12Hour(session.session_time, isRTL)}</p>
                        </div>
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
                  {isRTL ? 'الكويزات المنشأة' : 'Created Quizzes'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.quizzes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {isRTL ? 'لا توجد كويزات' : 'No quizzes created'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.quizzes.map((quiz: any) => (
                      <div key={quiz.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">
                            {language === 'ar' ? quiz.title_ar : quiz.title}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {quiz.duration_minutes} {isRTL ? 'دقيقة' : 'min'}
                          </p>
                        </div>
                        <Badge variant={quiz.is_active ? 'default' : 'secondary'}>
                          {quiz.is_active ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}
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
                  {isRTL ? 'الواجبات المعينة' : 'Assigned Tasks'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.assignments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {isRTL ? 'لا توجد واجبات' : 'No assignments created'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.assignments.map((assignment: any) => (
                      <div key={assignment.id} className="flex items-center justify-between p-3 rounded-lg border">
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
