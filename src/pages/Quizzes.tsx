import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MoreHorizontal, FileQuestion, ListChecks, BarChart3, Info } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Quiz {
  id: string;
  title: string;
  title_ar: string;
  description: string | null;
  description_ar: string | null;
  duration_minutes: number;
  passing_score: number;
  age_group_id: string | null;
  level_id: string | null;
  is_active: boolean | null;
  created_at: string;
}

interface Level {
  id: string;
  name: string;
  name_ar: string;
}

interface CurriculumLink {
  quiz_id: string;
  session_number: number;
  age_groups: { name: string; name_ar: string } | null;
  levels: { name: string; name_ar: string } | null;
}

export default function QuizzesPage() {
  const { t, isRTL, language } = useLanguage();
  const { role } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [curriculumMap, setCurriculumMap] = useState<Map<string, CurriculumLink>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [linkFilter, setLinkFilter] = useState<'all' | 'linked' | 'unlinked'>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [quizzesRes, levelsRes] = await Promise.all([
        supabase.from('quizzes').select('*').order('created_at', { ascending: false }),
        supabase.from('levels').select('id, name, name_ar').eq('is_active', true),
      ]);

      const quizzesData = quizzesRes.data || [];
      setQuizzes(quizzesData);
      setLevels(levelsRes.data || []);

      const quizIds = quizzesData.map(q => q.id);
      if (quizIds.length > 0) {
        const { data: curriculumLinks } = await supabase
          .from('curriculum_sessions')
          .select('quiz_id, session_number, age_groups(name, name_ar), levels(name, name_ar)')
          .in('quiz_id', quizIds)
          .eq('is_active', true);

        const map = new Map<string, CurriculumLink>();
        (curriculumLinks || []).forEach((c: any) => {
          if (c.quiz_id) map.set(c.quiz_id, c);
        });
        setCurriculumMap(map);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredQuizzes = quizzes.filter((quiz) => {
    const matchesSearch = quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quiz.title_ar.includes(searchQuery);
    const matchesLink = linkFilter === 'all' ? true :
      linkFilter === 'linked' ? curriculumMap.has(quiz.id) :
      !curriculumMap.has(quiz.id);
    return matchesSearch && matchesLink;
  });

  const getCurriculumLabel = (quizId: string) => {
    const link = curriculumMap.get(quizId);
    if (!link) return null;
    const agName = language === 'ar' ? link.age_groups?.name_ar : link.age_groups?.name;
    const lvName = language === 'ar' ? link.levels?.name_ar : link.levels?.name;
    return `${agName || ''} • ${lvName || ''} • ${isRTL ? 'سيشن' : 'Session'} ${link.session_number}`;
  };

  const getLevelName = (id: string | null) => {
    if (!id) return '-';
    const level = levels.find((l) => l.id === id);
    return level ? (language === 'ar' ? level.name_ar : level.name) : '-';
  };

  return (
    <DashboardLayout title={t.nav.questionBank}>
      <div className="space-y-6">
        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {isRTL ? 'الكويزات تُنشأ من داخل المنهج. اذهب لإدارة المنهج لإنشاء أو تعديل كويز.' : 'Quizzes are created from within the curriculum. Go to Curriculum Management to create or edit a quiz.'}
          </AlertDescription>
        </Alert>

        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.common.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Select value={linkFilter} onValueChange={(v) => setLinkFilter(v as any)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                <SelectItem value="linked">{isRTL ? 'مربوط بالمنهج' : 'Linked'}</SelectItem>
                <SelectItem value="unlinked">{isRTL ? 'غير مربوط' : 'Unlinked'}</SelectItem>
              </SelectContent>
            </Select>
            {role === 'admin' && (
              <Button variant="outline" onClick={() => navigate('/quiz-reports')}>
                <BarChart3 className="h-4 w-4 mr-2" />
                {isRTL ? 'التقارير' : 'Reports'}
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Cards View */}
        <div className="block md:hidden space-y-3">
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {t.common.loading}
              </CardContent>
            </Card>
          ) : filteredQuizzes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <FileQuestion className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {isRTL ? 'لا توجد كويزات' : 'No quizzes found'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredQuizzes.map((quiz) => (
              <Card key={quiz.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {language === 'ar' ? quiz.title_ar : quiz.title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {getLevelName(quiz.level_id)}
                      </p>
                      {(() => {
                        const label = getCurriculumLabel(quiz.id);
                        return label ? (
                          <Badge className="text-xs bg-primary/10 text-primary border-primary/20 mt-1">
                            {label}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground mt-1">
                            {isRTL ? 'غير مربوط' : 'Unlinked'}
                          </Badge>
                        );
                      })()}
                    </div>
                    {role === 'admin' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="flex-shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                          <DropdownMenuItem onClick={() => navigate(`/quiz-editor/${quiz.id}`)}>
                            <ListChecks className="h-4 w-4 mr-2" />
                            {isRTL ? 'إدارة الأسئلة' : 'Manage Questions'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant="outline" className="text-xs">
                      {quiz.duration_minutes} {isRTL ? 'دقيقة' : 'min'}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {quiz.passing_score}% {isRTL ? 'للنجاح' : 'to pass'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.quizzes.quizName}</TableHead>
                  <TableHead>{t.students.level}</TableHead>
                  <TableHead>{isRTL ? 'المنهج' : 'Curriculum'}</TableHead>
                  <TableHead>{t.quizzes.duration}</TableHead>
                  <TableHead>{isRTL ? 'درجة النجاح' : 'Pass Score'}</TableHead>
                  {role === 'admin' && <TableHead className="w-[100px]">{t.common.actions}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={role === 'admin' ? 6 : 5} className="text-center py-8">
                      {t.common.loading}
                    </TableCell>
                  </TableRow>
                ) : filteredQuizzes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={role === 'admin' ? 6 : 5} className="text-center py-8">
                      <FileQuestion className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        {isRTL ? 'لا توجد كويزات' : 'No quizzes found'}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredQuizzes.map((quiz) => (
                    <TableRow key={quiz.id}>
                      <TableCell className="font-medium">
                        {language === 'ar' ? quiz.title_ar : quiz.title}
                      </TableCell>
                      <TableCell>{getLevelName(quiz.level_id)}</TableCell>
                      <TableCell>
                        {(() => {
                          const label = getCurriculumLabel(quiz.id);
                          return label ? (
                            <Badge className="text-xs bg-primary/10 text-primary border-primary/20 font-normal">
                              {label}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">{isRTL ? 'غير مربوط' : 'Unlinked'}</span>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {quiz.duration_minutes} {isRTL ? 'دقيقة' : 'min'}
                        </Badge>
                      </TableCell>
                      <TableCell>{quiz.passing_score}%</TableCell>
                      {role === 'admin' && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                              <DropdownMenuItem onClick={() => navigate(`/quiz-editor/${quiz.id}`)}>
                                <ListChecks className="h-4 w-4 mr-2" />
                                {isRTL ? 'إدارة الأسئلة' : 'Manage Questions'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
