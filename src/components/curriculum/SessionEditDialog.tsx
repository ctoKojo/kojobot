import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, BookOpen, Video, Film, HelpCircle, Upload, X, FileIcon, Pencil, RotateCcw, Unlink } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface CurriculumSession {
  id: string;
  session_number: number;
  title: string;
  title_ar: string;
  description: string | null;
  description_ar: string | null;
  slides_url: string | null;
  summary_video_url: string | null;
  full_video_url: string | null;
  quiz_id: string | null;
  assignment_title: string | null;
  assignment_title_ar: string | null;
  assignment_description: string | null;
  assignment_description_ar: string | null;
  assignment_attachment_url: string | null;
  assignment_attachment_type: string | null;
  assignment_max_score: number | null;
  updated_at: string;
  age_group_id: string;
  level_id: string;
}

interface QuizData {
  id: string;
  title: string;
  title_ar: string;
  duration_minutes: number;
  passing_score: number;
  questions_count: number;
}

interface Props {
  session: CurriculumSession | null;
  onClose: () => void;
}

export function SessionEditDialog({ session, onClose }: Props) {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Partial<CurriculumSession>>(session ? { ...session } : {});
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Quiz tab state
  const [creatingQuiz, setCreatingQuiz] = useState(false);
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizTitleAr, setQuizTitleAr] = useState('');
  const [quizDuration, setQuizDuration] = useState(30);
  const [quizPassingScore, setQuizPassingScore] = useState(60);
  const [unassigning, setUnassigning] = useState(false);

  // Reset form when session changes
  if (session && form.id !== session.id) {
    setForm({ ...session });
    setAssignmentFile(null);
    setQuizData(null);
  }

  // Fetch quiz data when session has quiz_id
  useEffect(() => {
    if (!session?.quiz_id) {
      setQuizData(null);
      return;
    }
    const fetchQuiz = async () => {
      setQuizLoading(true);
      try {
        const [quizRes, countRes] = await Promise.all([
          supabase.from('quizzes').select('id, title, title_ar, duration_minutes, passing_score').eq('id', session.quiz_id!).single(),
          supabase.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', session.quiz_id!),
        ]);
        if (quizRes.error) throw quizRes.error;
        const q = quizRes.data;
        setQuizData({ ...q, questions_count: countRes.count ?? 0 });
        setQuizTitle(q.title);
        setQuizTitleAr(q.title_ar);
        setQuizDuration(q.duration_minutes);
        setQuizPassingScore(q.passing_score);
      } catch (err) {
        console.error('Error fetching quiz:', err);
      } finally {
        setQuizLoading(false);
      }
    };
    fetchQuiz();
  }, [session?.quiz_id]);

  const handleCreateQuiz = async () => {
    if (!session || creatingQuiz) return;
    setCreatingQuiz(true);
    try {
      const { data, error } = await supabase.rpc('create_curriculum_quiz', { p_session_id: session.id });
      if (error) throw error;
      const result = data as any;
      const quizId = result?.quiz_id;
      if (!quizId) throw new Error('No quiz_id returned');

      toast.success(isRTL ? 'تم إنشاء الكويز بنجاح' : 'Quiz created successfully');
      queryClient.invalidateQueries({ queryKey: ['curriculum-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['curriculum-overview'] });
      onClose();
      navigate(`/quiz-editor/${quizId}?origin=curriculum&sessionId=${session.id}&ageGroupId=${session.age_group_id}&levelId=${session.level_id}`);
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'فشل في إنشاء الكويز' : 'Failed to create quiz'));
    } finally {
      setCreatingQuiz(false);
    }
  };

  const handleUnassignQuiz = async () => {
    if (!session?.quiz_id || unassigning) return;
    setUnassigning(true);
    try {
      const { data, error } = await supabase.rpc('unassign_curriculum_quiz', {
        p_session_id: session.id,
        p_expected_quiz_id: session.quiz_id,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.unassigned) {
        toast.success(isRTL ? 'تم إلغاء ربط الكويز' : 'Quiz unlinked successfully');
        queryClient.invalidateQueries({ queryKey: ['curriculum-sessions'] });
        queryClient.invalidateQueries({ queryKey: ['curriculum-overview'] });
        onClose();
      } else {
        toast.error(isRTL ? 'حدث تعارض. أعد فتح الصفحة.' : 'Conflict detected. Please refresh.');
      }
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'فشل في إلغاء الربط' : 'Failed to unlink quiz'));
    } finally {
      setUnassigning(false);
    }
  };

  const handleResetQuizTitle = () => {
    if (!session) return;
    setQuizTitle(`Quiz - Session ${session.session_number}`);
    setQuizTitleAr(`كويز - سيشن ${session.session_number}`);
  };

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);

    let attachmentUrl = form.assignment_attachment_url ?? null;
    let attachmentType = form.assignment_attachment_type ?? null;

    if (assignmentFile) {
      setUploadingFile(true);
      try {
        const ext = assignmentFile.name.split('.').pop();
        const fileName = `assignments/${session.age_group_id}/${session.level_id}/${session.session_number}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('curriculum').upload(fileName, assignmentFile);
        if (uploadError) throw uploadError;
        attachmentUrl = fileName;
        attachmentType = assignmentFile.type;
      } catch (err: any) {
        toast.error(err.message || (isRTL ? 'فشل في رفع الملف' : 'Failed to upload file'));
        setSaving(false);
        setUploadingFile(false);
        return;
      }
      setUploadingFile(false);
    }

    try {
      // Update quiz settings if quiz is linked and data changed
      if (session.quiz_id && quizData) {
        const quizUpdates: Record<string, any> = {};
        if (quizTitle !== quizData.title) quizUpdates.title = quizTitle;
        if (quizTitleAr !== quizData.title_ar) quizUpdates.title_ar = quizTitleAr;
        if (quizDuration !== quizData.duration_minutes) quizUpdates.duration_minutes = quizDuration;
        if (quizPassingScore !== quizData.passing_score) quizUpdates.passing_score = quizPassingScore;
        if (Object.keys(quizUpdates).length > 0) {
          quizUpdates.updated_at = new Date().toISOString();
          const { error: quizError } = await supabase.from('quizzes').update(quizUpdates).eq('id', session.quiz_id);
          if (quizError) throw quizError;
        }
      }

      const { data, error } = await supabase.rpc('update_curriculum_session', {
        p_id: session.id,
        p_expected_updated_at: session.updated_at,
        p_data: {
          title: form.title || '',
          title_ar: form.title_ar || '',
          description: form.description || null,
          description_ar: form.description_ar || null,
          slides_url: form.slides_url || null,
          summary_video_url: form.summary_video_url || null,
          full_video_url: form.full_video_url || null,
          quiz_id: form.quiz_id || null,
          assignment_title: form.assignment_title || null,
          assignment_title_ar: form.assignment_title_ar || null,
          assignment_description: form.assignment_description || null,
          assignment_description_ar: form.assignment_description_ar || null,
          assignment_attachment_url: attachmentUrl,
          assignment_attachment_type: attachmentType,
          assignment_max_score: form.assignment_max_score ?? 100,
        },
      });
      if (error) throw error;
      const result = data as any;
      if (result?.updated === false && result?.reason === 'conflict') {
        toast.error(isRTL
          ? 'تم تعديل هذا السيشن من مستخدم آخر. أعد فتح الصفحة.'
          : 'This session was modified by another user. Please refresh.');
      } else {
        toast.success(isRTL ? 'تم تحديث السيشن' : 'Session updated');
        queryClient.invalidateQueries({ queryKey: ['curriculum-sessions'] });
        queryClient.invalidateQueries({ queryKey: ['curriculum-overview'] });
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'فشل في التحديث' : 'Failed to update'));
    }
    setSaving(false);
  };

  return (
    <Dialog open={!!session} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isRTL ? `تعديل السيشن ${session?.session_number}` : `Edit Session ${session?.session_number}`}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="basic">{isRTL ? 'أساسي' : 'Basic'}</TabsTrigger>
            <TabsTrigger value="content">{isRTL ? 'محتوى' : 'Content'}</TabsTrigger>
            <TabsTrigger value="quiz">{isRTL ? 'كويز' : 'Quiz'}</TabsTrigger>
            <TabsTrigger value="assignment">{isRTL ? 'واجب' : 'Assignment'}</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{isRTL ? 'العنوان (إنجليزي)' : 'Title (English)'}</Label>
                <Input value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{isRTL ? 'العنوان (عربي)' : 'Title (Arabic)'}</Label>
                <Input value={form.title_ar || ''} onChange={e => setForm(f => ({ ...f, title_ar: e.target.value }))} className="mt-1" dir="rtl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{isRTL ? 'الوصف (إنجليزي)' : 'Description (English)'}</Label>
                <Textarea value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1" rows={3} />
              </div>
              <div>
                <Label>{isRTL ? 'الوصف (عربي)' : 'Description (Arabic)'}</Label>
                <Textarea value={form.description_ar || ''} onChange={e => setForm(f => ({ ...f, description_ar: e.target.value }))} className="mt-1" rows={3} dir="rtl" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-4 mt-4">
            <div>
              <Label className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" />{isRTL ? 'رابط السلايد' : 'Slides URL'}</Label>
              <Input value={form.slides_url || ''} onChange={e => setForm(f => ({ ...f, slides_url: e.target.value }))} placeholder="https://docs.google.com/presentation/..." className="mt-1" />
            </div>
            <div>
              <Label className="flex items-center gap-1.5"><Video className="h-4 w-4" />{isRTL ? 'رابط فيديو ملخص' : 'Summary Video URL'}</Label>
              <Input value={form.summary_video_url || ''} onChange={e => setForm(f => ({ ...f, summary_video_url: e.target.value }))} placeholder="https://..." className="mt-1" />
            </div>
            <div>
              <Label className="flex items-center gap-1.5"><Film className="h-4 w-4" />{isRTL ? 'رابط فيديو كامل' : 'Full Video URL'}</Label>
              <Input value={form.full_video_url || ''} onChange={e => setForm(f => ({ ...f, full_video_url: e.target.value }))} placeholder="https://..." className="mt-1" />
            </div>
          </TabsContent>

          <TabsContent value="quiz" className="space-y-4 mt-4">
            {!session?.quiz_id ? (
              /* No quiz linked - show create button */
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <HelpCircle className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  {isRTL ? 'لا يوجد كويز مربوط بهذا السيشن' : 'No quiz linked to this session'}
                </p>
                <Button onClick={handleCreateQuiz} disabled={creatingQuiz}>
                  {creatingQuiz && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
                  {isRTL ? 'إنشاء كويز لهذا السيشن' : 'Create Quiz for this Session'}
                </Button>
              </div>
            ) : quizLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : quizData ? (
              /* Quiz linked - show details */
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{isRTL ? 'اسم الكويز (إنجليزي)' : 'Quiz Title (EN)'}</Label>
                    <div className="flex items-center gap-1 mt-1">
                      <Input value={quizTitle} onChange={e => setQuizTitle(e.target.value)} className="flex-1" />
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={handleResetQuizTitle} title={isRTL ? 'إعادة تعيين' : 'Reset'}>
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>{isRTL ? 'اسم الكويز (عربي)' : 'Quiz Title (AR)'}</Label>
                    <Input value={quizTitleAr} onChange={e => setQuizTitleAr(e.target.value)} className="mt-1" dir="rtl" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>{isRTL ? 'المدة (دقيقة)' : 'Duration (min)'}</Label>
                    <Input type="number" value={quizDuration} onChange={e => setQuizDuration(Number(e.target.value) || 30)} className="mt-1" />
                  </div>
                  <div>
                    <Label>{isRTL ? 'درجة النجاح %' : 'Pass Score %'}</Label>
                    <Input type="number" value={quizPassingScore} onChange={e => setQuizPassingScore(Number(e.target.value) || 60)} className="mt-1" />
                  </div>
                  <div>
                    <Label>{isRTL ? 'عدد الأسئلة' : 'Questions'}</Label>
                    <div className="mt-1 h-10 flex items-center px-3 rounded-md border bg-muted/30 text-sm font-medium">
                      {quizData.questions_count}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      onClose();
                      navigate(`/quiz-editor/${quizData.id}?origin=curriculum&sessionId=${session.id}&ageGroupId=${session.age_group_id}&levelId=${session.level_id}`);
                    }}
                  >
                    <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {isRTL ? 'تعديل الأسئلة' : 'Edit Questions'}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                        <Unlink className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                        {isRTL ? 'إلغاء ربط الكويز' : 'Unlink Quiz'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{isRTL ? 'إلغاء ربط الكويز' : 'Unlink Quiz'}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {isRTL
                            ? 'سيتم فك الكويز من هذا السيشن. الكويز نفسه سيبقى موجوداً ولن يُحذف.'
                            : 'The quiz will be unlinked from this session. The quiz itself will not be deleted.'}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleUnassignQuiz} disabled={unassigning} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          {unassigning && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
                          {isRTL ? 'تأكيد الإلغاء' : 'Confirm Unlink'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="assignment" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{isRTL ? 'عنوان الواجب (إنجليزي)' : 'Assignment Title (EN)'}</Label>
                <Input value={form.assignment_title || ''} onChange={e => setForm(f => ({ ...f, assignment_title: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>{isRTL ? 'عنوان الواجب (عربي)' : 'Assignment Title (AR)'}</Label>
                <Input value={form.assignment_title_ar || ''} onChange={e => setForm(f => ({ ...f, assignment_title_ar: e.target.value }))} className="mt-1" dir="rtl" />
              </div>
            </div>
            <div>
              <Label>{isRTL ? 'وصف الواجب' : 'Assignment Description'}</Label>
              <Textarea value={form.assignment_description || ''} onChange={e => setForm(f => ({ ...f, assignment_description: e.target.value }))} className="mt-1" rows={2} />
            </div>

            <div>
              <Label className="flex items-center gap-1.5"><Upload className="h-4 w-4" />{isRTL ? 'ملف مرفق' : 'Attachment'}</Label>
              {form.assignment_attachment_url && !assignmentFile ? (
                <div className="flex items-center gap-2 mt-1 p-2 border rounded-md bg-muted/30">
                  <FileIcon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm truncate flex-1">{form.assignment_attachment_url.split('/').pop()}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setForm(f => ({ ...f, assignment_attachment_url: null, assignment_attachment_type: null })); setAssignmentFile(null); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : assignmentFile ? (
                <div className="flex items-center gap-2 mt-1 p-2 border rounded-md bg-muted/30">
                  <FileIcon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm truncate flex-1">{assignmentFile.name}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAssignmentFile(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="mt-1 border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                  <p className="text-sm text-muted-foreground">{isRTL ? 'اضغط لاختيار ملف' : 'Click to select file'}</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.zip,.rar" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) setAssignmentFile(file); e.target.value = ''; }} />
            </div>

            <div className="w-32">
              <Label>{isRTL ? 'الدرجة القصوى' : 'Max Score'}</Label>
              <Input type="number" value={form.assignment_max_score ?? 100} onChange={e => setForm(f => ({ ...f, assignment_max_score: Number(e.target.value) }))} className="mt-1" />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleSave} disabled={saving || uploadingFile}>
            {(saving || uploadingFile) && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
            {uploadingFile ? (isRTL ? 'جاري الرفع...' : 'Uploading...') : (isRTL ? 'حفظ' : 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
