import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, GripVertical } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Question {
  id?: string;
  question_text: string;
  question_text_ar: string;
  options: { en: string[]; ar: string[] };
  correct_answer: string;
  points: number;
  order_index: number;
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
  const [questions, setQuestions] = useState<Question[]>([]);
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
      
      const formattedQuestions = (questionsData || []).map(q => ({
        ...q,
        options: typeof q.options === 'object' ? q.options as { en: string[]; ar: string[] } : { en: ['', '', '', ''], ar: ['', '', '', ''] }
      }));
      
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

  const addQuestion = () => {
    const newQuestion: Question = {
      question_text: '',
      question_text_ar: '',
      options: { en: ['', '', '', ''], ar: ['', '', '', ''] },
      correct_answer: '0',
      points: 1,
      order_index: questions.length,
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    setQuestions(updated);
  };

  const updateOption = (qIndex: number, optIndex: number, lang: 'en' | 'ar', value: string) => {
    const updated = [...questions];
    const options = { ...updated[qIndex].options };
    options[lang][optIndex] = value;
    updated[qIndex] = { ...updated[qIndex], options };
    setQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated.map((q, i) => ({ ...q, order_index: i })));
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
          question_text_ar: q.question_text_ar,
          options: q.options,
          correct_answer: q.correct_answer,
          points: q.points,
          order_index: idx,
          question_type: 'multiple_choice',
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
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/quizzes')}>
            {isRTL ? <ArrowLeft className="w-4 h-4 mr-2 rotate-180" /> : <ArrowLeft className="w-4 h-4 mr-2" />}
            {t.common.back}
          </Button>
          <Button className="kojo-gradient" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? t.common.loading : t.common.save}
          </Button>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          {questions.map((question, qIndex) => (
            <Card key={qIndex} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                    {isRTL ? `السؤال ${qIndex + 1}` : `Question ${qIndex + 1}`}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs">{isRTL ? 'درجات:' : 'Points:'}</Label>
                      <Input
                        type="number"
                        value={question.points}
                        onChange={(e) => updateQuestion(qIndex, { points: parseInt(e.target.value) || 1 })}
                        className="w-16 h-8"
                        min={1}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeQuestion(qIndex)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Question Text */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{isRTL ? 'نص السؤال (English)' : 'Question Text (English)'}</Label>
                    <Input
                      value={question.question_text}
                      onChange={(e) => updateQuestion(qIndex, { question_text: e.target.value })}
                      placeholder="Enter question in English..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? 'نص السؤال (عربي)' : 'Question Text (Arabic)'}</Label>
                    <Input
                      value={question.question_text_ar}
                      onChange={(e) => updateQuestion(qIndex, { question_text_ar: e.target.value })}
                      placeholder="أدخل نص السؤال..."
                      dir="rtl"
                    />
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-3">
                  <Label>{isRTL ? 'الخيارات (اختر الإجابة الصحيحة)' : 'Options (Select correct answer)'}</Label>
                  <RadioGroup
                    value={question.correct_answer}
                    onValueChange={(value) => updateQuestion(qIndex, { correct_answer: value })}
                  >
                    {[0, 1, 2, 3].map((optIndex) => (
                      <div key={optIndex} className="flex items-center gap-3 p-3 rounded-lg border">
                        <RadioGroupItem value={optIndex.toString()} id={`q${qIndex}-opt${optIndex}`} />
                        <div className="flex-1 grid gap-2 md:grid-cols-2">
                          <Input
                            value={question.options.en[optIndex]}
                            onChange={(e) => updateOption(qIndex, optIndex, 'en', e.target.value)}
                            placeholder={`Option ${optIndex + 1} (English)`}
                          />
                          <Input
                            value={question.options.ar[optIndex]}
                            onChange={(e) => updateOption(qIndex, optIndex, 'ar', e.target.value)}
                            placeholder={`الخيار ${optIndex + 1} (عربي)`}
                            dir="rtl"
                          />
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={addQuestion}
          >
            <Plus className="w-4 h-4 mr-2" />
            {isRTL ? 'إضافة سؤال' : 'Add Question'}
          </Button>
        </div>

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
