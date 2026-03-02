import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Loader2, BookOpen, Video, Film, HelpCircle, Upload, X, FileIcon, Pencil,
  RotateCcw, Unlink, Sparkles, FileText, CheckCircle2, AlertTriangle,
  ArrowLeft, ChevronDown, Save, Lock, Unlock,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { extractLastPageAsImage } from '@/lib/pdfLastPage';
import { AssignmentPreviewDialog } from '@/components/curriculum/AssignmentPreviewDialog';

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
  is_published: boolean | null;
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

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function CurriculumSessionEdit() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();

  // Fetch session data
  const { data: session, isLoading } = useQuery({
    queryKey: ['curriculum-session', sessionId],
    queryFn: async () => {
      if (!sessionId) throw new Error('No session ID');
      const { data, error } = await supabase
        .from('curriculum_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      if (error) throw error;

      // Fetch asset data
      const { data: asset } = await supabase
        .from('curriculum_session_assets')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      const merged: CurriculumSession = {
        ...data,
        student_pdf_path: asset?.student_pdf_path ?? data.student_pdf_path,
        student_pdf_filename: asset?.student_pdf_filename ?? data.student_pdf_filename,
        student_pdf_size: asset?.student_pdf_size ?? data.student_pdf_size,
        student_pdf_text: asset?.student_pdf_text ?? data.student_pdf_text,
        student_pdf_text_updated_at: asset?.student_pdf_text_updated_at ?? data.student_pdf_text_updated_at,
      };
      return merged;
    },
    enabled: !!sessionId,
  });

  // Fetch level + age group names for breadcrumb
  const { data: levelData } = useQuery({
    queryKey: ['level-name', session?.level_id],
    queryFn: async () => {
      const { data } = await supabase.from('levels').select('name, name_ar').eq('id', session!.level_id).single();
      return data;
    },
    enabled: !!session?.level_id,
  });

  const { data: ageGroupData } = useQuery({
    queryKey: ['age-group-name', session?.age_group_id],
    queryFn: async () => {
      const { data } = await supabase.from('age_groups').select('name, name_ar').eq('id', session!.age_group_id).single();
      return data;
    },
    enabled: !!session?.age_group_id,
  });

  if (isLoading || !session) {
    return (
      <DashboardLayout title={isRTL ? 'تعديل السيشن' : 'Edit Session'}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const levelName = isRTL ? levelData?.name_ar : levelData?.name;
  const ageGroupName = isRTL ? ageGroupData?.name_ar : ageGroupData?.name;

  return (
    <DashboardLayout title={isRTL ? `تعديل السيشن ${session.session_number}` : `Edit Session ${session.session_number}`}>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/curriculum')}>
              <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1 rtl:rotate-180" />
              {isRTL ? 'رجوع للمنهج' : 'Back to Curriculum'}
            </Button>
            <div>
              <h2 className="text-lg font-semibold">
                {isRTL ? `السيشن ${session.session_number}` : `Session ${session.session_number}`}
                {levelName && <span className="text-muted-foreground font-normal"> — {levelName}</span>}
              </h2>
              {ageGroupName && <p className="text-xs text-muted-foreground">{ageGroupName}</p>}
            </div>
          </div>
          {session.is_published ? (
            <Badge className="bg-primary/10 text-primary border-primary/20">
              <Lock className="h-3 w-3 ltr:mr-1 rtl:ml-1" />{isRTL ? 'منشور' : 'Published'}
            </Badge>
          ) : (
            <Badge variant="secondary">
              <Unlock className="h-3 w-3 ltr:mr-1 rtl:ml-1" />{isRTL ? 'مسودة' : 'Draft'}
            </Badge>
          )}
        </div>

        {/* Basic Info Section */}
        <BasicInfoCard session={session} isRTL={isRTL} />

        {/* Materials Section */}
        <MaterialsCard session={session} isRTL={isRTL} />

        {/* Quiz Section */}
        <QuizCard session={session} isRTL={isRTL} />

        {/* Assignment Section */}
        <AssignmentCard session={session} isRTL={isRTL} />
      </div>
    </DashboardLayout>
  );
}

// ==================== BASIC INFO CARD ====================

function BasicInfoCard({ session, isRTL }: { session: CurriculumSession; isRTL: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(session.title);
  const [titleAr, setTitleAr] = useState(session.title_ar);
  const [description, setDescription] = useState(session.description || '');
  const [descriptionAr, setDescriptionAr] = useState(session.description_ar || '');
  const [updatedAt, setUpdatedAt] = useState(session.updated_at);

  // Sync when session refetches
  useEffect(() => {
    setTitle(session.title);
    setTitleAr(session.title_ar);
    setDescription(session.description || '');
    setDescriptionAr(session.description_ar || '');
    setUpdatedAt(session.updated_at);
  }, [session.id, session.updated_at]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('update_curriculum_session', {
        p_id: session.id,
        p_expected_updated_at: updatedAt,
        p_data: { title, title_ar: titleAr, description: description || null, description_ar: descriptionAr || null },
      });
      if (error) throw error;
      const result = data as any;
      if (result?.updated === false && result?.reason === 'conflict') {
        toast.error(isRTL ? 'تم تعديل السيشن من مستخدم آخر. حدّث الصفحة.' : 'Modified by another user. Please refresh.');
      } else {
        if (result?.new_updated_at) setUpdatedAt(result.new_updated_at);
        toast.success(isRTL ? 'تم حفظ البيانات الأساسية' : 'Basic info saved');
        queryClient.invalidateQueries({ queryKey: ['curriculum-session', session.id] });
        queryClient.invalidateQueries({ queryKey: ['curriculum-sessions'] });
        queryClient.invalidateQueries({ queryKey: ['curriculum-overview'] });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setOpen(!open)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {isRTL ? 'البيانات الأساسية' : 'Basic Info'}
            </CardTitle>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{isRTL ? 'العنوان (إنجليزي)' : 'Title (English)'}</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>{isRTL ? 'العنوان (عربي)' : 'Title (Arabic)'}</Label>
                <Input value={titleAr} onChange={e => setTitleAr(e.target.value)} className="mt-1" dir="rtl" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{isRTL ? 'الوصف (إنجليزي)' : 'Description (English)'}</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} className="mt-1" rows={3} />
              </div>
              <div>
                <Label>{isRTL ? 'الوصف (عربي)' : 'Description (Arabic)'}</Label>
                <Textarea value={descriptionAr} onChange={e => setDescriptionAr(e.target.value)} className="mt-1" rows={3} dir="rtl" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" /> : <Save className="h-4 w-4 ltr:mr-2 rtl:ml-2" />}
                {isRTL ? 'حفظ' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ==================== MATERIALS CARD ====================

function MaterialsCard({ session, isRTL }: { session: CurriculumSession; isRTL: boolean }) {
  const queryClient = useQueryClient();
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(session.updated_at);

  const [slidesUrl, setSlidesUrl] = useState(session.slides_url || '');
  const [summaryVideoUrl, setSummaryVideoUrl] = useState(session.summary_video_url || '');
  const [fullVideoUrl, setFullVideoUrl] = useState(session.full_video_url || '');

  const [pdfPath, setPdfPath] = useState(session.student_pdf_path);
  const [pdfFilename, setPdfFilename] = useState(session.student_pdf_filename);
  const [pdfSize, setPdfSize] = useState(session.student_pdf_size);
  const [pdfText, setPdfText] = useState(session.student_pdf_text);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [extractingText, setExtractingText] = useState(false);

  // Assignment preview state
  const [assignmentPreviewOpen, setAssignmentPreviewOpen] = useState(false);
  const [assignmentPreviewImage, setAssignmentPreviewImage] = useState<string | null>(null);
  const [assignmentPreviewBlob, setAssignmentPreviewBlob] = useState<Blob | null>(null);
  const [assignmentExtracting, setAssignmentExtracting] = useState(false);

  useEffect(() => {
    setSlidesUrl(session.slides_url || '');
    setSummaryVideoUrl(session.summary_video_url || '');
    setFullVideoUrl(session.full_video_url || '');
    setPdfPath(session.student_pdf_path);
    setPdfFilename(session.student_pdf_filename);
    setPdfSize(session.student_pdf_size);
    setPdfText(session.student_pdf_text);
    setUpdatedAt(session.updated_at);
  }, [session.id, session.updated_at]);

  const handleSaveUrls = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('update_curriculum_session', {
        p_id: session.id,
        p_expected_updated_at: updatedAt,
        p_data: {
          slides_url: slidesUrl || null,
          summary_video_url: summaryVideoUrl || null,
          full_video_url: fullVideoUrl || null,
        },
      });
      if (error) throw error;
      const result = data as any;
      if (result?.updated === false && result?.reason === 'conflict') {
        toast.error(isRTL ? 'تم تعديل السيشن من مستخدم آخر.' : 'Modified by another user.');
      } else {
        if (result?.new_updated_at) setUpdatedAt(result.new_updated_at);
        toast.success(isRTL ? 'تم حفظ المواد' : 'Materials saved');
        queryClient.invalidateQueries({ queryKey: ['curriculum-session', session.id] });
        queryClient.invalidateQueries({ queryKey: ['curriculum-sessions'] });
        queryClient.invalidateQueries({ queryKey: ['curriculum-overview'] });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePdfUpload = async (file: File) => {
    setUploadingPdf(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${session.age_group_id}/${session.level_id}/${session.session_number}/${Date.now()}.${ext}`;

      if (pdfPath) {
        await supabase.storage.from('session-slides-pdf').remove([pdfPath]);
      }

      const { error: uploadError } = await supabase.storage.from('session-slides-pdf').upload(fileName, file);
      if (uploadError) throw uploadError;

      setPdfPath(fileName);
      setPdfFilename(file.name);
      setPdfSize(file.size);
      toast.success(isRTL ? 'تم رفع الملف بنجاح' : 'PDF uploaded successfully');

      // Save PDF metadata
      setExtractingText(true);
      try {
        await supabase.rpc('upsert_session_asset', {
          p_session_id: session.id,
          p_student_pdf_path: fileName,
          p_student_pdf_filename: file.name,
          p_student_pdf_size: file.size,
        });
        const { data: extractResult } = await supabase.functions.invoke('extract-pdf-text', {
          body: { sessionId: session.id },
        });
        if (extractResult?.extracted) {
          setPdfText('extracted');
          toast.success(isRTL ? 'تم استخراج النص من PDF' : 'PDF text extracted');
        }
      } catch (err: any) {
        console.error('Extract error:', err);
        toast.error(isRTL ? 'فشل في استخراج النص.' : 'Failed to extract text.');
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
      }

      queryClient.invalidateQueries({ queryKey: ['curriculum-session', session.id] });
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'فشل في رفع الملف' : 'Failed to upload PDF'));
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleDeletePdf = async () => {
    if (!pdfPath) return;
    try {
      await supabase.storage.from('session-slides-pdf').remove([pdfPath]);
      await supabase.from('curriculum_session_assets').delete().eq('session_id', session.id);
      setPdfPath(null);
      setPdfFilename(null);
      setPdfSize(null);
      setPdfText(null);
      toast.success(isRTL ? 'تم حذف الملف' : 'PDF deleted');
      queryClient.invalidateQueries({ queryKey: ['curriculum-session', session.id] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAssignmentConfirm = async () => {
    if (!assignmentPreviewBlob) return;
    setAssignmentExtracting(true);
    try {
      const attachmentFileName = `assignments/${session.age_group_id}/${session.level_id}/${session.session_number}/assignment_slide_${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage.from('curriculum').upload(attachmentFileName, assignmentPreviewBlob, { contentType: 'image/png' });
      if (uploadError) throw uploadError;

      const arrayBuffer = await assignmentPreviewBlob.arrayBuffer();
      const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));

      const { data: aiResult, error: aiError } = await supabase.functions.invoke('extract-assignment-slide', {
        body: { image_base64: base64, session_number: session.session_number },
      });

      // Save assignment data via RPC
      const assignmentData: Record<string, any> = {
        assignment_attachment_url: attachmentFileName,
        assignment_attachment_type: 'image/png',
      };

      if (!aiError && aiResult?.assignment) {
        const a = aiResult.assignment;
        assignmentData.assignment_title = a.title_en || `Assignment ${session.session_number}`;
        assignmentData.assignment_title_ar = a.title_ar || `واجب ${session.session_number}`;
        assignmentData.assignment_description = a.description_en || null;
        assignmentData.assignment_description_ar = a.description_ar || null;
        toast.success(isRTL ? 'تم استخراج بيانات الواجب!' : 'Assignment details extracted!');
      } else {
        assignmentData.assignment_title = `Assignment ${session.session_number}`;
        assignmentData.assignment_title_ar = `واجب ${session.session_number}`;
        toast.warning(isRTL ? 'تم حفظ الصورة. فشل استخراج النص.' : 'Image saved. Text extraction failed.');
      }

      // Save to DB immediately
      const { data, error } = await supabase.rpc('update_curriculum_session', {
        p_id: session.id,
        p_expected_updated_at: updatedAt,
        p_data: assignmentData,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.new_updated_at) setUpdatedAt(result.new_updated_at);

      queryClient.invalidateQueries({ queryKey: ['curriculum-session', session.id] });
      setAssignmentPreviewOpen(false);
    } catch (err: any) {
      toast.error(err.message || (isRTL ? 'فشل في معالجة الواجب' : 'Failed to process assignment'));
    } finally {
      setAssignmentExtracting(false);
    }
  };

  const handleAssignmentSkip = () => {
    setAssignmentPreviewOpen(false);
    if (assignmentPreviewImage) URL.revokeObjectURL(assignmentPreviewImage);
    setAssignmentPreviewImage(null);
    setAssignmentPreviewBlob(null);
  };

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => setOpen(!open)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {isRTL ? 'المواد (PDF + فيديوهات)' : 'Materials (PDF + Videos)'}
              </CardTitle>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              {/* Student PDF */}
              <div>
                <Label className="flex items-center gap-1.5"><FileText className="h-4 w-4" />{isRTL ? 'ملف PDF للطالب' : 'Student PDF'}</Label>
                {pdfPath ? (
                  <div className="mt-1 space-y-2">
                    <div className="flex items-center gap-2 p-2.5 border rounded-md bg-muted/30">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{pdfFilename || pdfPath.split('/').pop()}</p>
                        {pdfSize && <p className="text-xs text-muted-foreground">{formatFileSize(pdfSize)}</p>}
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleDeletePdf}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    {extractingText ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />{isRTL ? 'جاري استخراج النص...' : 'Extracting text...'}
                      </div>
                    ) : pdfText ? (
                      <div className="flex items-center gap-2 text-xs text-primary">
                        <CheckCircle2 className="h-3 w-3" />{isRTL ? 'تم استخراج النص' : 'Text extracted'}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-amber-600">
                        <AlertTriangle className="h-3 w-3" />{isRTL ? 'لم يتم استخراج النص بعد' : 'Text not yet extracted'}
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
                <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) handlePdfUpload(file); e.target.value = ''; }} />
              </div>

              {/* URLs */}
              <div>
                <Label className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" />{isRTL ? 'رابط السلايدز (للأدمن)' : 'Slides URL (Admin)'}</Label>
                <Input value={slidesUrl} onChange={e => setSlidesUrl(e.target.value)} placeholder="https://docs.google.com/..." className="mt-1" />
              </div>
              <div>
                <Label className="flex items-center gap-1.5"><Video className="h-4 w-4" />{isRTL ? 'فيديو ملخص' : 'Summary Video URL'}</Label>
                <Input value={summaryVideoUrl} onChange={e => setSummaryVideoUrl(e.target.value)} placeholder="https://..." className="mt-1" />
              </div>
              <div>
                <Label className="flex items-center gap-1.5"><Film className="h-4 w-4" />{isRTL ? 'فيديو كامل' : 'Full Video URL'}</Label>
                <Input value={fullVideoUrl} onChange={e => setFullVideoUrl(e.target.value)} placeholder="https://..." className="mt-1" />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveUrls} disabled={saving} size="sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" /> : <Save className="h-4 w-4 ltr:mr-2 rtl:ml-2" />}
                  {isRTL ? 'حفظ الروابط' : 'Save URLs'}
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <AssignmentPreviewDialog
        open={assignmentPreviewOpen}
        imageUrl={assignmentPreviewImage}
        sessionNumber={session.session_number}
        onConfirm={handleAssignmentConfirm}
        onSkip={handleAssignmentSkip}
        extracting={assignmentExtracting}
      />
    </>
  );
}

// ==================== QUIZ CARD ====================

function QuizCard({ session, isRTL }: { session: CurriculumSession; isRTL: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);
  const [creatingQuiz, setCreatingQuiz] = useState(false);
  const [creatingAiQuiz, setCreatingAiQuiz] = useState(false);
  const [unassigning, setUnassigning] = useState(false);

  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizTitleAr, setQuizTitleAr] = useState('');
  const [quizDuration, setQuizDuration] = useState(15);
  const [quizPassingScore, setQuizPassingScore] = useState(60);
  const [savingQuiz, setSavingQuiz] = useState(false);

  useEffect(() => {
    if (!session.quiz_id) { setQuizData(null); return; }
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
      } catch (err) { console.error(err); }
      finally { setQuizLoading(false); }
    };
    fetchQuiz();
  }, [session.quiz_id]);

  const handleCreateQuiz = async () => {
    if (creatingQuiz) return;
    setCreatingQuiz(true);
    try {
      const { data, error } = await supabase.rpc('create_curriculum_quiz', { p_session_id: session.id });
      if (error) throw error;
      const quizId = (data as any)?.quiz_id;
      if (!quizId) throw new Error('No quiz_id returned');
      toast.success(isRTL ? 'تم إنشاء الكويز' : 'Quiz created');
      queryClient.invalidateQueries({ queryKey: ['curriculum-session', session.id] });
      queryClient.invalidateQueries({ queryKey: ['curriculum-sessions'] });
      navigate(`/quiz-editor/${quizId}?origin=curriculum&sessionId=${session.id}&ageGroupId=${session.age_group_id}&levelId=${session.level_id}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingQuiz(false);
    }
  };

  const handleCreateAiQuiz = async () => {
    if (creatingAiQuiz) return;
    setCreatingAiQuiz(true);
    try {
      const { data, error } = await supabase.rpc('create_curriculum_quiz', { p_session_id: session.id });
      if (error) throw error;
      const quizId = (data as any)?.quiz_id;
      if (!quizId) throw new Error('No quiz_id returned');
      toast.success(isRTL ? 'تم إنشاء الكويز. جاري فتح المحرر...' : 'Quiz created. Opening editor...');
      queryClient.invalidateQueries({ queryKey: ['curriculum-session', session.id] });
      queryClient.invalidateQueries({ queryKey: ['curriculum-sessions'] });
      navigate(`/quiz-editor/${quizId}?origin=curriculum&sessionId=${session.id}&ageGroupId=${session.age_group_id}&levelId=${session.level_id}&openAi=true`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingAiQuiz(false);
    }
  };

  const handleUnassignQuiz = async () => {
    if (!session.quiz_id || unassigning) return;
    setUnassigning(true);
    try {
      const { data, error } = await supabase.rpc('unassign_curriculum_quiz', {
        p_session_id: session.id,
        p_expected_quiz_id: session.quiz_id,
      });
      if (error) throw error;
      if ((data as any)?.unassigned) {
        setQuizData(null);
        toast.success(isRTL ? 'تم إلغاء ربط الكويز' : 'Quiz unlinked');
        queryClient.invalidateQueries({ queryKey: ['curriculum-session', session.id] });
        queryClient.invalidateQueries({ queryKey: ['curriculum-sessions'] });
      } else {
        toast.error(isRTL ? 'تعارض - حدّث الصفحة' : 'Conflict - please refresh');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUnassigning(false);
    }
  };

  const handleSaveQuizSettings = async () => {
    if (!quizData) return;
    setSavingQuiz(true);
    try {
      const updates: Record<string, any> = {};
      if (quizTitle !== quizData.title) updates.title = quizTitle;
      if (quizTitleAr !== quizData.title_ar) updates.title_ar = quizTitleAr;
      if (quizDuration !== quizData.duration_minutes) updates.duration_minutes = quizDuration;
      if (quizPassingScore !== quizData.passing_score) updates.passing_score = quizPassingScore;
      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        const { error } = await supabase.from('quizzes').update(updates).eq('id', quizData.id);
        if (error) throw error;
        setQuizData(prev => prev ? { ...prev, ...updates } : null);
        toast.success(isRTL ? 'تم حفظ إعدادات الكويز' : 'Quiz settings saved');
      } else {
        toast.info(isRTL ? 'لا توجد تغييرات' : 'No changes to save');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingQuiz(false);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setOpen(!open)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              {isRTL ? 'الكويز' : 'Quiz'}
              {session.quiz_id && <Badge variant="secondary" className="text-xs">{isRTL ? 'مربوط' : 'Linked'}</Badge>}
            </CardTitle>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {!session.quiz_id ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <HelpCircle className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground mb-4">{isRTL ? 'لا يوجد كويز مربوط' : 'No quiz linked'}</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={handleCreateQuiz} disabled={creatingQuiz} variant="outline">
                    {creatingQuiz && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
                    {isRTL ? 'إنشاء كويز فارغ' : 'Create Empty Quiz'}
                  </Button>
                  <Button onClick={handleCreateAiQuiz} disabled={creatingAiQuiz} className="gap-2">
                    {creatingAiQuiz ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {isRTL ? 'إنشاء بالذكاء الاصطناعي' : 'Create with AI'}
                  </Button>
                </div>
              </div>
            ) : quizLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : quizData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>{isRTL ? 'اسم الكويز (EN)' : 'Quiz Title (EN)'}</Label>
                    <div className="flex gap-1 mt-1">
                      <Input value={quizTitle} onChange={e => setQuizTitle(e.target.value)} className="flex-1" />
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => { setQuizTitle(`Quiz - Session ${session.session_number}`); setQuizTitleAr(`كويز - سيشن ${session.session_number}`); }}>
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>{isRTL ? 'اسم الكويز (AR)' : 'Quiz Title (AR)'}</Label>
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
                    <div className="mt-1 h-10 flex items-center px-3 rounded-md border bg-muted/30 text-sm font-medium">{quizData.questions_count}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/quiz-editor/${quizData.id}?origin=curriculum&sessionId=${session.id}&ageGroupId=${session.age_group_id}&levelId=${session.level_id}`)}>
                    <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{isRTL ? 'تعديل الأسئلة' : 'Edit Questions'}
                  </Button>
                  <Button onClick={handleSaveQuizSettings} disabled={savingQuiz} size="sm">
                    {savingQuiz ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" /> : <Save className="h-4 w-4 ltr:mr-2 rtl:ml-2" />}
                    {isRTL ? 'حفظ الإعدادات' : 'Save Settings'}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                        <Unlink className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{isRTL ? 'إلغاء الربط' : 'Unlink'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{isRTL ? 'إلغاء ربط الكويز' : 'Unlink Quiz'}</AlertDialogTitle>
                        <AlertDialogDescription>{isRTL ? 'سيتم فك الكويز من السيشن. الكويز لن يُحذف.' : 'The quiz will be unlinked. It will not be deleted.'}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleUnassignQuiz} disabled={unassigning} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          {unassigning && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
                          {isRTL ? 'تأكيد' : 'Confirm'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ) : null}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ==================== ASSIGNMENT CARD ====================

function AssignmentCard({ session, isRTL }: { session: CurriculumSession; isRTL: boolean }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(session.updated_at);

  const [assignmentTitle, setAssignmentTitle] = useState(session.assignment_title || '');
  const [assignmentTitleAr, setAssignmentTitleAr] = useState(session.assignment_title_ar || '');
  const [assignmentDescription, setAssignmentDescription] = useState(session.assignment_description || '');
  const [assignmentDescriptionAr, setAssignmentDescriptionAr] = useState(session.assignment_description_ar || '');
  const [attachmentUrl, setAttachmentUrl] = useState(session.assignment_attachment_url);
  const [attachmentType, setAttachmentType] = useState(session.assignment_attachment_type);
  const [maxScore, setMaxScore] = useState(session.assignment_max_score ?? 100);
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);

  useEffect(() => {
    setAssignmentTitle(session.assignment_title || '');
    setAssignmentTitleAr(session.assignment_title_ar || '');
    setAssignmentDescription(session.assignment_description || '');
    setAssignmentDescriptionAr(session.assignment_description_ar || '');
    setAttachmentUrl(session.assignment_attachment_url);
    setAttachmentType(session.assignment_attachment_type);
    setMaxScore(session.assignment_max_score ?? 100);
    setUpdatedAt(session.updated_at);
  }, [session.id, session.updated_at]);

  const handleSave = async () => {
    setSaving(true);

    let finalAttachmentUrl = attachmentUrl;
    let finalAttachmentType = attachmentType;

    if (assignmentFile) {
      setUploadingFile(true);
      try {
        const ext = assignmentFile.name.split('.').pop();
        const fileName = `assignments/${session.age_group_id}/${session.level_id}/${session.session_number}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('curriculum').upload(fileName, assignmentFile);
        if (uploadError) throw uploadError;
        finalAttachmentUrl = fileName;
        finalAttachmentType = assignmentFile.type;
      } catch (err: any) {
        toast.error(err.message);
        setSaving(false);
        setUploadingFile(false);
        return;
      }
      setUploadingFile(false);
    }

    try {
      const { data, error } = await supabase.rpc('update_curriculum_session', {
        p_id: session.id,
        p_expected_updated_at: updatedAt,
        p_data: {
          assignment_title: assignmentTitle || (assignmentDescription || finalAttachmentUrl ? `Assignment ${session.session_number}` : null),
          assignment_title_ar: assignmentTitleAr || (assignmentDescription || finalAttachmentUrl ? `واجب ${session.session_number}` : null),
          assignment_description: assignmentDescription || null,
          assignment_description_ar: assignmentDescriptionAr || null,
          assignment_attachment_url: finalAttachmentUrl || null,
          assignment_attachment_type: finalAttachmentType || null,
          assignment_max_score: maxScore,
        },
      });
      if (error) throw error;
      const result = data as any;
      if (result?.updated === false && result?.reason === 'conflict') {
        toast.error(isRTL ? 'تم تعديل السيشن من مستخدم آخر.' : 'Modified by another user.');
      } else {
        if (result?.new_updated_at) setUpdatedAt(result.new_updated_at);
        setAssignmentFile(null);
        setAttachmentUrl(finalAttachmentUrl);
        setAttachmentType(finalAttachmentType);
        toast.success(isRTL ? 'تم حفظ الواجب' : 'Assignment saved');
        queryClient.invalidateQueries({ queryKey: ['curriculum-session', session.id] });
        queryClient.invalidateQueries({ queryKey: ['curriculum-sessions'] });
        queryClient.invalidateQueries({ queryKey: ['curriculum-overview'] });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setOpen(!open)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileIcon className="h-4 w-4" />
              {isRTL ? 'الواجب' : 'Assignment'}
              {session.assignment_title && <Badge variant="secondary" className="text-xs">{isRTL ? 'موجود' : 'Set'}</Badge>}
            </CardTitle>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{isRTL ? 'عنوان الواجب (EN)' : 'Assignment Title (EN)'}</Label>
                <Input value={assignmentTitle} onChange={e => setAssignmentTitle(e.target.value)} placeholder={`Assignment ${session.session_number}`} className="mt-1" />
              </div>
              <div>
                <Label>{isRTL ? 'عنوان الواجب (AR)' : 'Assignment Title (AR)'}</Label>
                <Input value={assignmentTitleAr} onChange={e => setAssignmentTitleAr(e.target.value)} placeholder={`واجب ${session.session_number}`} className="mt-1" dir="rtl" />
              </div>
            </div>
            <div>
              <Label>{isRTL ? 'وصف الواجب (EN)' : 'Description (EN)'}</Label>
              <Textarea value={assignmentDescription} onChange={e => setAssignmentDescription(e.target.value)} className="mt-1" rows={2} />
            </div>
            <div>
              <Label>{isRTL ? 'وصف الواجب (AR)' : 'Description (AR)'}</Label>
              <Textarea value={assignmentDescriptionAr} onChange={e => setAssignmentDescriptionAr(e.target.value)} className="mt-1" rows={2} dir="rtl" />
            </div>

            <div>
              <Label className="flex items-center gap-1.5"><Upload className="h-4 w-4" />{isRTL ? 'ملف مرفق' : 'Attachment'}</Label>
              {attachmentUrl && !assignmentFile ? (
                <div className="flex items-center gap-2 mt-1 p-2 border rounded-md bg-muted/30">
                  <FileIcon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm truncate flex-1">{attachmentUrl.split('/').pop()}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setAttachmentUrl(null); setAttachmentType(null); }}>
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
              <Input type="number" value={maxScore} onChange={e => setMaxScore(Number(e.target.value))} className="mt-1" />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving || uploadingFile} size="sm">
                {(saving || uploadingFile) ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" /> : <Save className="h-4 w-4 ltr:mr-2 rtl:ml-2" />}
                {uploadingFile ? (isRTL ? 'جاري الرفع...' : 'Uploading...') : (isRTL ? 'حفظ الواجب' : 'Save Assignment')}
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
