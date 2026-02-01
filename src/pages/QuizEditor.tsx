import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SimplifiedQuestionEditor } from '@/components/quiz/SimplifiedQuestionEditor';
import { ExcelImporter } from '@/components/quiz/ExcelImporter';
import { StudentPreviewDialog } from '@/components/quiz/StudentPreviewDialog';
import { ImportFromQuizzesDialog } from '@/components/quiz/ImportFromQuizzesDialog';

interface SimplifiedQuestion {
  id?: string;
  question_text: string;
  question_text_ar: string;
  options: string[];
  correct_answer: string;
  points: number;
  order_index: number;
  image_url?: string;
}

interface Quiz {
  id: string;
  title: string;
  title_ar: string;
}

export default function QuizEditor() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<SimplifiedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (quizId) fetchData();
  }, [quizId]);

  const fetchData = async () => {
    try {
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('id, title, title_ar')
        .eq('id', quizId)
        .single();

      if (quizError) throw quizError;
      setQuiz(quizData);

      const { data: questionsData, error: questionsError } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_index');

      if (questionsError) throw questionsError;
      
      // Convert old format to simplified format
      const formattedQuestions: SimplifiedQuestion[] = (questionsData || []).map(q => {
        const oldOptions = typeof q.options === 'object' ? q.options as { en?: string[]; ar?: string[] } : null;
        
        // Merge old format options or use empty array
        let options: string[] = ['', '', '', ''];
        if (oldOptions) {
          // Prefer English options, fallback to Arabic
          options = oldOptions.en?.length ? oldOptions.en : (oldOptions.ar || options);
        }
        
        return {
          id: q.id,
          question_text: q.question_text || q.question_text_ar || '',
          question_text_ar: q.question_text_ar || q.question_text || '',
          options,
          correct_answer: q.correct_answer,
          points: q.points,
          order_index: q.order_index,
          image_url: (q as any).image_url,
        };
      });
      
      setQuestions(formattedQuestions);
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

  const handleSave = async () => {
    if (!quizId || saving) return;
    setSaving(true);

    try {
      // Delete existing questions
      await supabase.from('quiz_questions').delete().eq('quiz_id', quizId);

      // Insert new questions
      if (questions.length > 0) {
        const questionsToInsert = questions.map((q, idx) => ({
          quiz_id: quizId,
          question_text: q.question_text,
          question_text_ar: q.question_text_ar || q.question_text,
          // Store in new simplified format but maintain backward compatibility
          options: { 
            en: q.options, 
            ar: q.options // Same for both since we're using simplified single-field
          },
          correct_answer: q.correct_answer,
          points: q.points,
          order_index: idx,
          question_type: 'multiple_choice',
          image_url: q.image_url || null,
        }));

        const { error } = await supabase.from('quiz_questions').insert(questionsToInsert);
        if (error) throw error;
      }

      toast({
        title: t.common.success,
        description: isRTL ? 'تم حفظ الأسئلة بنجاح' : 'Questions saved successfully',
      });
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
          <Button variant="ghost" onClick={() => navigate('/quizzes')}>
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
            <Button className="kojo-gradient" onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? t.common.loading : t.common.save}
            </Button>
          </div>
        </div>

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
    </DashboardLayout>
  );
}
