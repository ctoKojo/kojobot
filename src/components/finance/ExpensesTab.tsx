import { useState, useEffect } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const CATEGORIES = [
  { value: 'rent', en: 'Rent', ar: 'إيجار' },
  { value: 'utilities', en: 'Utilities', ar: 'مرافق' },
  { value: 'supplies', en: 'Supplies', ar: 'مستلزمات' },
  { value: 'marketing', en: 'Marketing', ar: 'تسويق' },
  { value: 'equipment', en: 'Equipment', ar: 'معدات' },
  { value: 'other', en: 'Other', ar: 'أخرى' },
];

export function ExpensesTab() {
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: 'other',
    description: '',
    description_ar: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    is_recurring: false,
    notes: '',
  });

  useEffect(() => { fetchExpenses(); }, []);

  const fetchExpenses = async () => {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false });
    if (!error) setExpenses(data || []);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!form.description || !form.amount) return;
    setSaving(true);
    const { error } = await supabase.from('expenses').insert({
      category: form.category,
      description: form.description,
      description_ar: form.description_ar || null,
      amount: Number(form.amount),
      expense_date: form.expense_date,
      is_recurring: form.is_recurring,
      notes: form.notes || null,
      recorded_by: user?.id,
    } as any);
    if (error) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: error.message });
    } else {
      toast({ title: isRTL ? 'تم إضافة المصروف' : 'Expense added' });
      setDialogOpen(false);
      setForm({ category: 'other', description: '', description_ar: '', amount: '', expense_date: new Date().toISOString().split('T')[0], is_recurring: false, notes: '' });
      fetchExpenses();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('expenses').delete().eq('id', id);
    fetchExpenses();
  };

  const filtered = expenses
    .filter(e => filterCategory === 'all' || e.category === filterCategory)
    .filter(e => !search || e.description?.toLowerCase().includes(search.toLowerCase()) || e.description_ar?.includes(search));

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalAmount = filtered.reduce((sum, e) => sum + Number(e.amount), 0);

  const getCategoryLabel = (cat: string) => {
    const c = CATEGORIES.find(c => c.value === cat);
    return c ? (isRTL ? c.ar : c.en) : cat;
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-2 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={isRTL ? 'بحث...' : 'Search...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterCategory} onValueChange={v => { setFilterCategory(v); setPage(1); }}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{isRTL ? c.ar : c.en}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium">
              {isRTL ? 'الإجمالي: ' : 'Total: '}<span className="text-destructive">{totalAmount} {isRTL ? 'ج.م' : 'EGP'}</span>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />{isRTL ? 'إضافة مصروف' : 'Add Expense'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
              <TableHead>{isRTL ? 'التصنيف' : 'Category'}</TableHead>
              <TableHead>{isRTL ? 'الوصف' : 'Description'}</TableHead>
              <TableHead>{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
              <TableHead>{isRTL ? 'متكرر' : 'Recurring'}</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">{isRTL ? 'جاري التحميل...' : 'Loading...'}</TableCell></TableRow>
            ) : paginated.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{isRTL ? 'لا توجد مصروفات' : 'No expenses found'}</TableCell></TableRow>
            ) : paginated.map(e => (
              <TableRow key={e.id}>
                <TableCell>{formatDate(e.expense_date)}</TableCell>
                <TableCell><Badge variant="outline">{getCategoryLabel(e.category)}</Badge></TableCell>
                <TableCell>{isRTL && e.description_ar ? e.description_ar : e.description}</TableCell>
                <TableCell className="font-medium text-destructive">{e.amount} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                <TableCell>{e.is_recurring ? (isRTL ? 'نعم' : 'Yes') : '-'}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length > 0 && (
          <DataTablePagination currentPage={page} totalPages={totalPages} pageSize={pageSize} totalCount={filtered.length} hasNextPage={page < totalPages} hasPreviousPage={page > 1} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{isRTL ? 'إضافة مصروف جديد' : 'Add New Expense'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>{isRTL ? 'التصنيف' : 'Category'}</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{isRTL ? c.ar : c.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{isRTL ? 'الوصف (English)' : 'Description (English)'} *</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div><Label>{isRTL ? 'الوصف (عربي)' : 'Description (Arabic)'}</Label>
              <Input value={form.description_ar} onChange={e => setForm({ ...form, description_ar: e.target.value })} dir="rtl" />
            </div>
            <div><Label>{isRTL ? 'المبلغ' : 'Amount'} *</Label>
              <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div><Label>{isRTL ? 'التاريخ' : 'Date'}</Label>
              <Input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_recurring} onChange={e => setForm({ ...form, is_recurring: e.target.checked })} className="h-4 w-4" />
              <span className="text-sm">{isRTL ? 'مصروف متكرر شهرياً' : 'Monthly recurring expense'}</span>
            </label>
            <div><Label>{isRTL ? 'ملاحظات' : 'Notes'}</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? '...' : (isRTL ? 'إضافة' : 'Add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
