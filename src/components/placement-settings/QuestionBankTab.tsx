import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Pencil, Trash2, Upload, MoreHorizontal, Database, CheckCircle, XCircle, BarChart3, Layers } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { StatsGrid, type StatItem } from '@/components/shared/StatsGrid';
import { TableToolbar, type ColumnDef } from '@/components/shared/TableToolbar';
import { SortableTableHead, useTableSort } from '@/components/shared/SortableTableHead';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { cn } from '@/lib/utils';
import QuestionEditDialog from './QuestionEditDialog';
import ImportPreviewDialog from './ImportPreviewDialog';

interface Question {
  id: number;
  age_group: string;
  level: string;
  skill: string;
  difficulty: string;
  question_type: string;
  question_text_ar: string;
  options: Record<string, string>;
  correct_answer: string;
  explanation_ar: string | null;
  is_active: boolean;
  usage_count: number;
  success_rate: number;
  code_snippet: string | null;
  image_url: string | null;
}

const AGE_GROUPS = ['6_9', '10_13', '14_18'];
const LEVELS = ['foundation', 'intermediate', 'advanced'];
const SKILLS = [
  'algorithmic_thinking', 'conditions', 'control_flow', 'data_structures',
  'data_types', 'debugging', 'debugging_basic', 'events', 'functions',
  'lists', 'logic', 'loops', 'oop', 'patterns', 'problem_solving',
  'sequence', 'variables', 'web_basics',
];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

