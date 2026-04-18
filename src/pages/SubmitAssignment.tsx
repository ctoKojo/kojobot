import { useState, useEffect, useRef } from 'react';
import { formatDateTime } from '@/lib/timeUtils';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, Image, Video, X, CheckCircle, Clock, AlertTriangle, Snowflake } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logSubmit, logView } from '@/lib/activityLogger';
import { AttachmentViewer } from '@/components/AttachmentViewer';

interface Assignment {
  id: string;
  title: string;
  title_ar: string;
  description: string | null;
  description_ar: string | null;
  due_date: string;
  max_score: number | null;
  attachment_url: string | null;
  attachment_type: string | null;
  group_id: string | null;
}

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
}

export default function SubmitAssignment() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);

  useEffect(() => {
    if (assignmentId) fetchAssignmentData();
  }, [assignmentId]);

  const fetchAssignmentData = async () => {
    try {
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignments')
        .select('*')
        .eq('id', assignmentId)
        .single();

      if (assignmentError) throw assignmentError;
      setAssignment(assignmentData);

      // Check if group is frozen
      if (assignmentData.group_id) {
        const { data: groupData } = await supabase
          .from('groups')
          .select('status')
          .eq('id', assignmentData.group_id)
          .single();
        setIsFrozen(groupData?.status === 'frozen');
      }

      // Check for existing submission
      const { data: submissionData } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .eq('student_id', user?.id)
        .single();

      if (submissionData) {
        setSubmission(submissionData);
        setContent(submissionData.content || '');
      }
    } catch (error) {
      console.error('Error fetching assignment:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في تحميل الواجب' : 'Failed to load assignment',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Check file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: t.common.error,
          description: isRTL ? 'حجم الملف يجب أن يكون أقل من 10MB' : 'File size must be less than 10MB',
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async () => {
    if (!user || !assignment || submitting) return;
    setSubmitting(true);

    try {
      let attachmentUrl = submission?.attachment_url || null;
      let attachmentType = submission?.attachment_type || null;

      // Upload file if exists (new file always replaces old one)
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${assignment.id}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('assignments')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('assignments')
          .getPublicUrl(fileName);

        attachmentUrl = urlData.publicUrl;
        attachmentType = file.type.split('/')[0]; // image, video, application, etc.
      }

      const payload = {
        assignment_id: assignment.id,
        student_id: user.id,
        content: content || null,
        attachment_url: attachmentUrl,
        attachment_type: attachmentType,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        // Clear grading data on resubmission
        score: null,
        feedback: null,
        feedback_ar: null,
        graded_at: null,
        graded_by: null,
      };

      if (submission) {
        // Update existing submission
        const { error } = await supabase
          .from('assignment_submissions')
          .update(payload)
          .eq('id', submission.id);

        if (error) throw error;
      } else {
        // Create new submission
        const { error } = await supabase
          .from('assignment_submissions')
          .insert([payload]);

        if (error) throw error;

        // Send notification to instructor
        try {
          // Get instructor id from assignment's group
          if (assignment.group_id) {
            const { data: groupData } = await supabase
              .from('groups')
              .select('instructor_id')
              .eq('id', assignment.group_id)
              .single();

            if (groupData?.instructor_id) {
              // Get student name
              const { data: profileData } = await supabase
                .from('profiles')
                .select('full_name, full_name_ar')
                .eq('user_id', user.id)
                .single();

              const studentName = profileData?.full_name || 'Student';
              const studentNameAr = profileData?.full_name_ar || 'طالب';
              const assignmentTitle = assignment.title;
              const assignmentTitleAr = assignment.title_ar;

              await supabase.from('notifications').insert({
                user_id: groupData.instructor_id,
                title: `New Assignment Submission`,
                title_ar: `تسليم واجب جديد`,
                message: `${studentName} has submitted "${assignmentTitle}"`,
                message_ar: `${studentNameAr} قام بتسليم "${assignmentTitleAr}"`,
                type: 'info',
                category: 'assignment',
                action_url: `/assignment-submissions/${assignment.id}`,
              });
            }
          }
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
          // Don't fail the submission if notification fails
        }
      }

      // Log assignment submission
      await logSubmit('assignment_submission', assignment.id, { 
        assignment_title: assignment.title,
        has_attachment: !!attachmentUrl 
      });

      toast({
        title: t.common.success,
        description: isRTL ? 'تم تسليم الواجب بنجاح' : 'Assignment submitted successfully',
      });

      navigate('/assignments');
    } catch (error) {
      console.error('Error submitting assignment:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في تسليم الواجب' : 'Failed to submit assignment',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // SSOT: using centralized formatDateTime from timeUtils.ts

  const isOverdue = assignment ? new Date(assignment.due_date) < new Date() : false;
  const isGraded = submission?.status === 'graded';
  const isRevisionRequested = submission?.status === 'revision_requested';
  const canSubmit = (!isGraded || isRevisionRequested) && !isFrozen;

  const getFileIcon = (type: string | null) => {
    if (!type) return <FileText className="w-8 h-8" />;
    if (type.startsWith('image')) return <Image className="w-8 h-8" />;
    if (type.startsWith('video')) return <Video className="w-8 h-8" />;
    return <FileText className="w-8 h-8" />;
  };

  if (loading) {
    return (
      <DashboardLayout title={t.assignments.submitAssignment}>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{t.common.loading}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={t.assignments.submitAssignment}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate('/assignments')}>
          {isRTL ? <ArrowLeft className="w-4 h-4 mr-2 rotate-180" /> : <ArrowLeft className="w-4 h-4 mr-2" />}
          {t.common.back}
        </Button>

        {/* Assignment Details */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{language === 'ar' ? assignment?.title_ar : assignment?.title}</CardTitle>
                <CardDescription className="mt-2">
                  {language === 'ar' ? assignment?.description_ar : assignment?.description}
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2">
                {isOverdue ? (
                  <Badge variant="destructive">{isRTL ? 'منتهي' : 'Overdue'}</Badge>
                ) : (
                  <Badge variant="outline" className="bg-green-100 text-green-800">
                    {isRTL ? 'نشط' : 'Active'}
                  </Badge>
                )}
                {isGraded && (
                  <Badge variant="secondary">{isRTL ? 'تم التقييم' : 'Graded'}</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {isRTL ? 'موعد التسليم: ' : 'Due: '}
                {assignment && formatDateTime(assignment.due_date, language)}
              </div>
              {assignment?.max_score && (
                <div>
                  {isRTL ? 'الدرجة القصوى: ' : 'Max Score: '}
                  {assignment.max_score}
                </div>
              )}
            </div>

            {/* Assignment Attachment */}
            {assignment?.attachment_url && (
              <div className="p-4 rounded-lg border bg-muted/50">
                <p className="text-sm font-medium mb-2">{isRTL ? 'مرفقات الواجب:' : 'Assignment Attachments:'}</p>
                <a
                  href={assignment.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-2"
                >
                  {getFileIcon(assignment.attachment_type)}
                  {isRTL ? 'عرض المرفق' : 'View Attachment'}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grading Result */}
        {isGraded && submission && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <CheckCircle className="w-5 h-5" />
                {isRTL ? 'نتيجة التقييم' : 'Grading Result'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-green-800">
                  {submission.score} / {assignment?.max_score}
                </div>
                <p className="text-sm text-green-700 mt-1">
                  {Math.round((submission.score || 0) / (assignment?.max_score || 100) * 100)}%
                </p>
              </div>
              {(submission.feedback || submission.feedback_ar) && (
                <div className="p-4 rounded-lg bg-white border border-green-200">
                  <p className="text-sm font-medium text-green-800 mb-1">
                    {isRTL ? 'ملاحظات المدرب:' : 'Instructor Feedback:'}
                  </p>
                  <p className="text-gray-700">
                    {language === 'ar' ? submission.feedback_ar : submission.feedback}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Revision Requested Alert */}
        {isRevisionRequested && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <AlertTriangle className="w-5 h-5" />
                {isRTL ? 'مطلوب إعادة التسليم' : 'Revision Requested'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-orange-700">
                {isRTL 
                  ? 'طلب المعلم إعادة تسليم هذا الواجب. يرجى مراجعة الملاحظات وإعادة تسليم عملك.'
                  : 'Your instructor has requested a revision for this assignment. Please review the feedback and resubmit your work.'}
              </p>
              {(submission?.feedback || submission?.feedback_ar) && (
                <div className="mt-4 p-4 rounded-lg bg-white border border-orange-200">
                  <p className="text-sm font-medium text-orange-800 mb-1">
                    {isRTL ? 'ملاحظات المدرب:' : 'Instructor Feedback:'}
                  </p>
                  <p className="text-gray-700">
                    {language === 'ar' ? submission.feedback_ar : submission.feedback}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Frozen Group Alert */}
        {isFrozen && !submission && (
          <Card className="border-sky-300 bg-sky-50 dark:bg-sky-950/30 dark:border-sky-800">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Snowflake className="w-5 h-5 text-sky-600 flex-shrink-0" />
                <p className="text-sm text-sky-700 dark:text-sky-400">
                  {isRTL 
                    ? 'مجموعتك مجمدة حالياً — لا يمكنك تسليم واجبات جديدة.'
                    : 'Your group is frozen — you cannot submit new assignments.'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submission Form */}
        {canSubmit && (
          <Card>
            <CardHeader>
              <CardTitle>
                {isRevisionRequested 
                  ? (isRTL ? 'إعادة تسليم الواجب' : 'Resubmit Assignment')
                  : submission 
                    ? (isRTL ? 'تعديل التسليم' : 'Edit Submission') 
                    : (isRTL ? 'تسليم الواجب' : 'Submit Assignment')
                }
              </CardTitle>
              {submission && !isRevisionRequested && (
                <CardDescription>
                  {isRTL ? 'تم التسليم: ' : 'Submitted: '}{formatDateTime(submission.submitted_at, language)}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Text Content */}
              <div className="space-y-2">
                <Label>{isRTL ? 'محتوى الإجابة' : 'Answer Content'}</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={isRTL ? 'اكتب إجابتك هنا...' : 'Write your answer here...'}
                  className="min-h-[200px]"
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label>{isRTL ? 'رفع ملف (اختياري)' : 'Upload File (Optional)'}</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  accept="image/*,video/*,application/pdf,.doc,.docx,.ppt,.pptx"
                  className="hidden"
                />
                
                {file ? (
                  <div className="p-4 rounded-lg border bg-muted/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getFileIcon(file.type)}
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : submission?.attachment_url && !isRevisionRequested ? (
                  <div className="p-4 rounded-lg border bg-muted/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getFileIcon(submission.attachment_type)}
                      <div>
                        <p className="font-medium">{isRTL ? 'ملف مرفق سابق' : 'Previous attached file'}</p>
                        <a 
                          href={submission.attachment_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          {isRTL ? 'عرض الملف' : 'View file'}
                        </a>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {isRTL ? 'تغيير الملف' : 'Change file'}
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-8 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 cursor-pointer transition-colors text-center"
                  >
                    <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                    <p className="mt-2 text-muted-foreground">
                      {isRTL ? 'اضغط لرفع ملف' : 'Click to upload a file'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {isRTL ? 'صور، فيديو، PDF، Word, PowerPoint (حد أقصى 10MB)' : 'Images, Video, PDF, Word, PowerPoint (Max 10MB)'}
                    </p>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <Button
                className="w-full kojo-gradient"
                onClick={handleSubmit}
                disabled={submitting || (!content && !file && !submission?.attachment_url)}
              >
                {submitting ? t.common.loading : (submission ? (isRTL ? 'تحديث التسليم' : 'Update Submission') : t.assignments.submitAssignment)}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
