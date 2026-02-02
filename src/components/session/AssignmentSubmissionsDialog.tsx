import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Eye, 
  Pencil, 
  CheckCircle2, 
  Clock, 
  CircleDashed, 
  ArrowLeft, 
  ArrowRight, 
  Download,
  FileText,
  RotateCcw,
  Save
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface AssignmentSubmissionData {
  submission_id: string | null;
  student_id: string;
  student_name: string;
  student_name_ar: string;
  content: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  status: 'not_submitted' | 'submitted' | 'graded' | 'revision_requested';
  score: number | null;
  feedback: string | null;
  feedback_ar: string | null;
  submitted_at: string | null;
  has_submitted: boolean;
}

interface AssignmentSubmissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignmentId: string;
  assignmentTitle: string;
  assignmentTitleAr: string;
  maxScore: number;
  groupId: string;
  onGraded?: () => void;
}

export function AssignmentSubmissionsDialog({
  open,
  onOpenChange,
  assignmentId,
  assignmentTitle,
  assignmentTitleAr,
  maxScore,
  groupId,
  onGraded,
}: AssignmentSubmissionsDialogProps) {
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<AssignmentSubmissionData[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<AssignmentSubmissionData | null>(null);
  const [gradeForm, setGradeForm] = useState({ score: '', feedback: '', feedback_ar: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && assignmentId) {
      fetchSubmissions();
    }
  }, [open, assignmentId]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      // Fetch all students in the group
      const { data: groupStudents } = await supabase
        .from('group_students')
        .select('student_id')
        .eq('group_id', groupId)
        .eq('is_active', true);

      const studentIds = groupStudents?.map(gs => gs.student_id) || [];

      // Fetch student profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, full_name_ar')
        .in('user_id', studentIds);

      // Fetch assignment submissions
      const { data: submissionsData } = await supabase
        .from('assignment_submissions')
        .select('id, student_id, content, attachment_url, attachment_type, status, score, feedback, feedback_ar, submitted_at')
        .eq('assignment_id', assignmentId);

      // Combine data
      const combinedSubmissions: AssignmentSubmissionData[] = studentIds.map(studentId => {
        const profile = profiles?.find(p => p.user_id === studentId);
        const submission = submissionsData?.find(s => s.student_id === studentId);

        return {
          submission_id: submission?.id || null,
          student_id: studentId,
          student_name: profile?.full_name || 'Unknown',
          student_name_ar: profile?.full_name_ar || profile?.full_name || 'غير معروف',
          content: submission?.content || null,
          attachment_url: submission?.attachment_url || null,
          attachment_type: submission?.attachment_type || null,
          status: submission?.status as AssignmentSubmissionData['status'] || 'not_submitted',
          score: submission?.score || null,
          feedback: submission?.feedback || null,
          feedback_ar: submission?.feedback_ar || null,
          submitted_at: submission?.submitted_at || null,
          has_submitted: !!submission,
        };
      });

      setSubmissions(combinedSubmissions);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في تحميل التسليمات' : 'Failed to load submissions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openGradeView = (submission: AssignmentSubmissionData) => {
    setSelectedSubmission(submission);
    setGradeForm({
      score: submission.score?.toString() || '',
      feedback: submission.feedback || '',
      feedback_ar: submission.feedback_ar || '',
    });
  };

  const goBack = () => {
    setSelectedSubmission(null);
    setGradeForm({ score: '', feedback: '', feedback_ar: '' });
  };

  const handleSaveGrade = async () => {
    if (!selectedSubmission?.submission_id || !user) return;

    const scoreNum = Number(gradeForm.score);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > maxScore) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? `الدرجة يجب أن تكون بين 0 و ${maxScore}` : `Score must be between 0 and ${maxScore}`,
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('assignment_submissions')
        .update({
          score: scoreNum,
          feedback: gradeForm.feedback || null,
          feedback_ar: gradeForm.feedback_ar || null,
          status: 'graded',
          graded_by: user.id,
          graded_at: new Date().toISOString(),
        })
        .eq('id', selectedSubmission.submission_id);

      if (error) throw error;

      toast({
        title: isRTL ? 'تم الحفظ' : 'Saved',
        description: isRTL ? 'تم حفظ التقييم بنجاح' : 'Grade saved successfully',
      });

      goBack();
      fetchSubmissions();
      onGraded?.();
    } catch (error: any) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!selectedSubmission?.submission_id || !user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('assignment_submissions')
        .update({
          status: 'revision_requested',
          feedback: gradeForm.feedback || null,
          feedback_ar: gradeForm.feedback_ar || null,
        })
        .eq('id', selectedSubmission.submission_id);

      if (error) throw error;

      toast({
        title: isRTL ? 'تم الإرسال' : 'Sent',
        description: isRTL ? 'تم طلب إعادة التسليم' : 'Revision requested',
      });

      goBack();
      fetchSubmissions();
      onGraded?.();
    } catch (error: any) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Stats
  const submittedCount = submissions.filter(s => s.has_submitted).length;
  const gradedCount = submissions.filter(s => s.status === 'graded').length;
  const pendingCount = submissions.filter(s => s.status === 'submitted').length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'graded':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'submitted':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'revision_requested':
        return <RotateCcw className="h-4 w-4 text-orange-500" />;
      default:
        return <CircleDashed className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'graded':
        return isRTL ? 'تم التقييم' : 'Graded';
      case 'submitted':
        return isRTL ? 'بانتظار التقييم' : 'Pending';
      case 'revision_requested':
        return isRTL ? 'طلب إعادة' : 'Revision';
      default:
        return isRTL ? 'لم يسلم' : 'Not Submitted';
    }
  };

  const getStatusBadge = (status: string, score: number | null) => {
    switch (status) {
      case 'graded':
        return <Badge className="bg-green-500">{score}/{maxScore}</Badge>;
      case 'submitted':
        return <Badge className="bg-yellow-500">{isRTL ? 'انتظار' : 'Pending'}</Badge>;
      case 'revision_requested':
        return <Badge className="bg-orange-500">{isRTL ? 'إعادة' : 'Revision'}</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">{isRTL ? 'لم يسلم' : 'Not Submitted'}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {selectedSubmission && (
              <Button variant="ghost" size="icon" onClick={goBack} className="h-8 w-8">
                {isRTL ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
              </Button>
            )}
            <div>
              <DialogTitle>
                {selectedSubmission
                  ? (isRTL ? `تقييم واجب: ${selectedSubmission.student_name_ar}` : `Grade: ${selectedSubmission.student_name}`)
                  : (isRTL ? `تسليمات الواجب: ${assignmentTitleAr}` : `Submissions: ${assignmentTitle}`)
                }
              </DialogTitle>
              <DialogDescription>
                {selectedSubmission
                  ? (isRTL ? 'راجع التسليم وأدخل الدرجة والملاحظات' : 'Review submission and enter grade with feedback')
                  : (isRTL ? 'عرض حالة تسليمات كل طالب' : 'View submission status for each student')
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!selectedSubmission ? (
          <>
            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-3 py-3 border-b">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{submittedCount}/{submissions.length}</div>
                <div className="text-xs text-muted-foreground">{isRTL ? 'سلّموا' : 'Submitted'}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{gradedCount}</div>
                <div className="text-xs text-muted-foreground">{isRTL ? 'تم تقييمهم' : 'Graded'}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
                <div className="text-xs text-muted-foreground">{isRTL ? 'بانتظار التقييم' : 'Pending'}</div>
              </div>
            </div>

            {/* Submissions Table */}
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="space-y-3 p-4">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'الدرجة' : 'Score'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'الإجراءات' : 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map(submission => (
                      <TableRow key={submission.student_id}>
                        <TableCell className="font-medium">
                          {language === 'ar' ? submission.student_name_ar : submission.student_name}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {getStatusIcon(submission.status)}
                            <span className="text-sm">{getStatusText(submission.status)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(submission.status, submission.score)}
                        </TableCell>
                        <TableCell className="text-center">
                          {submission.has_submitted ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openGradeView(submission)}
                              className="h-8"
                            >
                              {submission.status === 'graded' ? (
                                <>
                                  <Eye className="h-4 w-4 mr-1" />
                                  {isRTL ? 'عرض' : 'View'}
                                </>
                              ) : (
                                <>
                                  <Pencil className="h-4 w-4 mr-1" />
                                  {isRTL ? 'تقييم' : 'Grade'}
                                </>
                              )}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </>
        ) : (
          /* Grade View */
          <ScrollArea className="flex-1">
            <div className="space-y-4 p-4">
              {/* Submission Content */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">{isRTL ? 'محتوى التسليم' : 'Submission Content'}</Label>
                {selectedSubmission.content ? (
                  <div className="p-4 rounded-lg border bg-muted/30 whitespace-pre-wrap">
                    {selectedSubmission.content}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border bg-muted/30 text-muted-foreground italic">
                    {isRTL ? 'لا يوجد نص مكتوب' : 'No text content'}
                  </div>
                )}
              </div>

              {/* Attachment */}
              {selectedSubmission.attachment_url && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold">{isRTL ? 'ملف مرفق' : 'Attachment'}</Label>
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {selectedSubmission.attachment_type || 'File'}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href={selectedSubmission.attachment_url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4 mr-1" />
                        {isRTL ? 'تحميل' : 'Download'}
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              {/* Grade Input */}
              <div className="space-y-2">
                <Label>{isRTL ? 'الدرجة' : 'Score'}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={maxScore}
                    value={gradeForm.score}
                    onChange={(e) => setGradeForm({ ...gradeForm, score: e.target.value })}
                    className="w-24"
                    placeholder="0"
                  />
                  <span className="text-muted-foreground">/ {maxScore}</span>
                </div>
              </div>

              {/* Feedback */}
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>{isRTL ? 'ملاحظات' : 'Feedback'} (English)</Label>
                  <Textarea
                    value={gradeForm.feedback}
                    onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })}
                    placeholder="Enter feedback..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? 'ملاحظات' : 'Feedback'} (عربي)</Label>
                  <Textarea
                    value={gradeForm.feedback_ar}
                    onChange={(e) => setGradeForm({ ...gradeForm, feedback_ar: e.target.value })}
                    placeholder="أدخل الملاحظات..."
                    rows={3}
                    dir="rtl"
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
        )}

        {selectedSubmission && (
          <DialogFooter className="border-t pt-4">
            <Button
              variant="outline"
              onClick={handleRequestRevision}
              disabled={saving}
              className="text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              {isRTL ? 'طلب إعادة تسليم' : 'Request Revision'}
            </Button>
            <Button onClick={handleSaveGrade} disabled={saving || !gradeForm.score}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ التقييم' : 'Save Grade')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
