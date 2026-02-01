import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, FileQuestion, Play, Users, ListChecks, BarChart3, AlertCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { notificationService } from '@/lib/notificationService';
import { validateTimeRange, getLocalizedError } from '@/lib/validationUtils';
import { cn } from '@/lib/utils';

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

interface AgeGroup {
  id: string;
  name: string;
  name_ar: string;
}

interface Level {
  id: string;
  name: string;
  name_ar: string;
}

interface Group {
  id: string;
  name: string;
  name_ar: string;
}

export default function QuizzesPage() {
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [assigningQuiz, setAssigningQuiz] = useState<Quiz | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    title_ar: '',
    description: '',
    description_ar: '',
    duration_minutes: 30,
    passing_score: 60,
    age_group_id: '',
    level_id: '',
  });
  const [assignData, setAssignData] = useState({
    group_id: '',
    start_time: '',
  });

  // Calculate end time automatically based on quiz duration
  // Convert local datetime to proper ISO string for database
  const getISOString = (localDateTime: string) => {
    if (!localDateTime) return '';
    // datetime-local gives us local time, we need to convert to ISO
    const date = new Date(localDateTime);
    return date.toISOString();
  };

  const calculatedEndTime = useMemo(() => {
    if (!assignData.start_time || !assigningQuiz) return '';
    const startDate = new Date(assignData.start_time);
    const endDate = new Date(startDate.getTime() + (assigningQuiz.duration_minutes * 60 * 1000));
    return endDate.toISOString();
  }, [assignData.start_time, assigningQuiz]);

  // Validation: start time must be in the future
  const startTimeError = useMemo(() => {
    if (!assignData.start_time) return null;
    const startDate = new Date(assignData.start_time);
    const now = new Date();
    if (startDate <= now) {
      return isRTL ? 'وقت البداية يجب أن يكون في المستقبل' : 'Start time must be in the future';
    }
    return null;
  }, [assignData.start_time, isRTL]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [quizzesRes, ageGroupsRes, levelsRes, groupsRes] = await Promise.all([
        supabase.from('quizzes').select('*').order('created_at', { ascending: false }),
        supabase.from('age_groups').select('id, name, name_ar').eq('is_active', true),
        supabase.from('levels').select('id, name, name_ar').eq('is_active', true),
        supabase.from('groups').select('id, name, name_ar').eq('is_active', true),
      ]);

      setQuizzes(quizzesRes.data || []);
      setAgeGroups(ageGroupsRes.data || []);
      setLevels(levelsRes.data || []);
      setGroups(groupsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    try {
      const payload = {
        title: formData.title,
        title_ar: formData.title_ar,
        description: formData.description || null,
        description_ar: formData.description_ar || null,
        duration_minutes: formData.duration_minutes,
        passing_score: formData.passing_score,
        age_group_id: formData.age_group_id || null,
        level_id: formData.level_id || null,
        created_by: user.id,
      };

      if (editingQuiz) {
        const { error } = await supabase
          .from('quizzes')
          .update(payload)
          .eq('id', editingQuiz.id);

        if (error) throw error;
        toast({
          title: t.common.success,
          description: isRTL ? 'تم تحديث الكويز' : 'Quiz updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('quizzes')
          .insert([payload]);

        if (error) throw error;
        toast({
          title: t.common.success,
          description: isRTL ? 'تم إضافة الكويز' : 'Quiz added successfully',
        });
      }

      setIsDialogOpen(false);
      setEditingQuiz(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving quiz:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في حفظ الكويز' : 'Failed to save quiz',
      });
    }
  };

  const handleAssign = async () => {
    if (!user || !assigningQuiz) return;

    // Validate start time
    if (startTimeError) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: startTimeError,
      });
      return;
    }

    // Require start time
    if (!assignData.start_time) {
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'يجب تحديد وقت البداية' : 'Start time is required',
      });
      return;
    }

    try {
      const { error } = await supabase.from('quiz_assignments').insert([{
        quiz_id: assigningQuiz.id,
        group_id: assignData.group_id || null,
        start_time: getISOString(assignData.start_time) || null,
        due_date: calculatedEndTime || null, // Auto-calculated end time
        assigned_by: user.id,
      }]);

      if (error) throw error;

      // Send notifications to students in the group
      if (assignData.group_id) {
        const formattedEndTime = calculatedEndTime 
          ? new Date(calculatedEndTime).toLocaleString() 
          : undefined;

        await notificationService.notifyGroupStudents(
          assignData.group_id,
          'New Quiz Assigned',
          'كويز جديد',
          `You have been assigned a new quiz: "${assigningQuiz.title}"${formattedEndTime ? ` - Ends: ${formattedEndTime}` : ''}`,
          `تم إسناد كويز جديد لك: "${assigningQuiz.title_ar}"${formattedEndTime ? ` - ينتهي: ${formattedEndTime}` : ''}`,
          'info',
          'quiz'
        );
      }

      toast({
        title: t.common.success,
        description: isRTL ? 'تم إسناد الكويز وإشعار الطلاب' : 'Quiz assigned and students notified',
      });

      setIsAssignDialogOpen(false);
      setAssigningQuiz(null);
      setAssignData({ group_id: '', start_time: '' });
    } catch (error) {
      console.error('Error assigning quiz:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في إسناد الكويز' : 'Failed to assign quiz',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      title_ar: '',
      description: '',
      description_ar: '',
      duration_minutes: 30,
      passing_score: 60,
      age_group_id: '',
      level_id: '',
    });
  };

  const handleEdit = (quiz: Quiz) => {
    setEditingQuiz(quiz);
    setFormData({
      title: quiz.title,
      title_ar: quiz.title_ar,
      description: quiz.description || '',
      description_ar: quiz.description_ar || '',
      duration_minutes: quiz.duration_minutes,
      passing_score: quiz.passing_score,
      age_group_id: quiz.age_group_id || '',
      level_id: quiz.level_id || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('quizzes').delete().eq('id', id);
      if (error) throw error;
      toast({
        title: t.common.success,
        description: isRTL ? 'تم حذف الكويز' : 'Quiz deleted successfully',
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting quiz:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في حذف الكويز' : 'Failed to delete quiz',
      });
    }
  };

  const filteredQuizzes = quizzes.filter((quiz) =>
    quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    quiz.title_ar.includes(searchQuery)
  );

  const getLevelName = (id: string | null) => {
    if (!id) return '-';
    const level = levels.find((l) => l.id === id);
    return level ? (language === 'ar' ? level.name_ar : level.name) : '-';
  };

  return (
    <DashboardLayout title={t.nav.questionBank}>
      <div className="space-y-6">
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

          <div className="flex gap-2">
            {role === 'admin' && (
              <Button variant="outline" onClick={() => navigate('/quiz-reports')}>
                <BarChart3 className="h-4 w-4 mr-2" />
                {isRTL ? 'التقارير' : 'Reports'}
              </Button>
            )}

            {(role === 'admin' || role === 'instructor') && (
              <Button className="kojo-gradient" onClick={() => {
                setEditingQuiz(null);
                resetForm();
                setIsDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                {t.quizzes.addQuiz}
              </Button>
            )}
          </div>
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingQuiz ? t.quizzes.editQuiz : t.quizzes.addQuiz}
              </DialogTitle>
              <DialogDescription>
                {isRTL ? 'أدخل بيانات الكويز' : 'Enter quiz details'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid gap-2">
                <Label>{t.quizzes.quizName} (English)</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Scratch Basics Quiz"
                />
              </div>
              <div className="grid gap-2">
                <Label>{t.quizzes.quizName} (عربي)</Label>
                <Input
                  value={formData.title_ar}
                  onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                  placeholder="مثال: اختبار سكراتش"
                  dir="rtl"
                />
              </div>
              <div className="grid gap-2">
                <Label>{t.assignments.description} (English)</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Quiz description..."
                />
              </div>
              <div className="grid gap-2">
                <Label>{t.assignments.description} (عربي)</Label>
                <Textarea
                  value={formData.description_ar}
                  onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                  placeholder="وصف الكويز..."
                  dir="rtl"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{t.quizzes.duration} ({isRTL ? 'دقيقة' : 'min'})</Label>
                  <Input
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 30 })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{isRTL ? 'درجة النجاح %' : 'Pass Score %'}</Label>
                  <Input
                    type="number"
                    value={formData.passing_score}
                    onChange={(e) => setFormData({ ...formData, passing_score: parseInt(e.target.value) || 60 })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{t.students.ageGroup}</Label>
                  <Select
                    value={formData.age_group_id}
                    onValueChange={(value) => setFormData({ ...formData, age_group_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isRTL ? 'اختر' : 'Select'} />
                    </SelectTrigger>
                    <SelectContent>
                      {ageGroups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {language === 'ar' ? group.name_ar : group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{t.students.level}</Label>
                  <Select
                    value={formData.level_id}
                    onValueChange={(value) => setFormData({ ...formData, level_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isRTL ? 'اختر' : 'Select'} />
                    </SelectTrigger>
                    <SelectContent>
                      {levels.map((level) => (
                        <SelectItem key={level.id} value={level.id}>
                          {language === 'ar' ? level.name_ar : level.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button className="kojo-gradient" onClick={handleSubmit}>
                {t.common.save}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Dialog */}
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.quizzes.assignQuiz}</DialogTitle>
              <DialogDescription>
                {isRTL ? 'اختر المجموعة لإسناد الكويز' : 'Select a group to assign the quiz'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>{t.students.group}</Label>
                <Select
                  value={assignData.group_id}
                  onValueChange={(value) => setAssignData({ ...assignData, group_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? 'اختر مجموعة' : 'Select group'} />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {language === 'ar' ? group.name_ar : group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className={cn(startTimeError && 'text-destructive')}>
                  {isRTL ? 'وقت البداية' : 'Start Time'} <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="datetime-local"
                  value={assignData.start_time}
                  onChange={(e) => setAssignData({ ...assignData, start_time: e.target.value })}
                  className={cn(startTimeError && 'border-destructive focus-visible:ring-destructive')}
                />
                <p className="text-xs text-muted-foreground">
                  {isRTL ? 'متى يبدأ العد التنازلي للكويز' : 'When the quiz countdown starts'}
                </p>
                {startTimeError && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {startTimeError}
                  </p>
                )}
              </div>
              
              {/* Auto-calculated end time display */}
              {assignData.start_time && assigningQuiz && (
                <div className="p-4 rounded-lg bg-muted/50 border space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {isRTL ? 'مدة الكويز:' : 'Quiz Duration:'}
                    </span>
                    <span className="font-medium">
                      {assigningQuiz.duration_minutes} {isRTL ? 'دقيقة' : 'minutes'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {isRTL ? 'ينتهي تلقائياً:' : 'Auto-ends at:'}
                    </span>
                    <span className="font-medium text-primary">
                      {new Date(calculatedEndTime).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                        timeZone: 'Africa/Cairo',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {isRTL 
                      ? '⏰ الوقت يبدأ من موعد البداية - إذا دخل الطالب متأخراً، يُخصم الوقت المنقضي'
                      : '⏰ Timer starts from scheduled time - late entries get reduced time'}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button 
                className="kojo-gradient" 
                onClick={handleAssign}
                disabled={!!startTimeError || !assignData.start_time || !assignData.group_id}
              >
                {t.quizzes.assignQuiz}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="flex-shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                        <DropdownMenuItem onClick={() => {
                          setAssigningQuiz(quiz);
                          setIsAssignDialogOpen(true);
                        }}>
                          <Users className="h-4 w-4 mr-2" />
                          {t.quizzes.assignQuiz}
                        </DropdownMenuItem>
                        {role === 'admin' && (
                          <DropdownMenuItem onClick={() => navigate(`/quiz-editor/${quiz.id}`)}>
                            <ListChecks className="h-4 w-4 mr-2" />
                            {isRTL ? 'إدارة الأسئلة' : 'Manage Questions'}
                          </DropdownMenuItem>
                        )}
                        {(role === 'admin' || role === 'instructor') && (
                          <>
                            <DropdownMenuItem onClick={() => handleEdit(quiz)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              {t.common.edit}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(quiz.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t.common.delete}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                  <TableHead>{t.quizzes.duration}</TableHead>
                  <TableHead>{isRTL ? 'درجة النجاح' : 'Pass Score'}</TableHead>
                  <TableHead className="w-[100px]">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      {t.common.loading}
                    </TableCell>
                  </TableRow>
                ) : filteredQuizzes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
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
                        <Badge variant="outline">
                          {quiz.duration_minutes} {isRTL ? 'دقيقة' : 'min'}
                        </Badge>
                      </TableCell>
                      <TableCell>{quiz.passing_score}%</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                            <DropdownMenuItem onClick={() => {
                              setAssigningQuiz(quiz);
                              setIsAssignDialogOpen(true);
                            }}>
                              <Users className="h-4 w-4 mr-2" />
                              {t.quizzes.assignQuiz}
                            </DropdownMenuItem>
                            {role === 'admin' && (
                              <DropdownMenuItem onClick={() => navigate(`/quiz-editor/${quiz.id}`)}>
                                <ListChecks className="h-4 w-4 mr-2" />
                                {isRTL ? 'إدارة الأسئلة' : 'Manage Questions'}
                              </DropdownMenuItem>
                            )}
                            {(role === 'admin' || role === 'instructor') && (
                              <>
                                <DropdownMenuItem onClick={() => handleEdit(quiz)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  {t.common.edit}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDelete(quiz.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {t.common.delete}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
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
