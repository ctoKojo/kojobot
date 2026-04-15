import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Sparkles, Undo2, Clock, Target, Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SimplifiedQuestionEditor } from '@/components/quiz/SimplifiedQuestionEditor';
import { ExcelImporter } from '@/components/quiz/ExcelImporter';
import { StudentPreviewDialog } from '@/components/quiz/StudentPreviewDialog';
import { ImportFromQuizzesDialog } from '@/components/quiz/ImportFromQuizzesDialog';
import { AIGenerateDialog } from '@/components/quiz/AIGenerateDialog';
import { logUpdate } from '@/lib/activityLogger';

interface SimplifiedQuestion {
  id?: string;
  question_text: string;
  question_text_ar: string;
  options: string[];
  correct_answer: string;
  points: number;
  order_index: number;
  image_url?: string;
  code_snippet?: string;
  question_type?: string;
  model_answer?: string;
  rubric?: { steps: string[]; points_per_step: number } | null;
}

interface Quiz {
  id: string;
  title: string;
  title_ar: string;
  duration_minutes: number;
  passing_score: number;
  updated_at: string;
}

export default function QuizEditor() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();

  const getBackDestination = () => {
    const state = location.state as any;
    const origin = state?.origin || searchParams.get('origin');
    return origin === 'curriculum' ? '/curriculum' : '/quizzes';
  };

  const sessionId = searchParams.get('sessionId') || '';
  const ageGroupId = searchParams.get('ageGroupId') || '';
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<SimplifiedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<SimplifiedQuestion[] | null>(null);

  // Quiz settings state
  const [duration, setDuration] = useState(30);
  const [passingScore, setPassingScore] = useState(60);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsChanged, setSettingsChanged] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('');

  // Session context for AI generation
  const [sessionHasDescription, setSessionHasDescription] = useState(false);
  const [sessionHasPdfText, setSessionHasPdfText] = useState(false);

  useEffect(() => {
    if (quizId) fetchData();
  }, [quizId]);

  useEffect(() => {
    if (searchParams.get('openAi') === 'true' && !loading && sessionId) {
      setAiDialogOpen(true);
    }
  }, [loading, searchParams, sessionId]);

  const fetchData = async () => {
    try {
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('id, title, title_ar, duration_minutes, passing_score, updated_at')
        .eq('id', quizId)
        .single();

      if (quizError) throw quizError;
      setQuiz(quizData);
      setDuration(quizData.duration_minutes);
      setPassingScore(quizData.passing_score);
      setLastUpdatedAt(quizData.updated_at);
      setSettingsChanged(false);

      const { data: questionsData, error: questionsError } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_index');

      if (questionsError) throw questionsError;
      
      const formattedQuestions: SimplifiedQuestion[] = (questionsData || []).map(q => {
        const isOpenEnded = q.question_type === 'open_ended';
        const oldOptions = typeof q.options === 'object' ? q.options as { en?: string[]; ar?: string[] } : null;
        let options: string[] = isOpenEnded ? [] : ['', '', '', ''];
        if (!isOpenEnded && oldOptions) {
          options = oldOptions.en?.length ? oldOptions.en : (oldOptions.ar || options);
        }
        
        return {
          id: q.id,
          question_text: q.question_text || q.question_text_ar || '',
          question_text_ar: q.question_text_ar || q.question_text || '',
          options,
          correct_answer: q.correct_answer || '',
          points: q.points,
          order_index: q.order_index,
          image_url: (q as any).image_url,
          code_snippet: (q as any).code_snippet || undefined,
          question_type: q.question_type || 'multiple_choice',
          model_answer: (q as any).model_answer || undefined,
          rubric: (q as any).rubric || null,
        };
      });
      
      setQuestions(formattedQuestions);

      if (sessionId) {
        const [sessionRes, assetRes] = await Promise.all([
          supabase.from('curriculum_sessions').select('description_ar').eq('id', sessionId).single(),
          supabase.from('curriculum_session_assets').select('student_pdf_text').eq('session_id', sessionId).maybeSingle(),
        ]);
        if (sessionRes.data) {
          setSessionHasDescription(!!sessionRes.data.description_ar);
        }
        setSessionHasPdfText(!!assetRes.data?.student_pdf_text);
      }
    } catch (error) {
      console.error('Error fetching quiz:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في تحميل الكويز' : 'Failed to load quiz',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImportQuestions = (importedQuestions: SimplifiedQuestion[]) => {
    setQuestions([...questions, ...importedQuestions]);
  };

  const handleAiQuestionsGenerated = (aiQuestions: any[]) => {
    setUndoSnapshot([...questions]);
    const converted: SimplifiedQuestion[] = aiQuestions.map((q, idx) => ({
      question_text: q.question_text_ar,
      question_text_ar: q.question_text_ar,
      options: q.options_ar,
      correct_answer: q.correct_index.toString(),
      points: q.points,
      order_index: questions.length + idx,
      code_snippet: q.code_snippet || undefined,
    }));
    setQuestions(prev => [...prev, ...converted]);
    toast({
      title: isRTL ? 'تمت الإضافة' : 'Added',
      description: isRTL ? `تم إضافة ${converted.length} سؤال` : `${converted.length} questions added`,
    });
  };

  const handleUndo = () => {
    if (undoSnapshot) {
      setQuestions(undoSnapshot);
      setUndoSnapshot(null);
      toast({
        title: isRTL ? 'تم التراجع' : 'Undone',
        description: isRTL ? 'تم التراجع عن آخر إضافة' : 'Last AI addition undone',
      });
    }
  };

  const handleSaveSettings = async () => {
    if (!quizId || savingSettings) return;
    setSavingSettings(true);
    try {
      // Conflict detection: check updated_at
      const { data: current } = await supabase
        .from('quizzes')
        .select('updated_at')
        .eq('id', quizId)
        .single();

      if (current && lastUpdatedAt && current.updated_at !== lastUpdatedAt) {
        toast({
          variant: 'destructive',
          title: isRTL ? 'تعارض!' : 'Conflict!',
          description: isRTL
            ? 'تم تعديل الإعدادات من مكان آخر. سيتم تحديث البيانات.'
            : 'Settings were modified elsewhere. Refreshing data.',
        });
        await fetchData();
        setSavingSettings(false);
        return;
      }

      const newUpdatedAt = new Date().toISOString();
      const { error } = await supabase
        .from('quizzes')
        .update({
          duration_minutes: duration,
          passing_score: passingScore,
          updated_at: newUpdatedAt,
        } as any)
        .eq('id', quizId);
      if (error) throw error;

      setLastUpdatedAt(newUpdatedAt);
      setSettingsChanged(false);
      toast({ title: isRTL ? 'تم حفظ الإعدادات' : 'Settings saved' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: error.message,
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveQuestions = async () => {
    if (!quizId || saving) return;
    setSaving(true);

    try {
      await supabase.from('quiz_questions').delete().eq('quiz_id', quizId);

      if (questions.length > 0) {
        const questionsToInsert = questions.map((q, idx) => ({
          quiz_id: quizId,
          question_text: q.question_text,
          question_text_ar: q.question_text_ar || q.question_text,
          options: q.question_type === 'open_ended' ? null : { 
            en: q.options, 
            ar: q.options
          },
          correct_answer: q.question_type === 'open_ended' ? null : q.correct_answer,
          points: q.points,
          order_index: idx,
          question_type: q.question_type || 'multiple_choice',
          image_url: q.image_url || null,
          code_snippet: q.code_snippet || null,
          model_answer: q.model_answer || null,
          rubric: q.rubric || null,
        }));

        const { error } = await supabase.from('quiz_questions').insert(questionsToInsert);
        if (error) throw error;
      }

      toast({
        title: t.common.success,
        description: isRTL ? 'تم حفظ الأسئلة بنجاح' : 'Questions saved successfully',
      });

      setUndoSnapshot(null);
      logUpdate('quiz', quizId, { questions_count: questions.length });
      navigate(getBackDestination());
    } catch (error) {
      console.error('Error saving questions:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في حفظ الأسئلة' : 'Failed to save questions',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDurationChange = (val: number) => {
    setDuration(val);
    setSettingsChanged(true);
  };

  const handlePassingScoreChange = (val: number) => {
    setPassingScore(val);
    setSettingsChanged(true);
  };

  if (loading) {
    return (
      <DashboardLayout title={isRTL ? 'محرر الأسئلة' : 'Question Editor'}>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{t.common.loading}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={language === 'ar' ? quiz?.title_ar : quiz?.title}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Button variant="ghost" onClick={() => navigate(getBackDestination())}>
            {isRTL ? <ArrowLeft className="w-4 h-4 mr-2 rotate-180" /> : <ArrowLeft className="w-4 h-4 mr-2" />}
            {t.common.back}
          </Button>
          
          <div className="flex items-center gap-2 flex-wrap">
            <StudentPreviewDialog questions={questions} isRTL={isRTL} />
            <ImportFromQuizzesDialog
              currentQuizId={quizId}
              existingQuestionsCount={questions.length}
              onImport={handleImportQuestions}
              isRTL={isRTL}
            />
            <ExcelImporter 
              onImport={handleImportQuestions}
              existingQuestionsCount={questions.length}
              isRTL={isRTL}
            />
            {sessionId && (
              <Button variant="outline" onClick={() => setAiDialogOpen(true)} className="gap-2">
                <Sparkles className="w-4 h-4" />
                {isRTL ? 'توليد بالذكاء الاصطناعي' : 'AI Generate'}
              </Button>
            )}
            {undoSnapshot && (
              <Button variant="outline" onClick={handleUndo} className="gap-2 text-amber-600 border-amber-300 hover:bg-amber-50">
                <Undo2 className="w-4 h-4" />
                {isRTL ? 'تراجع' : 'Undo'}
              </Button>
            )}
            <Button className="kojo-gradient" onClick={handleSaveQuestions} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? t.common.loading : (isRTL ? 'حفظ الأسئلة' : 'Save Questions')}
            </Button>
          </div>
        </div>

        {/* Quiz Settings Card */}
        <Card className="border-primary/20">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              <div className="flex items-center gap-4 flex-1 flex-wrap">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm whitespace-nowrap">{isRTL ? 'المدة (دقيقة)' : 'Duration (min)'}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={300}
                    value={duration}
                    onChange={(e) => handleDurationChange(Number(e.target.value) || 1)}
                    className="w-20 h-8"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm whitespace-nowrap">{isRTL ? 'درجة النجاح (%)' : 'Pass Score (%)'}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={passingScore}
                    onChange={(e) => handlePassingScoreChange(Number(e.target.value) || 0)}
                    className="w-20 h-8"
                  />
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveSettings}
                disabled={!settingsChanged || savingSettings}
                className="gap-2"
              >
                {savingSettings ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {isRTL ? 'حفظ الإعدادات' : 'Save Settings'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Questions Editor */}
        <SimplifiedQuestionEditor
          questions={questions}
          onChange={setQuestions}
          isRTL={isRTL}
        />

        {/* Stats */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {isRTL ? 'إجمالي الأسئلة:' : 'Total Questions:'} {questions.length}
              </span>
              <span className="text-muted-foreground">
                {isRTL ? 'إجمالي الدرجات:' : 'Total Points:'} {questions.reduce((sum, q) => sum + q.points, 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Generate Dialog */}
      {sessionId && (
        <AIGenerateDialog
          open={aiDialogOpen}
          onClose={() => setAiDialogOpen(false)}
          sessionId={sessionId}
          hasDescription={sessionHasDescription}
          hasPdfText={sessionHasPdfText}
          onQuestionsGenerated={handleAiQuestionsGenerated}
          ageGroupId={ageGroupId}
        />
      )}
    </DashboardLayout>
  );
}
