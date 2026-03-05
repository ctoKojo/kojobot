import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Save, Link, Unlink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface AgeGroup {
  id: string;
  name: string;
  name_ar: string;
}

interface Quiz {
  id: string;
  title: string;
  title_ar: string;
}

interface Level {
  id: string;
  name: string;
  name_ar: string;
  level_order: number;
}

interface QuizQuestion {
  id: string;
  question_text: string;
  question_text_ar: string;
  order_index: number;
}

interface PlacementConfig {
  id: string;
  age_group_id: string;
  quiz_id: string;
  pass_threshold: number;
}

interface QuestionLevelMapping {
  question_id: string;
  level_id: string;
}

export default function PlacementTestSettings() {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>('');
  const [config, setConfig] = useState<PlacementConfig | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<string>('');
  const [passThreshold, setPassThreshold] = useState<number>(60);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [questionLevels, setQuestionLevels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedAgeGroup) fetchConfig();
  }, [selectedAgeGroup]);

  useEffect(() => {
    if (selectedQuiz) fetchQuestions();
  }, [selectedQuiz]);

  const fetchInitialData = async () => {
    try {
      const [agRes, quizRes, levelRes] = await Promise.all([
        supabase.from('age_groups').select('id, name, name_ar').eq('is_active', true).order('min_age'),
        supabase.from('quizzes').select('id, title, title_ar').order('title'),
        supabase.from('levels').select('id, name, name_ar, level_order').eq('is_active', true).order('level_order'),
      ]);
      setAgeGroups(agRes.data || []);
      setQuizzes(quizRes.data || []);
      setLevels(levelRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('placement_quiz_config')
      .select('*')
      .eq('age_group_id', selectedAgeGroup)
      .maybeSingle();

    if (data) {
      setConfig(data);
      setSelectedQuiz(data.quiz_id);
      setPassThreshold(Number(data.pass_threshold));
    } else {
      setConfig(null);
      setSelectedQuiz('');
      setPassThreshold(60);
      setQuestions([]);
      setQuestionLevels({});
    }
  };

  const fetchQuestions = async () => {
    const { data: qData } = await supabase
      .from('quiz_questions')
      .select('id, question_text, question_text_ar, order_index')
      .eq('quiz_id', selectedQuiz)
      .order('order_index');

    setQuestions(qData || []);

    if (qData && qData.length > 0) {
      const { data: mappings } = await supabase
        .from('placement_question_levels')
        .select('question_id, level_id')
        .in('question_id', qData.map(q => q.id));

      const map: Record<string, string> = {};
      (mappings || []).forEach(m => { map[m.question_id] = m.level_id; });
      setQuestionLevels(map);
    } else {
      setQuestionLevels({});
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedAgeGroup || !selectedQuiz) return;
    setSaving(true);
    try {
      if (config) {
        await supabase.from('placement_quiz_config')
          .update({ quiz_id: selectedQuiz, pass_threshold: passThreshold })
          .eq('id', config.id);
      } else {
        await supabase.from('placement_quiz_config')
          .insert({ age_group_id: selectedAgeGroup, quiz_id: selectedQuiz, pass_threshold: passThreshold });
      }
      toast({ title: isRTL ? 'تم الحفظ' : 'Saved successfully' });
      fetchConfig();
    } catch (err) {
      toast({ title: isRTL ? 'خطأ' : 'Error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleQuestionLevelChange = async (questionId: string, levelId: string) => {
    setQuestionLevels(prev => ({ ...prev, [questionId]: levelId }));

    // Upsert
    if (questionLevels[questionId]) {
      // Update existing
      await supabase.from('placement_question_levels')
        .update({ level_id: levelId })
        .eq('question_id', questionId);
    } else {
      // Insert new
      await supabase.from('placement_question_levels')
        .insert({ question_id: questionId, level_id: levelId });
    }
  };

  const handleRemoveQuestionLevel = async (questionId: string) => {
    await supabase.from('placement_question_levels').delete().eq('question_id', questionId);
    setQuestionLevels(prev => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  };

  if (loading) {
    return (
      <DashboardLayout title={isRTL ? 'إعدادات تحديد المستوى' : 'Placement Test Settings'}>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={isRTL ? 'إعدادات تحديد المستوى' : 'Placement Test Settings'}>
      <div className="space-y-6">
        {/* Age Group Selection + Config */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {isRTL ? 'إعداد كويز تحديد المستوى' : 'Placement Quiz Configuration'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'اختر الفئة العمرية ثم اربط كويز تحديد المستوى بها' : 'Select an age group and link a placement quiz to it'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{isRTL ? 'الفئة العمرية' : 'Age Group'}</Label>
                <Select value={selectedAgeGroup} onValueChange={setSelectedAgeGroup}>
                  <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر فئة عمرية' : 'Select age group'} /></SelectTrigger>
                  <SelectContent>
                    {ageGroups.map(ag => (
                      <SelectItem key={ag.id} value={ag.id}>{isRTL ? ag.name_ar : ag.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedAgeGroup && (
                <>
                  <div className="space-y-2">
                    <Label>{isRTL ? 'الكويز' : 'Quiz'}</Label>
                    <Select value={selectedQuiz} onValueChange={setSelectedQuiz}>
                      <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر كويز' : 'Select quiz'} /></SelectTrigger>
                      <SelectContent>
                        {quizzes.map(q => (
                          <SelectItem key={q.id} value={q.id}>{isRTL ? q.title_ar : q.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{isRTL ? 'نسبة النجاح (%)' : 'Pass Threshold (%)'}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={passThreshold}
                      onChange={e => setPassThreshold(Number(e.target.value))}
                    />
                  </div>
                </>
              )}
            </div>

            {selectedAgeGroup && selectedQuiz && (
              <Button onClick={handleSaveConfig} disabled={saving}>
                <Save className="h-4 w-4 me-2" />
                {saving ? (isRTL ? 'جارٍ الحفظ...' : 'Saving...') : (isRTL ? 'حفظ الإعدادات' : 'Save Config')}
              </Button>
            )}

            {config && (
              <Badge variant="secondary">
                {isRTL ? 'تم الإعداد' : 'Configured'} ✓
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Question-Level Mapping */}
        {selectedQuiz && questions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                {isRTL ? 'ربط الأسئلة بالمستويات' : 'Link Questions to Levels'}
              </CardTitle>
              <CardDescription>
                {isRTL ? 'حدد المستوى الذي يتبعه كل سؤال لحساب المستوى المقترح' : 'Assign each question to a level for suggested level calculation'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{isRTL ? 'السؤال' : 'Question'}</TableHead>
                    <TableHead>{isRTL ? 'المستوى' : 'Level'}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.map((q, i) => (
                    <TableRow key={q.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {isRTL ? q.question_text_ar : q.question_text}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={questionLevels[q.id] || ''}
                          onValueChange={val => handleQuestionLevelChange(q.id, val)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder={isRTL ? 'اختر مستوى' : 'Select level'} />
                          </SelectTrigger>
                          <SelectContent>
                            {levels.map(l => (
                              <SelectItem key={l.id} value={l.id}>{isRTL ? l.name_ar : l.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {questionLevels[q.id] && (
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveQuestionLevel(q.id)}>
                            <Unlink className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
