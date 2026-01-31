import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, FileText, Image, Video, CheckCircle, Clock, Download, RotateCcw } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Submission {
  id: string;
  content: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  status: string;
  score: number | null;
  feedback: string | null;
  feedback_ar: string | null;
  submitted_at: string;
  graded_at: string | null;
  student_id: string;
  assignment_id: string;
}

interface Assignment {
  id: string;
  title: string;
  title_ar: string;
  description: string | null;
  description_ar: string | null;
  max_score: number | null;
  due_date: string;
}

interface Profile {
  full_name: string;
  full_name_ar: string | null;
  email: string;
}

export default function GradeAssignment() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [studentProfile, setStudentProfile] = useState<Profile | null>(null);
  const [score, setScore] = useState<string>('');
  const [feedback, setFeedback] = useState('');
  const [feedbackAr, setFeedbackAr] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requestingRevision, setRequestingRevision] = useState(false);

  useEffect(() => {
    if (submissionId) fetchData();
  }, [submissionId]);

  const fetchData = async () => {
    try {
      // Get submission
      const { data: submissionData, error: submissionError } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('id', submissionId)
        .single();

      if (submissionError) throw submissionError;
      setSubmission(submissionData);
      setScore(submissionData.score?.toString() || '');
      setFeedback(submissionData.feedback || '');
      setFeedbackAr(submissionData.feedback_ar || '');

      // Get assignment
      const { data: assignmentData } = await supabase
        .from('assignments')
        .select('*')
        .eq('id', submissionData.assignment_id)
        .single();
      
      setAssignment(assignmentData);

      // Get student profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, full_name_ar, email')
        .eq('user_id', submissionData.student_id)
        .single();
      
      setStudentProfile(profileData);
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

  const handleGrade = async () => {
    if (!user || !submission || submitting) return;
    
    const scoreNum = parseInt(score);
    if (isNaN(scoreNum) || scoreNum < 0) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'يرجى إدخال درجة صحيحة' : 'Please enter a valid score',
      });
      return;
    }

    if (assignment?.max_score && scoreNum > assignment.max_score) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? `الدرجة يجب أن تكون أقل من ${assignment.max_score}` : `Score must be less than ${assignment.max_score}`,
      });
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('assignment_submissions')
        .update({
          score: scoreNum,
          feedback: feedback || null,
          feedback_ar: feedbackAr || null,
          status: 'graded',
          graded_at: new Date().toISOString(),
          graded_by: user.id,
        })
        .eq('id', submission.id);

      if (error) throw error;

      // Create notification for student
      await supabase.from('notifications').insert({
        user_id: submission.student_id,
        title: 'Assignment Graded',
        title_ar: 'تم تقييم الواجب',
        message: `Your assignment "${assignment?.title}" has been graded. Score: ${scoreNum}/${assignment?.max_score}`,
        message_ar: `تم تقييم واجبك "${assignment?.title_ar}". الدرجة: ${scoreNum}/${assignment?.max_score}`,
        type: 'success',
        category: 'assignment',
        action_url: `/assignment/${assignment?.id}`,
      });

      toast({
        title: t.common.success,
        description: isRTL ? 'تم حفظ التقييم بنجاح' : 'Grade saved successfully',
      });

      navigate('/assignments');
    } catch (error) {
      console.error('Error grading:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في حفظ التقييم' : 'Failed to save grade',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!user || !submission || requestingRevision) return;
    
    setRequestingRevision(true);

    try {
      const { error } = await supabase
        .from('assignment_submissions')
        .update({
          status: 'revision_requested',
          feedback: feedback || null,
          feedback_ar: feedbackAr || null,
        })
        .eq('id', submission.id);

      if (error) throw error;

      // Create notification for student
      await supabase.from('notifications').insert({
        user_id: submission.student_id,
        title: 'Revision Requested',
        title_ar: 'مطلوب إعادة التسليم',
        message: `Your instructor has requested a revision for "${assignment?.title}". Please resubmit your work.`,
        message_ar: `طلب المعلم إعادة تسليم الواجب "${assignment?.title_ar}". يرجى إعادة تسليم عملك.`,
        type: 'warning',
        category: 'assignment',
        action_url: `/assignment/${assignment?.id}`,
      });

      toast({
        title: t.common.success,
        description: isRTL ? 'تم طلب إعادة التسليم من الطالب' : 'Revision requested from student',
      });

      navigate('/assignments');
    } catch (error) {
      console.error('Error requesting revision:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في طلب إعادة التسليم' : 'Failed to request revision',
      });
    } finally {
      setRequestingRevision(false);
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

  const getFileIcon = (type: string | null) => {
    if (!type) return <FileText className="w-6 h-6" />;
    if (type.startsWith('image')) return <Image className="w-6 h-6" />;
    if (type.startsWith('video')) return <Video className="w-6 h-6" />;
    return <FileText className="w-6 h-6" />;
  };

  if (loading) {
    return (
      <DashboardLayout title={isRTL ? 'تقييم الواجب' : 'Grade Assignment'}>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{t.common.loading}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={isRTL ? 'تقييم الواجب' : 'Grade Assignment'}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate('/assignments')}>
          {isRTL ? <ArrowLeft className="w-4 h-4 mr-2 rotate-180" /> : <ArrowLeft className="w-4 h-4 mr-2" />}
          {t.common.back}
        </Button>

        {/* Assignment Info */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{language === 'ar' ? assignment?.title_ar : assignment?.title}</CardTitle>
                <CardDescription className="mt-2">
                  {language === 'ar' ? assignment?.description_ar : assignment?.description}
                </CardDescription>
              </div>
              <Badge variant={submission?.status === 'graded' ? 'secondary' : 'outline'}>
                {submission?.status === 'graded' 
                  ? (isRTL ? 'تم التقييم' : 'Graded') 
                  : (isRTL ? 'في انتظار التقييم' : 'Pending')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div>
                {isRTL ? 'الدرجة القصوى: ' : 'Max Score: '}
                <span className="font-medium">{assignment?.max_score}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {isRTL ? 'موعد التسليم: ' : 'Due: '}
                {assignment && formatDate(assignment.due_date)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Student Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {isRTL ? 'معلومات الطالب' : 'Student Information'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">
                  {language === 'ar' ? studentProfile?.full_name_ar : studentProfile?.full_name}
                </p>
                <p className="text-sm text-muted-foreground">{studentProfile?.email}</p>
              </div>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              {isRTL ? 'تاريخ التسليم: ' : 'Submitted: '}
              {submission && formatDate(submission.submitted_at)}
            </div>
          </CardContent>
        </Card>

        {/* Student's Submission */}
        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'إجابة الطالب' : 'Student Submission'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {submission?.content && (
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="whitespace-pre-wrap">{submission.content}</p>
              </div>
            )}

            {submission?.attachment_url && (
              <div className="p-4 rounded-lg border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getFileIcon(submission.attachment_type)}
                  <span>{isRTL ? 'ملف مرفق' : 'Attached file'}</span>
                </div>
                <a
                  href={submission.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <Download className="w-4 h-4" />
                  {isRTL ? 'تحميل' : 'Download'}
                </a>
              </div>
            )}

            {!submission?.content && !submission?.attachment_url && (
              <p className="text-muted-foreground text-center py-4">
                {isRTL ? 'لا يوجد محتوى' : 'No content submitted'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Grading Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              {isRTL ? 'التقييم' : 'Grading'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Score */}
            <div className="space-y-2">
              <Label>{isRTL ? 'الدرجة' : 'Score'}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="0"
                  className="w-32"
                  min="0"
                  max={assignment?.max_score || 100}
                />
                <span className="text-muted-foreground">/ {assignment?.max_score || 100}</span>
              </div>
            </div>

            {/* Feedback English */}
            <div className="space-y-2">
              <Label>{isRTL ? 'ملاحظات (إنجليزي)' : 'Feedback (English)'}</Label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={isRTL ? 'اكتب ملاحظاتك بالإنجليزية...' : 'Write your feedback in English...'}
                className="min-h-[100px]"
                dir="ltr"
              />
            </div>

            {/* Feedback Arabic */}
            <div className="space-y-2">
              <Label>{isRTL ? 'ملاحظات (عربي)' : 'Feedback (Arabic)'}</Label>
              <Textarea
                value={feedbackAr}
                onChange={(e) => setFeedbackAr(e.target.value)}
                placeholder={isRTL ? 'اكتب ملاحظاتك بالعربية...' : 'Write your feedback in Arabic...'}
                className="min-h-[100px]"
                dir="rtl"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Request Revision Button */}
              <Button
                variant="outline"
                className="flex-1 border-orange-500 text-orange-600 hover:bg-orange-50"
                onClick={handleRequestRevision}
                disabled={requestingRevision || submitting}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {requestingRevision ? t.common.loading : (isRTL ? 'طلب إعادة التسليم' : 'Request Revision')}
              </Button>
              
              {/* Save Grade Button */}
              <Button
                className="flex-1 kojo-gradient"
                onClick={handleGrade}
                disabled={submitting || requestingRevision || !score}
              >
                {submitting ? t.common.loading : (isRTL ? 'حفظ التقييم' : 'Save Grade')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
