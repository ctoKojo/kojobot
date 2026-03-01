import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, BookOpen, Video, Film, HelpCircle, Upload, X, FileIcon, Pencil, RotateCcw, Unlink, Sparkles, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { extractLastPageAsImage } from '@/lib/pdfLastPage';
import { AssignmentPreviewDialog } from './AssignmentPreviewDialog';

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
  student_pdf_path: string | null;
  student_pdf_filename: string | null;
  student_pdf_size: number | null;
  student_pdf_text: string | null;
  student_pdf_text_updated_at: string | null;
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
  const pdfInputRef = useRef<HTMLInputElement>(null);

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
  const [quizDuration, setQuizDuration] = useState(15);
  const [quizPassingScore, setQuizPassingScore] = useState(60);
  const [unassigning, setUnassigning] = useState(false);

  // PDF state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [extractingText, setExtractingText] = useState(false);
  const [creatingAiQuiz, setCreatingAiQuiz] = useState(false);
  const [fetchingFresh, setFetchingFresh] = useState(false);

  // Assignment preview state
  const [assignmentPreviewOpen, setAssignmentPreviewOpen] = useState(false);
  const [assignmentPreviewImage, setAssignmentPreviewImage] = useState<string | null>(null);
  const [assignmentPreviewBlob, setAssignmentPreviewBlob] = useState<Blob | null>(null);
  const [assignmentExtracting, setAssignmentExtracting] = useState(false);

  // Unified sync function for updated_at
  const syncUpdatedAt = (newUpdatedAt: string) => {
    setForm(f => ({ ...f, updated_at: newUpdatedAt }));
  };

  // Reset form when session changes + fetch fresh updated_at
  if (session && form.id !== session.id) {
    setForm({ ...session });
    setAssignmentFile(null);
    setQuizData(null);
  }

  // Fetch fresh updated_at when dialog opens
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const fetchFresh = async () => {
      setFetchingFresh(true);
      try {
        const { data, error } = await supabase
          .from('curriculum_sessions')
          .select('updated_at')
          .eq('id', session.id)
          .single();
        if (!cancelled && data && !error) {
          syncUpdatedAt(data.updated_at);
        }
      } catch (err) {
        console.error('Failed to fetch fresh updated_at:', err);
      } finally {
        if (!cancelled) setFetchingFresh(false);
      }
    };
    fetchFresh();
    return () => { cancelled = true; };
  }, [session?.id]);

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
      toast.success(isRTL ? 'تم إنشاء الكويز' : 'Quiz created');
      queryClient.invalidateQueries({ queryKey: ['curriculum-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['curriculum-overview'] });
      setForm(f => ({ ...f, quiz_id: quizId }));
      onClose();
      navigate(`/quiz-editor/${quizId}?origin=curriculum&sessionId=${session.id}&ageGroupId=${session.age_group_id}&levelId=${session.level_id}`);
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'فشل في إنشاء الكويز' : 'Failed to create quiz'));
    } finally {
      setCreatingQuiz(false);
    }
  };

  const handleUnassignQuiz = async () => {
    if (!session || !session.quiz_id || unassigning) return;
    setUnassigning(true);
    try {
      const { data, error } = await supabase.rpc('unassign_curriculum_quiz', {
        p_session_id: session.id,
        p_expected_quiz_id: session.quiz_id,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.unassigned) {
        setForm(f => ({ ...f, quiz_id: null }));
        setQuizData(null);
        toast.success(isRTL ? 'تم إلغاء ربط الكويز' : 'Quiz unlinked');
        queryClient.invalidateQueries({ queryKey: ['curriculum-sessions'] });
        queryClient.invalidateQueries({ queryKey: ['curriculum-overview'] });
      } else {
        toast.error(isRTL ? 'تعارض - يرجى إعادة فتح الصفحة' : 'Conflict - please refresh');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUnassigning(false);
    }
  };

  const handleResetQuizTitle = () => {
    if (!session) return;
    setQuizTitle(`Quiz - Session ${session.session_number}`);
    setQuizTitleAr(`كويز - سيشن ${session.session_number}`);
  };

  // PDF Upload handler
  const handlePdfUpload = async (file: File) => {
    if (!session) return;
    setUploadingPdf(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${session.age_group_id}/${session.level_id}/${session.session_number}/${Date.now()}.${ext}`;
      
      // Delete old PDF if exists
      if (form.student_pdf_path) {
        await supabase.storage.from('session-slides-pdf').remove([form.student_pdf_path]);
      }
      
      const { error: uploadError } = await supabase.storage.from('session-slides-pdf').upload(fileName, file);
      if (uploadError) throw uploadError;
      
      // Update form state
      setForm(f => ({ 
        ...f, 
        student_pdf_path: fileName, 
        student_pdf_filename: file.name,
        student_pdf_size: file.size,
      }));
      setPdfFile(null);
      
      toast.success(isRTL ? 'تم رفع الملف بنجاح' : 'PDF uploaded successfully');
      
      // Save PDF metadata via upsert_session_asset RPC
      setExtractingText(true);
      try {
        const { data: assetResult, error: assetError } = await supabase.rpc('upsert_session_asset', {
          p_session_id: session.id,
          p_student_pdf_path: fileName,
          p_student_pdf_filename: file.name,
          p_student_pdf_size: file.size,
        });
        
        if (assetError) throw assetError;
        
        // Trigger text extraction
        const { data: extractResult, error: extractError } = await supabase.functions.invoke('extract-pdf-text', {
          body: { sessionId: session.id },
        });
        if (extractError) throw extractError;
        if (extractResult?.extracted) {
          setForm(f => ({ ...f, student_pdf_text: 'extracted', student_pdf_text_updated_at: new Date().toISOString() }));
          toast.success(isRTL ? 'تم استخراج النص من PDF' : 'PDF text extracted');
        }
      } catch (err: any) {
        console.error('Extract error:', err);
        toast.error(isRTL ? 'فشل في استخراج النص. يمكنك المحاولة لاحقاً.' : 'Failed to extract text. You can retry later.');
      } finally {
        setExtractingText(false);
      }

      // Extract last page for assignment preview
      try {
        const { blob } = await extractLastPageAsImage(file);
        const imageUrl = URL.createObjectURL(blob);
        setAssignmentPreviewImage(imageUrl);
        setAssignmentPreviewBlob(blob);
        setAssignmentPreviewOpen(true);
      } catch (err) {
        console.error('Failed to extract last page:', err);
        // Non-critical - just skip the preview
      }
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'فشل في رفع الملف' : 'Failed to upload PDF'));
    } finally {
      setUploadingPdf(false);
    }
  };

  // Handle assignment preview confirmation
  const handleAssignmentConfirm = async () => {
    if (!session || !assignmentPreviewBlob) return;
    setAssignmentExtracting(true);
    try {
      // 1. Upload the last page image as assignment attachment
      const attachmentFileName = `assignments/${session.age_group_id}/${session.level_id}/${session.session_number}/assignment_slide_${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage.from('curriculum').upload(attachmentFileName, assignmentPreviewBlob, {
        contentType: 'image/png',
      });
      if (uploadError) throw uploadError;

      // Update form with attachment
      setForm(f => ({
        ...f,
        assignment_attachment_url: attachmentFileName,
        assignment_attachment_type: 'image/png',
      }));

      // 2. Convert blob to base64 for AI extraction
      const arrayBuffer = await assignmentPreviewBlob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      // 3. Call AI to extract assignment text
      const { data: aiResult, error: aiError } = await supabase.functions.invoke('extract-assignment-slide', {
        body: { image_base64: base64, session_number: session.session_number },
      });

      if (aiError) {
        console.error('AI extraction error:', aiError);
        // Still set defaults even if AI fails
        setForm(f => ({
          ...f,
          assignment_title: f.assignment_title || `Assignment ${session.session_number}`,
          assignment_title_ar: f.assignment_title_ar || `واجب ${session.session_number}`,
        }));
        toast.warning(isRTL ? 'تم حفظ الصورة. فشل استخراج النص تلقائياً.' : 'Image saved. Auto text extraction failed.');
      } else if (aiResult?.assignment) {
        const a = aiResult.assignment;
        setForm(f => ({
          ...f,
          assignment_title: a.title_en || f.assignment_title || `Assignment ${session.session_number}`,
          assignment_title_ar: a.title_ar || f.assignment_title_ar || `واجب ${session.session_number}`,
          assignment_description: a.description_en || f.assignment_description || '',
          assignment_description_ar: a.description_ar || f.assignment_description_ar || '',
        }));
        toast.success(isRTL ? 'تم استخراج بيانات الواجب بنجاح!' : 'Assignment details extracted successfully!');
      }

      setAssignmentPreviewOpen(false);
    } catch (err: any) {
      console.error('Assignment confirm error:', err);
      toast.error(err.message || (isRTL ? 'فشل في معالجة الواجب' : 'Failed to process assignment'));
    } finally {
      setAssignmentExtracting(false);
    }
  };

  const handleAssignmentSkip = () => {
    setAssignmentPreviewOpen(false);
    // Cleanup preview URL
    if (assignmentPreviewImage) {
      URL.revokeObjectURL(assignmentPreviewImage);
      setAssignmentPreviewImage(null);
    }
    setAssignmentPreviewBlob(null);
  };

  const handleDeletePdf = async () => {
    if (!session || !form.student_pdf_path) return;
    try {
      await supabase.storage.from('session-slides-pdf').remove([form.student_pdf_path]);
      // Clear asset row
      await supabase.from('curriculum_session_assets').delete().eq('session_id', session.id);
      setForm(f => ({ ...f, student_pdf_path: null, student_pdf_filename: null, student_pdf_size: null, student_pdf_text: null, student_pdf_text_updated_at: null }));
      toast.success(isRTL ? 'تم حذف الملف' : 'PDF deleted');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCreateAiQuiz = async () => {
    if (!session || creatingAiQuiz) return;
    setCreatingAiQuiz(true);
    try {
      const { data, error } = await supabase.rpc('create_curriculum_quiz', { p_session_id: session.id });
      if (error) throw error;
      const result = data as any;
      const quizId = result?.quiz_id;
      if (!quizId) throw new Error('No quiz_id returned');

      toast.success(isRTL ? 'تم إنشاء الكويز. جاري فتح المحرر...' : 'Quiz created. Opening editor...');
      queryClient.invalidateQueries({ queryKey: ['curriculum-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['curriculum-overview'] });
      onClose();
      navigate(`/quiz-editor/${quizId}?origin=curriculum&sessionId=${session.id}&ageGroupId=${session.age_group_id}&levelId=${session.level_id}&openAi=true`);
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'فشل في إنشاء الكويز' : 'Failed to create quiz'));
    } finally {
      setCreatingAiQuiz(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
        p_expected_updated_at: form.updated_at || session.updated_at,
        p_data: {
          title: form.title || '',
          title_ar: form.title_ar || '',
          description: form.description || null,
          description_ar: form.description_ar || null,
          slides_url: form.slides_url || null,
          summary_video_url: form.summary_video_url || null,
          full_video_url: form.full_video_url || null,
          quiz_id: form.quiz_id || null,
          assignment_title: form.assignment_title || ((form.assignment_description || attachmentUrl) ? `Assignment ${session.session_number}` : null),
          assignment_title_ar: form.assignment_title_ar || ((form.assignment_description || attachmentUrl) ? `واجب ${session.session_number}` : null),
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
        if (result?.new_updated_at) {
          syncUpdatedAt(result.new_updated_at);
        }
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
    <>
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
              <TabsTrigger value="materials">{isRTL ? 'مواد' : 'Materials'}</TabsTrigger>
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

            <TabsContent value="materials" className="space-y-4 mt-4">
              {/* Slides URL - Admin only */}
              <div>
                <Label className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" />{isRTL ? 'رابط السلايدز (للأدمن فقط)' : 'Slides URL (Admin Only)'}</Label>
                <Input value={form.slides_url || ''} onChange={e => setForm(f => ({ ...f, slides_url: e.target.value }))} placeholder="https://docs.google.com/presentation/..." className="mt-1" />
              </div>

              {/* Student PDF Upload */}
              <div>
                <Label className="flex items-center gap-1.5"><FileText className="h-4 w-4" />{isRTL ? 'ملف PDF للطالب' : 'Student PDF'}</Label>
                {form.student_pdf_path ? (
                  <div className="mt-1 space-y-2">
                    <div className="flex items-center gap-2 p-2.5 border rounded-md bg-muted/30">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{form.student_pdf_filename || form.student_pdf_path.split('/').pop()}</p>
                        {form.student_pdf_size && <p className="text-xs text-muted-foreground">{formatFileSize(form.student_pdf_size)}</p>}
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleDeletePdf}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    {/* Text extraction status */}
                    {extractingText ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {isRTL ? 'جاري استخراج النص...' : 'Extracting text...'}
                      </div>
                    ) : form.student_pdf_text ? (
                      <div className="flex items-center gap-2 text-xs text-primary">
                        <CheckCircle2 className="h-3 w-3" />
                        {isRTL ? 'تم استخراج النص' : 'Text extracted'}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        {isRTL ? 'لم يتم استخراج النص بعد' : 'Text not yet extracted'}
                      </div>
                    )}
                  </div>
                ) : uploadingPdf ? (
                  <div className="mt-1 flex items-center gap-2 p-3 border rounded-md">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">{isRTL ? 'جاري الرفع...' : 'Uploading...'}</span>
                  </div>
                ) : (
                  <div 
                    className="mt-1 border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => pdfInputRef.current?.click()}
                  >
                    <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                    <p className="text-sm text-muted-foreground">{isRTL ? 'اضغط لرفع ملف PDF' : 'Click to upload PDF'}</p>
                  </div>
                )}
                <input 
                  ref={pdfInputRef} 
                  type="file" 
                  accept=".pdf" 
                  className="hidden" 
                  onChange={e => { 
                    const file = e.target.files?.[0]; 
                    if (file) handlePdfUpload(file); 
                    e.target.value = ''; 
                  }} 
                />
              </div>

              {/* Videos */}
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
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <HelpCircle className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    {isRTL ? 'لا يوجد كويز مربوط بهذا السيشن' : 'No quiz linked to this session'}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={handleCreateQuiz} disabled={creatingQuiz} variant="outline">
                      {creatingQuiz && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
                      {isRTL ? 'إنشاء كويز فارغ' : 'Create Empty Quiz'}
                    </Button>
                    <Button onClick={handleCreateAiQuiz} disabled={creatingAiQuiz} className="gap-2">
                      {creatingAiQuiz ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {isRTL ? 'إنشاء كويز بالذكاء الاصطناعي' : 'Create Quiz with AI'}
                    </Button>
                  </div>
                </div>
              ) : quizLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : quizData ? (
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
                      <Input type="number" value={quizDuration} onChange={e => setQuizDuration(Number(e.target.value) || 15)} className="mt-1" />
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
                  <Input
                    value={form.assignment_title || ''}
                    onChange={e => setForm(f => ({ ...f, assignment_title: e.target.value }))}
                    placeholder={`Assignment ${session?.session_number ?? ''}`}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>{isRTL ? 'عنوان الواجب (عربي)' : 'Assignment Title (AR)'}</Label>
                  <Input
                    value={form.assignment_title_ar || ''}
                    onChange={e => setForm(f => ({ ...f, assignment_title_ar: e.target.value }))}
                    placeholder={`واجب ${session?.session_number ?? ''}`}
                    className="mt-1"
                    dir="rtl"
                  />
                </div>
              </div>
              <div>
                <Label>{isRTL ? 'وصف الواجب (إنجليزي)' : 'Assignment Description (EN)'}</Label>
                <Textarea value={form.assignment_description || ''} onChange={e => setForm(f => ({ ...f, assignment_description: e.target.value }))} className="mt-1" rows={2} />
              </div>
              <div>
                <Label>{isRTL ? 'وصف الواجب (عربي)' : 'Assignment Description (AR)'}</Label>
                <Textarea value={form.assignment_description_ar || ''} onChange={e => setForm(f => ({ ...f, assignment_description_ar: e.target.value }))} className="mt-1" rows={2} dir="rtl" />
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
            <Button onClick={handleSave} disabled={saving || uploadingFile || fetchingFresh}>
              {(saving || uploadingFile || fetchingFresh) && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
              {fetchingFresh ? (isRTL ? 'جاري التحميل...' : 'Loading...') : uploadingFile ? (isRTL ? 'جاري الرفع...' : 'Uploading...') : (isRTL ? 'حفظ' : 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment Preview Dialog - shows after PDF upload */}
      <AssignmentPreviewDialog
        open={assignmentPreviewOpen}
        imageUrl={assignmentPreviewImage}
        sessionNumber={session?.session_number ?? 0}
        onConfirm={handleAssignmentConfirm}
        onSkip={handleAssignmentSkip}
        extracting={assignmentExtracting}
      />
    </>
  );
}