const EMPTY_QUESTION: Partial<Question> = {
  age_group: '6_9', level: 'foundation', skill: 'logic', difficulty: 'medium',
  question_type: 'mcq', question_text_ar: '', correct_answer: 'A',
  explanation_ar: '', code_snippet: '', image_url: '', is_active: true,
  options: { A: '', B: '', C: '', D: '' },
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  hard: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function QuestionBankTab() {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editQ, setEditQ] = useState<Partial<Question> | null>(null);
  const [saving, setSaving] = useState(false);

  // Import state
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importData, setImportData] = useState<any>(null);
  const [importValidation, setImportValidation] = useState<any>(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [fAge, setFAge] = useState<string>('all');
  const [fLevel, setFLevel] = useState<string>('all');
  const [fSkill, setFSkill] = useState<string>('all');
  const [fDifficulty, setFDifficulty] = useState<string>('all');
  const [fStatus, setFStatus] = useState<string>('all');

  // Pagination & sort
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { sortKey, sortDirection, handleSort } = useTableSort('id', 'desc');

  // Column visibility
  const [columns, setColumns] = useState<ColumnDef[]>([
    { key: 'text', label: isRTL ? 'النص' : 'Text', visible: true },
    { key: 'age', label: isRTL ? 'الفئة' : 'Age', visible: true },
    { key: 'level', label: isRTL ? 'المستوى' : 'Level', visible: true },
    { key: 'skill', label: isRTL ? 'المهارة' : 'Skill', visible: true },
    { key: 'difficulty', label: isRTL ? 'الصعوبة' : 'Difficulty', visible: true },
    { key: 'answer', label: isRTL ? 'الإجابة' : 'Answer', visible: true },
    { key: 'usage', label: isRTL ? 'الاستخدام' : 'Usage', visible: true },
    { key: 'rate', label: isRTL ? 'النجاح' : 'Rate', visible: true },
    { key: 'status', label: isRTL ? 'الحالة' : 'Status', visible: true },
  ]);

  const colVis = useMemo(() => {
    const map: Record<string, boolean> = {};
    columns.forEach(c => { map[c.key] = c.visible; });
    return map;
  }, [columns]);

  const handleColumnToggle = (key: string) => {
    setColumns(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  };

  // Stats
  const stats = useMemo((): StatItem[] => {
    return [
      { label: isRTL ? 'إجمالي الأسئلة' : 'Total Questions', value: totalCount, icon: Database, gradient: 'from-blue-500 to-blue-600' },
      { label: isRTL ? 'مفعّلة' : 'Active', value: questions.filter(q => q.is_active).length > 0 ? totalCount : 0, icon: CheckCircle, gradient: 'from-emerald-500 to-emerald-600' },
      { label: isRTL ? 'المهارات' : 'Skills', value: new Set(questions.map(q => q.skill)).size || SKILLS.length, icon: Layers, gradient: 'from-purple-500 to-purple-600' },
      { label: isRTL ? 'متوسط النجاح' : 'Avg Success', value: questions.length ? `${Math.round(questions.reduce((s, q) => s + q.success_rate, 0) / questions.length * 100)}%` : '0%', icon: BarChart3, gradient: 'from-amber-500 to-amber-600' },
    ];
  }, [totalCount, questions, isRTL]);

  // Fetch
  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('placement_question_bank' as any).select('*', { count: 'exact' });
    if (fAge !== 'all') query = query.eq('age_group', fAge);
    if (fLevel !== 'all') query = query.eq('level', fLevel);
    if (fSkill !== 'all') query = query.eq('skill', fSkill);
    if (fDifficulty !== 'all') query = query.eq('difficulty', fDifficulty);
    if (fStatus === 'active') query = query.eq('is_active', true);
    if (fStatus === 'inactive') query = query.eq('is_active', false);
    if (searchQuery) query = query.ilike('question_text_ar', `%${searchQuery}%`);

    // Sort
    const orderCol = sortKey || 'id';
    query = query.order(orderCol, { ascending: sortDirection === 'asc' });

    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count } = await query.range(from, to);

    if (data) setQuestions(data as any);
    if (count !== null) setTotalCount(count);
    setLoading(false);
  }, [fAge, fLevel, fSkill, fDifficulty, fStatus, searchQuery, currentPage, pageSize, sortKey, sortDirection]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);
  useEffect(() => { setCurrentPage(1); }, [fAge, fLevel, fSkill, fDifficulty, fStatus, searchQuery, pageSize]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // CRUD
  const openNew = () => { setEditQ({ ...EMPTY_QUESTION }); setDialogOpen(true); };
  const openEdit = (q: Question) => { setEditQ({ ...q }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!editQ) return;
    setSaving(true);
    const payload = {
      age_group: editQ.age_group, level: editQ.level, skill: editQ.skill,
      difficulty: editQ.difficulty, question_type: editQ.question_type || 'mcq',
      question_text_ar: editQ.question_text_ar, options: editQ.options,
      correct_answer: editQ.correct_answer, explanation_ar: editQ.explanation_ar || null,
      code_snippet: editQ.code_snippet || null, image_url: editQ.image_url || null,
      is_active: editQ.is_active ?? true, updated_at: new Date().toISOString(),
    };
    let error;
    if (editQ.id) {
      ({ error } = await supabase.from('placement_question_bank' as any).update(payload as any).eq('id', editQ.id));
    } else {
      ({ error } = await supabase.from('placement_question_bank' as any).insert(payload as any));
    }
    if (error) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: isRTL ? 'تم الحفظ' : 'Saved' });
      setDialogOpen(false);
      fetchQuestions();
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(isRTL ? 'هل أنت متأكد من الحذف؟' : 'Are you sure you want to delete?')) return;
    await supabase.from('placement_question_bank' as any).delete().eq('id', id);
    fetchQuestions();
  };

  const toggleActive = async (q: Question) => {
    await supabase.from('placement_question_bank' as any)
      .update({ is_active: !q.is_active, updated_at: new Date().toISOString() } as any)
      .eq('id', q.id);
    fetchQuestions();
  };

  const updateEditField = (field: string, value: any) => {
    setEditQ(prev => prev ? { ...prev, [field]: value } : null);
  };
  const updateOption = (key: string, value: string) => {
    setEditQ(prev => prev ? { ...prev, options: { ...(prev.options as any), [key]: value } } : null);
  };

  // Import flow
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const questionsArr = Array.isArray(parsed) ? parsed : parsed.questions;
      if (!Array.isArray(questionsArr) || questionsArr.length === 0) {
        toast({ title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'الملف لا يحتوي على أسئلة صالحة' : 'File contains no valid questions', variant: 'destructive' });
        return;
      }
      setImportData(questionsArr);
      setValidating(true);
      setImportPreviewOpen(true);
      const { data, error } = await supabase.functions.invoke('import-question-bank', {
        body: { questions: questionsArr, mode: 'validate_only' },
      });
      setImportValidation(error ? { valid: false, errors: [error.message], total: questionsArr.length } : data);
    } catch (err: any) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setValidating(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImportConfirm = async () => {
    if (!importData) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-question-bank', {
        body: { questions: importData, mode: 'import' },
      });
      if (error || data?.error) {
        toast({ title: isRTL ? 'فشل' : 'Failed', description: error?.message || data?.error, variant: 'destructive' });
      } else {
        toast({ title: isRTL ? 'تم الاستيراد' : 'Imported', description: isRTL ? `${data.imported} سؤال` : `${data.imported} questions` });
        setImportPreviewOpen(false);
        setImportData(null);
        setImportValidation(null);
        fetchQuestions();
      }
    } catch (err: any) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  // Filter UI for toolbar
  const filterUI = (
    <div className="flex flex-wrap gap-2">
      <Select value={fAge} onValueChange={setFAge}>
        <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder={isRTL ? 'الفئة' : 'Age'} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{isRTL ? 'كل الفئات' : 'All Ages'}</SelectItem>
          {AGE_GROUPS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={fLevel} onValueChange={setFLevel}>
        <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder={isRTL ? 'المستوى' : 'Level'} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{isRTL ? 'كل المستويات' : 'All Levels'}</SelectItem>
          {LEVELS.map(l => <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={fSkill} onValueChange={setFSkill}>
        <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder={isRTL ? 'المهارة' : 'Skill'} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{isRTL ? 'كل المهارات' : 'All Skills'}</SelectItem>
          {SKILLS.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={fDifficulty} onValueChange={setFDifficulty}>
        <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder={isRTL ? 'الصعوبة' : 'Diff'} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
          {DIFFICULTIES.map(d => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={fStatus} onValueChange={setFStatus}>
        <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder={isRTL ? 'الحالة' : 'Status'} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
          <SelectItem value="active">{isRTL ? 'مفعل' : 'Active'}</SelectItem>
          <SelectItem value="inactive">{isRTL ? 'معطل' : 'Inactive'}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <StatsGrid stats={stats} columns={4} />

      {/* Toolbar */}
      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={isRTL ? 'بحث في نص السؤال...' : 'Search question text...'}
        columns={columns}
        onColumnToggle={handleColumnToggle}
        filters={filterUI}
        actions={
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 me-1" />
              {isRTL ? 'استيراد' : 'Import'}
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 me-1" />
              {isRTL ? 'سؤال جديد' : 'New'}
            </Button>
          </div>
        }
      />

      {/* Mobile Cards */}
      <div className="block lg:hidden space-y-3">
        {loading ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">
            {isRTL ? 'جارٍ التحميل...' : 'Loading...'}
          </CardContent></Card>
        ) : questions.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">
            {isRTL ? 'لا توجد أسئلة' : 'No questions found'}
          </CardContent></Card>
        ) : questions.map(q => (
          <Card key={q.id} className="hover:bg-muted/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm line-clamp-2 mb-2">{q.question_text_ar}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-xs">{q.age_group}</Badge>
                    <Badge variant="secondary" className="text-xs capitalize">{q.level}</Badge>
                    <Badge variant="outline" className="text-xs capitalize">{q.skill.replace(/_/g, ' ')}</Badge>
                    <Badge className={cn('text-xs border-0', DIFFICULTY_COLORS[q.difficulty])}>{q.difficulty}</Badge>
                    <Badge variant="outline" className="text-xs font-mono">{isRTL ? 'الإجابة' : 'Ans'}: {q.correct_answer}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{isRTL ? 'استخدام' : 'Used'}: {q.usage_count}</span>
                    <span>{isRTL ? 'نجاح' : 'Rate'}: {(q.success_rate * 100).toFixed(0)}%</span>
                    <Badge variant={q.is_active ? 'default' : 'secondary'} className="text-xs">
                      {q.is_active ? (isRTL ? 'مفعل' : 'Active') : (isRTL ? 'معطل' : 'Inactive')}
                    </Badge>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="flex-shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                    <DropdownMenuItem onClick={() => openEdit(q)}>
                      <Pencil className="h-4 w-4 me-2" />{isRTL ? 'تعديل' : 'Edit'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleActive(q)}>
                      {q.is_active ? <XCircle className="h-4 w-4 me-2" /> : <CheckCircle className="h-4 w-4 me-2" />}
                      {q.is_active ? (isRTL ? 'تعطيل' : 'Deactivate') : (isRTL ? 'تفعيل' : 'Activate')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(q.id)} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4 me-2" />{isRTL ? 'حذف' : 'Delete'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop Table */}
      <Card className="hidden lg:block">
        <CardContent className="p-0">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[4%]">ID</TableHead>
                {colVis.text && <SortableTableHead sortKey="question_text_ar" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort} className="w-[24%]">{isRTL ? 'النص' : 'Text'}</SortableTableHead>}
                {colVis.age && <SortableTableHead sortKey="age_group" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort} className="w-[8%]">{isRTL ? 'الفئة' : 'Age'}</SortableTableHead>}
                {colVis.level && <SortableTableHead sortKey="level" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort} className="w-[10%]">{isRTL ? 'المستوى' : 'Level'}</SortableTableHead>}
                {colVis.skill && <SortableTableHead sortKey="skill" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort} className="w-[12%]">{isRTL ? 'المهارة' : 'Skill'}</SortableTableHead>}
                {colVis.difficulty && <SortableTableHead sortKey="difficulty" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort} className="w-[8%]">{isRTL ? 'الصعوبة' : 'Diff'}</SortableTableHead>}
                {colVis.answer && <TableHead className="w-[5%]">{isRTL ? 'الإجابة' : 'Ans'}</TableHead>}
                {colVis.usage && <SortableTableHead sortKey="usage_count" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort} className="w-[7%]">{isRTL ? 'استخدام' : 'Used'}</SortableTableHead>}
                {colVis.rate && <SortableTableHead sortKey="success_rate" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort} className="w-[7%]">{isRTL ? 'نجاح' : 'Rate'}</SortableTableHead>}
                {colVis.status && <TableHead className="w-[7%]">{isRTL ? 'الحالة' : 'Status'}</TableHead>}
                <TableHead className="w-[5%]">{isRTL ? 'إجراء' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  {isRTL ? 'جارٍ التحميل...' : 'Loading...'}
                </TableCell></TableRow>
              ) : questions.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  {isRTL ? 'لا توجد أسئلة' : 'No questions found'}
                </TableCell></TableRow>
              ) : questions.map(q => (
                <TableRow key={q.id} className="hover:bg-muted/50">
                  <TableCell className="font-mono text-xs text-muted-foreground">{q.id}</TableCell>
                  {colVis.text && (
                    <TableCell className="max-w-0">
                      <p className="truncate text-sm font-medium">{q.question_text_ar}</p>
                    </TableCell>
                  )}
                  {colVis.age && (
                    <TableCell><Badge variant="outline" className="text-xs">{q.age_group}</Badge></TableCell>
                  )}
                  {colVis.level && (
                    <TableCell><span className="capitalize text-xs">{q.level}</span></TableCell>
                  )}
                  {colVis.skill && (
                    <TableCell><span className="capitalize text-xs">{q.skill.replace(/_/g, ' ')}</span></TableCell>
                  )}
                  {colVis.difficulty && (
                    <TableCell>
                      <Badge className={cn('text-xs border-0', DIFFICULTY_COLORS[q.difficulty])}>{q.difficulty}</Badge>
                    </TableCell>
                  )}
                  {colVis.answer && (
                    <TableCell className="font-mono font-bold text-center">{q.correct_answer}</TableCell>
                  )}
                  {colVis.usage && (
                    <TableCell className="text-center tabular-nums">{q.usage_count}</TableCell>
                  )}
                  {colVis.rate && (
                    <TableCell className="text-center tabular-nums">{(q.success_rate * 100).toFixed(0)}%</TableCell>
                  )}
                  {colVis.status && (
                    <TableCell>
                      <Switch checked={q.is_active} onCheckedChange={() => toggleActive(q)} />
                    </TableCell>
                  )}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                        <DropdownMenuItem onClick={() => openEdit(q)}>
                          <Pencil className="h-4 w-4 me-2" />{isRTL ? 'تعديل' : 'Edit'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(q.id)} className="text-destructive focus:text-destructive">
                          <Trash2 className="h-4 w-4 me-2" />{isRTL ? 'حذف' : 'Delete'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalCount={totalCount}
            hasNextPage={currentPage < totalPages}
            hasPreviousPage={currentPage > 1}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <QuestionEditDialog
        open={dialogOpen} onOpenChange={setDialogOpen}
        editQ={editQ} saving={saving}
        onSave={handleSave} onUpdateField={updateEditField} onUpdateOption={updateOption}
        isRTL={isRTL}
      />

      {/* Import Preview */}
      <ImportPreviewDialog
        open={importPreviewOpen}
        onOpenChange={(open) => { setImportPreviewOpen(open); if (!open) { setImportData(null); setImportValidation(null); } }}
        validation={importValidation} validating={validating}
        importing={importing} onConfirmImport={handleImportConfirm} isRTL={isRTL}
      />
    </div>
  );
}
