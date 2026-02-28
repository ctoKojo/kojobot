import { useState, useEffect } from 'react';
import { FileQuestion, Check, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  questions_count: number;
}

interface QuestionFromDB {
  id: string;
  question_text: string;
  question_text_ar: string;
  options: unknown;
  correct_answer: string;
  points: number;
  order_index: number;
  image_url: string | null;
}

interface ImportFromQuizzesDialogProps {
  currentQuizId?: string;
  existingQuestionsCount: number;
  onImport: (questions: SimplifiedQuestion[]) => void;
  isRTL: boolean;
}

export function ImportFromQuizzesDialog({
  currentQuizId,
  existingQuestionsCount,
  onImport,
  isRTL,
}: ImportFromQuizzesDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuestionFromDB[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchQuizzes();
    }
  }, [open]);

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select(`
          id,
          title,
          title_ar,
          quiz_questions(count)
        `)
        .neq('id', currentQuizId || '')
        .eq('is_active', true)
        .eq('is_auto_generated', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const quizzesWithCount = (data || []).map((q) => ({
        id: q.id,
        title: q.title,
        title_ar: q.title_ar,
        questions_count: q.quiz_questions?.[0]?.count || 0,
      }));

      setQuizzes(quizzesWithCount.filter((q) => q.questions_count > 0));
    } catch (error) {
      console.error('Error fetching quizzes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = async (quizId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_index');

      if (error) throw error;
      setQuestions(data || []);
      setSelectedQuestions(new Set());
    } catch (error) {
      console.error('Error fetching questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuizSelect = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    fetchQuestions(quiz.id);
  };

  const toggleQuestion = (questionId: string) => {
    const newSelected = new Set(selectedQuestions);
    if (newSelected.has(questionId)) {
      newSelected.delete(questionId);
    } else {
      newSelected.add(questionId);
    }
    setSelectedQuestions(newSelected);
  };

  const selectAll = () => {
    if (selectedQuestions.size === questions.length) {
      setSelectedQuestions(new Set());
    } else {
      setSelectedQuestions(new Set(questions.map((q) => q.id)));
    }
  };

  const handleImport = () => {
    const selectedQuestionsData = questions
      .filter((q) => selectedQuestions.has(q.id))
      .map((q, index) => {
        const oldOptions =
          typeof q.options === 'object' && q.options !== null ? (q.options as { en?: string[]; ar?: string[] }) : null;
        let options: string[] = ['', '', '', ''];
        if (oldOptions) {
          options = oldOptions.en?.length ? oldOptions.en : oldOptions.ar || options;
        }

        return {
          question_text: q.question_text || q.question_text_ar || '',
          question_text_ar: q.question_text_ar || q.question_text || '',
          options,
          correct_answer: q.correct_answer,
          points: q.points,
          order_index: existingQuestionsCount + index,
          image_url: q.image_url || undefined,
        };
      });

    onImport(selectedQuestionsData);
    setOpen(false);
    setSelectedQuiz(null);
    setQuestions([]);
    setSelectedQuestions(new Set());

    toast({
      title: isRTL ? 'تم الاستيراد' : 'Imported',
      description: isRTL
        ? `تم استيراد ${selectedQuestionsData.length} سؤال بنجاح`
        : `Successfully imported ${selectedQuestionsData.length} questions`,
    });
  };

  const filteredQuizzes = quizzes.filter(
    (q) =>
      q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.title_ar.includes(searchTerm)
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileQuestion className="h-4 w-4" />
          {isRTL ? 'استيراد من كويز' : 'Import from Quiz'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileQuestion className="h-5 w-5" />
            {isRTL ? 'استيراد أسئلة من كويزات سابقة' : 'Import Questions from Previous Quizzes'}
          </DialogTitle>
          <DialogDescription>
            {isRTL
              ? 'اختر كويز ثم حدد الأسئلة التي تريد استيرادها'
              : 'Select a quiz then choose questions to import'}
          </DialogDescription>
        </DialogHeader>

        {!selectedQuiz ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={isRTL ? 'بحث عن كويز...' : 'Search quizzes...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <ScrollArea className="h-[300px]">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredQuizzes.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {isRTL ? 'لا توجد كويزات متاحة' : 'No quizzes available'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredQuizzes.map((quiz) => (
                    <button
                      key={quiz.id}
                      onClick={() => handleQuizSelect(quiz)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                    >
                      <div>
                        <p className="font-medium">
                          {isRTL ? quiz.title_ar : quiz.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {!isRTL ? quiz.title_ar : quiz.title}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {quiz.questions_count} {isRTL ? 'سؤال' : 'questions'}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedQuiz(null);
                  setQuestions([]);
                  setSelectedQuestions(new Set());
                }}
              >
                {isRTL ? '← رجوع' : '← Back'}
              </Button>
              <Button variant="outline" size="sm" onClick={selectAll}>
                {selectedQuestions.size === questions.length
                  ? isRTL
                    ? 'إلغاء تحديد الكل'
                    : 'Deselect All'
                  : isRTL
                  ? 'تحديد الكل'
                  : 'Select All'}
              </Button>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{isRTL ? selectedQuiz.title_ar : selectedQuiz.title}</p>
            </div>

            <ScrollArea className="h-[250px]">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {questions.map((question, index) => (
                    <div
                      key={question.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedQuestions.has(question.id)
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleQuestion(question.id)}
                    >
                      <Checkbox
                        checked={selectedQuestions.has(question.id)}
                        onCheckedChange={() => toggleQuestion(question.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {index + 1}. {question.question_text || question.question_text_ar}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {question.points} {isRTL ? 'درجة' : 'pts'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          {selectedQuiz && (
            <Button
              onClick={handleImport}
              disabled={selectedQuestions.size === 0}
              className="kojo-gradient"
            >
              <Check className="h-4 w-4 mr-2" />
              {isRTL
                ? `استيراد ${selectedQuestions.size} سؤال`
                : `Import ${selectedQuestions.size} Questions`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
