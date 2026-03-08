import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2, Search, Upload, FileJson, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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

export default function QuestionBankTab() {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
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
  const [fAge, setFAge] = useState<string>('all');
  const [fLevel, setFLevel] = useState<string>('all');
  const [fSkill, setFSkill] = useState<string>('all');
  const [fDifficulty, setFDifficulty] = useState<string>('all');
  const [fStatus, setFStatus] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('placement_question_bank' as any).select('*', { count: 'exact' });
    if (fAge !== 'all') query = query.eq('age_group', fAge);
    if (fLevel !== 'all') query = query.eq('level', fLevel);
    if (fSkill !== 'all') query = query.eq('skill', fSkill);
    if (fDifficulty !== 'all') query = query.eq('difficulty', fDifficulty);
    if (fStatus === 'active') query = query.eq('is_active', true);
    if (fStatus === 'inactive') query = query.eq('is_active', false);
    if (searchText) query = query.ilike('question_text_ar', `%${searchText}%`);

    const { data } = await query
      .order('id', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (data) setQuestions(data as any);
    setLoading(false);
  }, [fAge, fLevel, fSkill, fDifficulty, fStatus, searchText, page]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);
  useEffect(() => { setPage(0); }, [fAge, fLevel, fSkill, fDifficulty, fStatus, searchText]);

  const openNew = () => { setEditQ({ ...EMPTY_QUESTION }); setDialogOpen(true); };
  const openEdit = (q: Question) => { setEditQ({ ...q }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!editQ) return;
    setSaving(true);
    const payload = {
      age_group: editQ.age_group,
      level: editQ.level,
      skill: editQ.skill,
      difficulty: editQ.difficulty,
      question_type: editQ.question_type || 'mcq',
      question_text_ar: editQ.question_text_ar,
      options: editQ.options,
      correct_answer: editQ.correct_answer,
      explanation_ar: editQ.explanation_ar || null,
      code_snippet: editQ.code_snippet || null,
      image_url: editQ.image_url || null,
      is_active: editQ.is_active ?? true,
      updated_at: new Date().toISOString(),
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

  // === IMPORT FLOW ===
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      // Support both { questions: [...] } and direct array
      const questionsArr = Array.isArray(parsed) ? parsed : parsed.questions;
      if (!Array.isArray(questionsArr) || questionsArr.length === 0) {
        toast({
          title: isRTL ? 'خطأ' : 'Error',
          description: isRTL ? 'الملف لا يحتوي على أسئلة صالحة' : 'File contains no valid questions array',
          variant: 'destructive',
        });
        return;
      }

      setImportData(questionsArr);
      setValidating(true);
      setImportPreviewOpen(true);

      // Call edge function in validate_only mode
      const { data, error } = await supabase.functions.invoke('import-question-bank', {
        body: { questions: questionsArr, mode: 'validate_only' },
      });

      if (error) {
        setImportValidation({ valid: false, errors: [error.message], total: questionsArr.length });
      } else {
        setImportValidation(data);
      }
    } catch (err: any) {
      toast({
        title: isRTL ? 'خطأ في قراءة الملف' : 'File read error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setValidating(false);
      // Reset file input
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

      if (error) {
        toast({
          title: isRTL ? 'فشل الاستيراد' : 'Import failed',
          description: error.message,
          variant: 'destructive',
        });
      } else if (data?.error) {
        toast({
          title: isRTL ? 'فشل الاستيراد' : 'Import failed',
          description: data.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: isRTL ? 'تم الاستيراد بنجاح' : 'Import successful',
          description: isRTL
            ? `تم استيراد ${data.imported} سؤال`
            : `${data.imported} questions imported`,
        });
        setImportPreviewOpen(false);
        setImportData(null);
        setImportValidation(null);
        fetchQuestions();
      }
    } catch (err: any) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs">{isRTL ? 'الفئة' : 'Age'}</Label>
              <Select value={fAge} onValueChange={setFAge}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                  {AGE_GROUPS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{isRTL ? 'المستوى' : 'Level'}</Label>
              <Select value={fLevel} onValueChange={setFLevel}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                  {LEVELS.map(l => <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{isRTL ? 'المهارة' : 'Skill'}</Label>
              <Select value={fSkill} onValueChange={setFSkill}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                  {SKILLS.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{isRTL ? 'الصعوبة' : 'Difficulty'}</Label>
              <Select value={fDifficulty} onValueChange={setFDifficulty}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                  {DIFFICULTIES.map(d => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{isRTL ? 'الحالة' : 'Status'}</Label>
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                  <SelectItem value="active">{isRTL ? 'مفعل' : 'Active'}</SelectItem>
                  <SelectItem value="inactive">{isRTL ? 'معطل' : 'Inactive'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Label className="text-xs">{isRTL ? 'بحث' : 'Search'}</Label>
              <div className="relative">
                <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="ps-8" placeholder={isRTL ? 'ابحث في النص...' : 'Search text...'}
                  value={searchText} onChange={e => setSearchText(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 me-1" />
                {isRTL ? 'استيراد JSON' : 'Import JSON'}
              </Button>
              <Button onClick={openNew}>
                <Plus className="h-4 w-4 me-1" />
                {isRTL ? 'سؤال جديد' : 'New Question'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? <Skeleton className="h-64 w-full" /> : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">ID</TableHead>
                  <TableHead>{isRTL ? 'النص' : 'Text'}</TableHead>
                  <TableHead>{isRTL ? 'الفئة' : 'Age'}</TableHead>
                  <TableHead>{isRTL ? 'المستوى' : 'Level'}</TableHead>
                  <TableHead>{isRTL ? 'المهارة' : 'Skill'}</TableHead>
                  <TableHead>{isRTL ? 'الصعوبة' : 'Diff'}</TableHead>
                  <TableHead>{isRTL ? 'الإجابة' : 'Ans'}</TableHead>
                  <TableHead>{isRTL ? 'الاستخدام' : 'Used'}</TableHead>
                  <TableHead>{isRTL ? 'النجاح' : 'Rate'}</TableHead>
                  <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map(q => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">{q.id}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{q.question_text_ar}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{q.age_group}</Badge></TableCell>
                    <TableCell className="capitalize text-xs">{q.level}</TableCell>
                    <TableCell className="capitalize text-xs">{q.skill.replace(/_/g, ' ')}</TableCell>
                    <TableCell className="capitalize text-xs">{q.difficulty}</TableCell>
                    <TableCell className="font-mono">{q.correct_answer}</TableCell>
                    <TableCell>{q.usage_count}</TableCell>
                    <TableCell>{(q.success_rate * 100).toFixed(0)}%</TableCell>
                    <TableCell>
                      <Switch checked={q.is_active} onCheckedChange={() => toggleActive(q)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(q)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {questions.length === 0 && (
                  <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    {isRTL ? 'لا توجد أسئلة' : 'No questions found'}
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      <div className="flex justify-center gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
          {isRTL ? 'السابق' : 'Previous'}
        </Button>
        <span className="text-sm py-2">{isRTL ? `صفحة ${page + 1}` : `Page ${page + 1}`}</span>
        <Button variant="outline" size="sm" disabled={questions.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>
          {isRTL ? 'التالي' : 'Next'}
        </Button>
      </div>

      {/* Edit/Add Dialog */}
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

      {/* Import Preview Dialog */}
      <ImportPreviewDialog
        open={importPreviewOpen}
        onOpenChange={(open) => {
          setImportPreviewOpen(open);
          if (!open) {
            setImportData(null);
            setImportValidation(null);
          }
        }}
        validation={importValidation}
        validating={validating}
        importing={importing}
        onConfirmImport={handleImportConfirm}
        isRTL={isRTL}
      />
    </div>
  );
}
