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
import { Plus, Pencil, Trash2, Upload, MoreHorizontal, Database, CheckCircle, XCircle, BarChart3, Layers, CheckCheck } from 'lucide-react';
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
  section: string;
  skill: string;
  track_category: string | null;
  difficulty: string;
  question_text_ar: string;
  options: Record<string, string>;
  correct_answer: string;
  explanation_ar: string | null;
  code_snippet: string | null;
  image_url: string | null;
  is_active: boolean;
  is_archived: boolean;
  review_status: string;
  usage_count: number;
  success_rate: number;
}

const SECTIONS = ['section_a', 'section_b', 'section_c'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'needs_revision'];

const SECTION_LABELS: Record<string, { en: string; ar: string }> = {
  section_a: { en: 'Section A', ar: 'القسم A' },
  section_b: { en: 'Section B', ar: 'القسم B' },
  section_c: { en: 'Section C', ar: 'القسم C' },
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  hard: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const REVIEW_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  needs_revision: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

const EMPTY_QUESTION: Partial<Question> = {
  section: 'section_a', skill: 'computer_basics', difficulty: 'medium',
  question_text_ar: '', correct_answer: 'A', explanation_ar: '', code_snippet: '',
  image_url: '', is_active: true, is_archived: false, review_status: 'pending',
  track_category: null, options: { A: '', B: '', C: '', D: '' },
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

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [fSection, setFSection] = useState<string>('all');
  const [fDifficulty, setFDifficulty] = useState<string>('all');
  const [fReview, setFReview] = useState<string>('all');
  const [fStatus, setFStatus] = useState<string>('all');

  // Pagination & sort
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { sortKey, sortDirection, handleSort } = useTableSort('id', 'desc');

  // Column visibility
  const [columns, setColumns] = useState<ColumnDef[]>([
    { key: 'text', label: isRTL ? 'النص' : 'Text', visible: true },
    { key: 'section', label: isRTL ? 'القسم' : 'Section', visible: true },
    { key: 'skill', label: isRTL ? 'المهارة' : 'Skill', visible: true },
    { key: 'difficulty', label: isRTL ? 'الصعوبة' : 'Difficulty', visible: true },
    { key: 'review', label: isRTL ? 'المراجعة' : 'Review', visible: true },
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
  const stats = useMemo((): StatItem[] => [
    { label: isRTL ? 'إجمالي الأسئلة' : 'Total Questions', value: totalCount, icon: Database, gradient: 'from-blue-500 to-blue-600' },
    { label: isRTL ? 'معتمدة' : 'Approved', value: questions.filter(q => q.review_status === 'approved').length, icon: CheckCircle, gradient: 'from-emerald-500 to-emerald-600' },
    { label: isRTL ? 'المهارات' : 'Skills', value: new Set(questions.map(q => q.skill)).size, icon: Layers, gradient: 'from-purple-500 to-purple-600' },
    { label: isRTL ? 'متوسط النجاح' : 'Avg Success', value: questions.length ? `${Math.round(questions.reduce((s, q) => s + q.success_rate, 0) / questions.length * 100)}%` : '0%', icon: BarChart3, gradient: 'from-amber-500 to-amber-600' },
  ], [totalCount, questions, isRTL]);

  // Fetch
  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('placement_v2_questions').select('*', { count: 'exact' });
    if (fSection !== 'all') query = query.eq('section', fSection);
    if (fDifficulty !== 'all') query = query.eq('difficulty', fDifficulty);
    if (fReview !== 'all') query = query.eq('review_status', fReview);
    if (fStatus === 'active') query = query.eq('is_active', true);
    if (fStatus === 'inactive') query = query.eq('is_active', false);
    if (fStatus === 'archived') query = query.eq('is_archived', true);
    if (searchQuery) query = query.ilike('question_text_ar', `%${searchQuery}%`);

    const orderCol = sortKey || 'id';
    query = query.order(orderCol, { ascending: sortDirection === 'asc' });

    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count } = await query.range(from, to);

    if (data) setQuestions(data as any);
    if (count !== null) setTotalCount(count);
    setLoading(false);
  }, [fSection, fDifficulty, fReview, fStatus, searchQuery, currentPage, pageSize, sortKey, sortDirection]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);
  useEffect(() => { setCurrentPage(1); }, [fSection, fDifficulty, fReview, fStatus, searchQuery, pageSize]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // CRUD
  const openNew = () => { setEditQ({ ...EMPTY_QUESTION }); setDialogOpen(true); };
  const openEdit = (q: Question) => { setEditQ({ ...q }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!editQ) return;
    setSaving(true);
    const payload = {
      section: editQ.section, skill: editQ.skill, difficulty: editQ.difficulty,
      track_category: editQ.section === 'section_c' ? (editQ.track_category || 'software') : null,
      question_text_ar: editQ.question_text_ar, options: editQ.options,
      correct_answer: editQ.correct_answer, explanation_ar: editQ.explanation_ar || null,
      code_snippet: editQ.code_snippet || null, image_url: editQ.image_url || null,
      is_active: editQ.is_active ?? true, is_archived: editQ.is_archived ?? false,
      review_status: editQ.review_status || 'pending',
      updated_at: new Date().toISOString(),
    };
    let error;
    if (editQ.id) {
      ({ error } = await supabase.from('placement_v2_questions').update(payload as any).eq('id', editQ.id));
    } else {
      ({ error } = await supabase.from('placement_v2_questions').insert(payload as any));
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
    await supabase.from('placement_v2_questions').delete().eq('id', id);
    fetchQuestions();
  };

  const toggleActive = async (q: Question) => {
    await supabase.from('placement_v2_questions')
      .update({ is_active: !q.is_active, updated_at: new Date().toISOString() } as any)
      .eq('id', q.id);
    fetchQuestions();
  };

  const pendingCount = questions.filter(q => q.review_status === 'pending').length;

  const handleBulkApprove = async () => {
    if (!confirm(isRTL ? 'هل تريد اعتماد جميع الأسئلة المعلقة؟' : 'Approve all pending questions?')) return;
    const { error } = await supabase.from('placement_v2_questions')
      .update({ review_status: 'approved', updated_at: new Date().toISOString() } as any)
      .eq('review_status', 'pending');
    if (error) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: isRTL ? 'تم اعتماد جميع الأسئلة المعلقة' : 'All pending questions approved' });
      fetchQuestions();
    }
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

  // Filter UI
  const filterUI = (
    <div className="flex flex-wrap gap-2">
      <Select value={fSection} onValueChange={setFSection}>
        <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder={isRTL ? 'القسم' : 'Section'} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{isRTL ? 'كل الأقسام' : 'All Sections'}</SelectItem>
          {SECTIONS.map(s => <SelectItem key={s} value={s}>{isRTL ? SECTION_LABELS[s].ar : SECTION_LABELS[s].en}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={fDifficulty} onValueChange={setFDifficulty}>
        <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder={isRTL ? 'الصعوبة' : 'Diff'} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
          {DIFFICULTIES.map(d => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={fReview} onValueChange={setFReview}>
        <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder={isRTL ? 'المراجعة' : 'Review'} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
          {REVIEW_STATUSES.map(r => <SelectItem key={r} value={r} className="capitalize">{r.replace(/_/g, ' ')}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={fStatus} onValueChange={setFStatus}>
        <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder={isRTL ? 'الحالة' : 'Status'} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
          <SelectItem value="active">{isRTL ? 'مفعل' : 'Active'}</SelectItem>
          <SelectItem value="inactive">{isRTL ? 'معطل' : 'Inactive'}</SelectItem>
          <SelectItem value="archived">{isRTL ? 'مؤرشف' : 'Archived'}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6">
      <StatsGrid stats={stats} columns={4} />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={isRTL ? 'بحث في نص السؤال...' : 'Search question text...'}
        columns={columns}
        onColumnToggle={handleColumnToggle}
        filters={filterUI}
        actions={
          <div className="flex gap-2">
            {pendingCount > 0 && (
              <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" onClick={handleBulkApprove}>
                <CheckCheck className="h-4 w-4 me-1" />
                {isRTL ? `اعتماد الكل (${pendingCount})` : `Approve All (${pendingCount})`}
              </Button>
            )}
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
                    <Badge variant="secondary" className="text-xs">{isRTL ? SECTION_LABELS[q.section]?.ar : SECTION_LABELS[q.section]?.en}</Badge>
                    <Badge variant="outline" className="text-xs capitalize">{q.skill.replace(/_/g, ' ')}</Badge>
                    <Badge className={cn('text-xs border-0', DIFFICULTY_COLORS[q.difficulty])}>{q.difficulty}</Badge>
                    <Badge className={cn('text-xs border-0', REVIEW_COLORS[q.review_status])}>{q.review_status.replace(/_/g, ' ')}</Badge>
                    {q.track_category && <Badge variant="outline" className="text-xs capitalize">{q.track_category}</Badge>}
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
                    <DropdownMenuItem onClick={() => handleDelete(q.id)} className="text-destructive">
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
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</div>
          ) : questions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">{isRTL ? 'لا توجد أسئلة' : 'No questions found'}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {colVis.text && <SortableTableHead sortKey="question_text_ar" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>{isRTL ? 'النص' : 'Text'}</SortableTableHead>}
                  {colVis.section && <SortableTableHead sortKey="section" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>{isRTL ? 'القسم' : 'Section'}</SortableTableHead>}
                  {colVis.skill && <SortableTableHead sortKey="skill" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>{isRTL ? 'المهارة' : 'Skill'}</SortableTableHead>}
                  {colVis.difficulty && <SortableTableHead sortKey="difficulty" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>{isRTL ? 'الصعوبة' : 'Diff'}</SortableTableHead>}
                  {colVis.review && <SortableTableHead sortKey="review_status" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>{isRTL ? 'المراجعة' : 'Review'}</SortableTableHead>}
                  {colVis.answer && <TableHead>{isRTL ? 'الإجابة' : 'Ans'}</TableHead>}
                  {colVis.usage && <SortableTableHead sortKey="usage_count" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>{isRTL ? 'استخدام' : 'Used'}</SortableTableHead>}
                  {colVis.rate && <SortableTableHead sortKey="success_rate" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>{isRTL ? 'نجاح' : 'Rate'}</SortableTableHead>}
                  {colVis.status && <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>}
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map(q => (
                  <TableRow key={q.id}>
                    {colVis.text && <TableCell className="max-w-xs truncate text-sm">{q.question_text_ar}</TableCell>}
                    {colVis.section && <TableCell><Badge variant="secondary" className="text-xs">{isRTL ? SECTION_LABELS[q.section]?.ar : SECTION_LABELS[q.section]?.en}</Badge></TableCell>}
                    {colVis.skill && <TableCell className="text-xs capitalize">{q.skill.replace(/_/g, ' ')}</TableCell>}
                    {colVis.difficulty && <TableCell><Badge className={cn('text-xs border-0', DIFFICULTY_COLORS[q.difficulty])}>{q.difficulty}</Badge></TableCell>}
                    {colVis.review && <TableCell><Badge className={cn('text-xs border-0', REVIEW_COLORS[q.review_status])}>{q.review_status.replace(/_/g, ' ')}</Badge></TableCell>}
                    {colVis.answer && <TableCell className="font-mono text-xs">{q.correct_answer}</TableCell>}
                    {colVis.usage && <TableCell className="text-xs">{q.usage_count}</TableCell>}
                    {colVis.rate && <TableCell className="text-xs">{(q.success_rate * 100).toFixed(0)}%</TableCell>}
                    {colVis.status && <TableCell>
                      <Switch checked={q.is_active} onCheckedChange={() => toggleActive(q)} />
                    </TableCell>}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                          <DropdownMenuItem onClick={() => openEdit(q)}>
                            <Pencil className="h-4 w-4 me-2" />{isRTL ? 'تعديل' : 'Edit'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(q.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 me-2" />{isRTL ? 'حذف' : 'Delete'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalCount > pageSize && (
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
      )}

      {/* Edit Dialog */}
      <QuestionEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editQ={editQ}
        saving={saving}
        onSave={handleSave}
        onUpdateField={updateEditField}
        onUpdateOption={updateOption}
        isRTL={isRTL}
      />

      {/* Import Dialog */}
      <ImportPreviewDialog
        open={importPreviewOpen}
        onOpenChange={setImportPreviewOpen}
        validation={importValidation}
        validating={validating}
        importing={importing}
        onConfirmImport={handleImportConfirm}
        isRTL={isRTL}
      />
    </div>
  );
}
