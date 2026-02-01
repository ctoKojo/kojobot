import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, CheckCircle, Clock, FileText } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Submission {
  id: string;
  student_id: string;
  status: string;
  score: number | null;
  submitted_at: string;
  graded_at: string | null;
}

interface Profile {
  user_id: string;
  full_name: string;
  full_name_ar: string | null;
  email: string;
}

interface Assignment {
  id: string;
  title: string;
  title_ar: string;
  max_score: number | null;
  due_date: string;
}

export default function AssignmentSubmissions() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (assignmentId) fetchData();
  }, [assignmentId]);

  const fetchData = async () => {
    try {
      // Get assignment
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignments')
        .select('*')
        .eq('id', assignmentId)
        .single();

      if (assignmentError) throw assignmentError;
      setAssignment(assignmentData);

      // Get submissions
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: false });

      if (submissionsError) throw submissionsError;
      setSubmissions(submissionsData || []);

      // Get profiles for all students
      if (submissionsData && submissionsData.length > 0) {
        const studentIds = submissionsData.map(s => s.student_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, full_name_ar, email')
          .in('user_id', studentIds);

        const profileMap = new Map<string, Profile>();
        profilesData?.forEach(p => profileMap.set(p.user_id, p));
        setProfiles(profileMap);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في تحميل البيانات' : 'Failed to load data',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const stats = {
    total: submissions.length,
    graded: submissions.filter(s => s.status === 'graded').length,
    pending: submissions.filter(s => s.status === 'submitted').length,
    revision: submissions.filter(s => s.status === 'revision_requested').length,
  };

  const getLastModified = (submission: Submission) => {
    // Return the most recent date between submitted_at and graded_at
    const submittedDate = new Date(submission.submitted_at);
    const gradedDate = submission.graded_at ? new Date(submission.graded_at) : null;
    
    if (gradedDate && gradedDate > submittedDate) {
      return { date: gradedDate, isGraded: true };
    }
    return { date: submittedDate, isGraded: false };
  };

  if (loading) {
    return (
      <DashboardLayout title={isRTL ? 'تسليمات الواجب' : 'Assignment Submissions'}>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{t.common.loading}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={isRTL ? 'تسليمات الواجب' : 'Assignment Submissions'}>
      <div className="space-y-6">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate('/assignments')}>
          {isRTL ? <ArrowLeft className="w-4 h-4 mr-2 rotate-180" /> : <ArrowLeft className="w-4 h-4 mr-2" />}
          {t.common.back}
        </Button>

        {/* Assignment Info */}
        <Card>
          <CardHeader>
            <CardTitle>{language === 'ar' ? assignment?.title_ar : assignment?.title}</CardTitle>
            <CardDescription>
              {isRTL ? 'موعد التسليم: ' : 'Due: '}
              {assignment && formatDate(assignment.due_date)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
              <div className="p-2 sm:p-4 rounded-lg bg-muted">
                <div className="text-lg sm:text-2xl font-bold">{stats.total}</div>
                <p className="text-xs sm:text-sm text-muted-foreground">{isRTL ? 'الإجمالي' : 'Total'}</p>
              </div>
              <div className="p-2 sm:p-4 rounded-lg bg-green-100">
                <div className="text-lg sm:text-2xl font-bold text-green-800">{stats.graded}</div>
                <p className="text-xs sm:text-sm text-green-700">{isRTL ? 'تم التقييم' : 'Graded'}</p>
              </div>
              <div className="p-2 sm:p-4 rounded-lg bg-yellow-100">
                <div className="text-lg sm:text-2xl font-bold text-yellow-800">{stats.pending}</div>
                <p className="text-xs sm:text-sm text-yellow-700">{isRTL ? 'في الانتظار' : 'Pending'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mobile Cards View */}
        <div className="block md:hidden space-y-3">
          {submissions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {isRTL ? 'لا توجد تسليمات حتى الآن' : 'No submissions yet'}
                </p>
              </CardContent>
            </Card>
          ) : (
            submissions.map((submission) => {
              const profile = profiles.get(submission.student_id);
              return (
                <Card key={submission.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">
                            {language === 'ar' ? profile?.full_name_ar : profile?.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                        </div>
                      </div>
                      {submission.status === 'graded' ? (
                        <Badge className="bg-green-100 text-green-800 text-xs flex-shrink-0">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {isRTL ? 'مقيّم' : 'Graded'}
                        </Badge>
                      ) : submission.status === 'revision_requested' ? (
                        <Badge className="bg-orange-100 text-orange-800 text-xs flex-shrink-0">
                          {isRTL ? 'طلب تعديل' : 'Revision'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-xs flex-shrink-0">
                          <Clock className="w-3 h-3 mr-1" />
                          {isRTL ? 'انتظار' : 'Pending'}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <div className="text-sm">
                        <p className="text-xs text-muted-foreground">{formatDate(submission.submitted_at)}</p>
                        {submission.score !== null && (
                          <p className="font-medium mt-1">
                            {submission.score} / {assignment?.max_score}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={submission.status === 'graded' ? 'outline' : 'default'}
                        className={submission.status !== 'graded' ? 'kojo-gradient' : ''}
                        onClick={() => navigate(`/grade-assignment/${submission.id}`)}
                      >
                        {submission.status === 'graded' 
                          ? (isRTL ? 'عرض' : 'View') 
                          : (isRTL ? 'تقييم' : 'Grade')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Desktop Table View */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                  <TableHead>{isRTL ? 'تاريخ التسليم' : 'Submitted At'}</TableHead>
                  <TableHead>{isRTL ? 'آخر تحديث' : 'Last Updated'}</TableHead>
                  <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead>{isRTL ? 'الدرجة' : 'Score'}</TableHead>
                  <TableHead>{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        {isRTL ? 'لا توجد تسليمات حتى الآن' : 'No submissions yet'}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  submissions.map((submission) => {
                    const profile = profiles.get(submission.student_id);
                    const lastModified = getLastModified(submission);
                    return (
                      <TableRow key={submission.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {language === 'ar' ? profile?.full_name_ar : profile?.full_name}
                              </p>
                              <p className="text-sm text-muted-foreground">{profile?.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(submission.submitted_at)}</TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {formatDate(lastModified.date.toISOString())}
                          </span>
                        </TableCell>
                        <TableCell>
                          {submission.status === 'graded' ? (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {isRTL ? 'تم التقييم' : 'Graded'}
                            </Badge>
                          ) : submission.status === 'revision_requested' ? (
                            <Badge className="bg-orange-100 text-orange-800">
                              {isRTL ? 'طلب تعديل' : 'Revision'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                              <Clock className="w-3 h-3 mr-1" />
                              {isRTL ? 'في الانتظار' : 'Pending'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {submission.score !== null ? (
                            <span className="font-medium">
                              {submission.score} / {assignment?.max_score}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={submission.status === 'graded' ? 'outline' : 'default'}
                            className={submission.status !== 'graded' ? 'kojo-gradient' : ''}
                            onClick={() => navigate(`/grade-assignment/${submission.id}`)}
                          >
                            {submission.status === 'graded' 
                              ? (isRTL ? 'عرض / تعديل' : 'View / Edit') 
                              : (isRTL ? 'تقييم' : 'Grade')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
