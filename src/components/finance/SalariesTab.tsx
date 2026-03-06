import { useState, useEffect } from 'react';
import { DollarSign, Check, Clock, Plus, Minus, Gift, AlertCircle, Lock, Unlock, RotateCcw, Wallet, Printer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { generateSalarySlip } from '@/lib/pdfReports';
import { getRoleLabel } from '@/lib/constants';
import { formatDate } from '@/lib/timeUtils';

interface SalaryEvent {
  id: string;
  employee_id: string;
  month: string;
  event_type: string;
  amount: number;
  description: string | null;
  description_ar: string | null;
  source: string;
  reference_id: string | null;
  is_reversal: boolean;
  reversed_event_id: string | null;
  metadata: any;
  created_by: string | null;
  created_at: string;
}

interface Snapshot {
  id: string;
  employee_id: string;
  month: string;
  base_amount: number;
  total_earnings: number;
  total_bonuses: number;
  total_deductions: number;
  net_amount: number;
  status: string;
  finalized_at: string | null;
  finalized_by: string | null;
}

export function SalariesTab() {
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [events, setEvents] = useState<SalaryEvent[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [salaryDialog, setSalaryDialog] = useState(false);
  const [adjustDialog, setAdjustDialog] = useState(false);
  const [payDialog, setPayDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Salary form
  const [salaryForm, setSalaryForm] = useState({ employee_id: '', employee_type: 'instructor', base_salary: '', effective_from: new Date().toISOString().split('T')[0] });

  // Adjustment form (bonus/deduction via salary_events)
  const [adjustForm, setAdjustForm] = useState({
    employee_id: '', month: currentMonthStr(),
    type: 'deduction' as 'deduction' | 'bonus',
    amount: 0, reason: '', reason_ar: '',
  });

  // Pay form
  const [payForm, setPayForm] = useState({ employee_id: '', month: currentMonthStr(), payment_method: 'cash', notes: '' });

  function currentMonthStr() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }

  const currentMonth = currentMonthStr();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [rolesRes, salariesRes, snapshotsRes, eventsRes, paymentsRes] = await Promise.all([
      supabase.from('user_roles').select('user_id, role').in('role', ['instructor', 'reception']),
      supabase.from('employee_salaries').select('*').eq('is_active', true),
      supabase.from('salary_month_snapshots').select('*').eq('month', currentMonth),
      supabase.from('salary_events').select('*').eq('month', currentMonth).order('created_at', { ascending: false }),
      supabase.from('salary_payments').select('*').order('month', { ascending: false }).limit(100),
    ]);

    const userIds = (rolesRes.data || []).map(r => r.user_id);
    const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', userIds.length > 0 ? userIds : ['none']).neq('employment_status', 'terminated');

    const roleMap = new Map((rolesRes.data || []).map(r => [r.user_id, r.role]));
    setEmployees((profiles || []).map(p => ({ ...p, role: roleMap.get(p.user_id) })));
    setSalaries(salariesRes.data || []);
    setSnapshots((snapshotsRes.data || []) as Snapshot[]);
    setEvents((eventsRes.data || []) as SalaryEvent[]);
    setSalaryPayments((paymentsRes.data || []).filter((p: any) => Number(p.base_amount) > 0));
    setLoading(false);
  };

  const getEmployeeSalary = (employeeId: string) => salaries.find(s => s.employee_id === employeeId);
  const getSnapshot = (employeeId: string) => snapshots.find(s => s.employee_id === employeeId);
  const getName = (emp: any) => language === 'ar' && emp.full_name_ar ? emp.full_name_ar : emp.full_name;

  // Summary stats
  const totalBaseSalaries = salaries.reduce((sum, s) => sum + Number(s.base_salary), 0);
  const totalNetThisMonth = snapshots.reduce((sum, s) => sum + Number(s.net_amount), 0);

  // --- Handlers ---

  const handleSetSalary = async () => {
    if (!salaryForm.employee_id || !salaryForm.base_salary) return;
    setSaving(true);
    await supabase.from('employee_salaries').update({ is_active: false } as any).eq('employee_id', salaryForm.employee_id).eq('is_active', true);
    const { error } = await supabase.from('employee_salaries').insert({
      employee_id: salaryForm.employee_id, employee_type: salaryForm.employee_type,
      base_salary: Number(salaryForm.base_salary), effective_from: salaryForm.effective_from,
    } as any);
    if (error) toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: error.message });
    else { toast({ title: isRTL ? 'تم تحديد الراتب' : 'Salary set' }); setSalaryDialog(false); fetchData(); }
    setSaving(false);
  };

  const handleAddEvent = async () => {
    if (!adjustForm.employee_id || !adjustForm.amount || adjustForm.amount <= 0) return;
    setSaving(true);
    const eventType = adjustForm.type === 'bonus' ? 'bonus' : 'deduction';
    const { error } = await supabase.from('salary_events').insert({
      employee_id: adjustForm.employee_id,
      month: adjustForm.month,
      event_type: eventType,
      amount: adjustForm.amount,
      description: adjustForm.reason || (adjustForm.type === 'bonus' ? 'Manual bonus' : 'Manual deduction'),
      description_ar: adjustForm.reason_ar || (adjustForm.type === 'bonus' ? 'بونص يدوي' : 'خصم يدوي'),
      source: 'manual',
      created_by: user?.id,
    } as any);
    if (error) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: error.message });
    } else {
      toast({ title: isRTL ? (adjustForm.type === 'bonus' ? 'تم تسجيل البونص' : 'تم تسجيل الخصم') : (adjustForm.type === 'bonus' ? 'Bonus recorded' : 'Deduction recorded') });
      setAdjustDialog(false);
      fetchData();
    }
    setSaving(false);
  };

  const handleLockMonth = async (employeeId: string) => {
    setSaving(true);
    const { error } = await supabase.from('salary_month_snapshots')
      .update({ status: 'locked', finalized_at: new Date().toISOString(), finalized_by: user?.id } as any)
      .eq('employee_id', employeeId).eq('month', currentMonth);
    if (error) toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: error.message });
    else { toast({ title: isRTL ? 'تم قفل الشهر' : 'Month locked' }); fetchData(); }
    setSaving(false);
  };

  const handleUnlockMonth = async (employeeId: string) => {
    setSaving(true);
    const { error } = await supabase.from('salary_month_snapshots')
      .update({ status: 'open', finalized_at: null, finalized_by: null } as any)
      .eq('employee_id', employeeId).eq('month', currentMonth);
    if (error) toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: error.message });
    else { toast({ title: isRTL ? 'تم فتح الشهر' : 'Month unlocked' }); fetchData(); }
    setSaving(false);
  };

  const handlePaySalary = async () => {
    if (!payForm.employee_id) return;
    setSaving(true);
    const snapshot = getSnapshot(payForm.employee_id);
    if (!snapshot || snapshot.status !== 'locked') {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'يجب قفل الشهر أولاً' : 'Month must be locked first' });
      setSaving(false); return;
    }

    // Create final salary_payments record
    const { error: payError } = await supabase.from('salary_payments').insert({
      employee_id: payForm.employee_id,
      salary_id: getEmployeeSalary(payForm.employee_id)?.id || null,
      month: payForm.month,
      base_amount: snapshot.base_amount,
      bonus: snapshot.total_bonuses,
      deductions: snapshot.total_deductions,
      status: 'paid',
      paid_date: new Date().toISOString().split('T')[0],
      paid_by: user?.id,
      payment_method: payForm.payment_method,
      notes: payForm.notes || null,
    } as any);

    if (payError) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: payError.message });
      setSaving(false); return;
    }

    // Update snapshot status to paid
    await supabase.from('salary_month_snapshots')
      .update({ status: 'paid' } as any)
      .eq('employee_id', payForm.employee_id).eq('month', currentMonth);

    toast({ title: isRTL ? 'تم صرف الراتب' : 'Salary paid' });
    setPayDialog(false);
    fetchData();
    setSaving(false);
  };

  const handleReverseEvent = async (event: SalaryEvent) => {
    setSaving(true);
    const { error } = await supabase.from('salary_events').insert({
      employee_id: event.employee_id,
      month: event.month,
      event_type: event.event_type,
      amount: event.amount,
      description: `Reversal: ${event.description || ''}`,
      description_ar: `عكس: ${event.description_ar || ''}`,
      source: event.source,
      is_reversal: true,
      reversed_event_id: event.id,
      created_by: user?.id,
      metadata: { reversed_event: event.id },
    } as any);
    if (error) toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: error.message });
    else { toast({ title: isRTL ? 'تم عكس الحركة' : 'Event reversed' }); fetchData(); }
    setSaving(false);
  };

  const openAdjustDialog = (emp: any, type: 'deduction' | 'bonus') => {
    setAdjustForm({ employee_id: emp.user_id, month: currentMonth, type, amount: 0, reason: '', reason_ar: '' });
    setSelectedEmployee(emp);
    setAdjustDialog(true);
  };

  const openSalaryDialog = (emp?: any) => {
    const existingSalary = emp ? getEmployeeSalary(emp.user_id) : null;
    setSalaryForm({
      employee_id: emp?.user_id || '', employee_type: emp?.role || 'instructor',
      base_salary: existingSalary?.base_salary?.toString() || '',
      effective_from: new Date().toISOString().split('T')[0],
    });
    setSelectedEmployee(emp || null);
    setSalaryDialog(true);
  };

  const openPayDialog = (emp: any) => {
    setPayForm({ employee_id: emp.user_id, month: currentMonth, payment_method: 'cash', notes: '' });
    setSelectedEmployee(emp);
    setPayDialog(true);
  };

  const getStatusBadge = (snapshot: Snapshot | undefined) => {
    if (!snapshot) return <Badge variant="outline" className="text-muted-foreground">{isRTL ? 'بدون حركات' : 'No events'}</Badge>;
    switch (snapshot.status) {
      case 'paid': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><Check className="h-3 w-3 mr-1" />{isRTL ? 'مصروف' : 'Paid'}</Badge>;
      case 'locked': return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"><Lock className="h-3 w-3 mr-1" />{isRTL ? 'مقفول' : 'Locked'}</Badge>;
      default: return <Badge variant="outline" className="border-blue-500 text-blue-600"><Unlock className="h-3 w-3 mr-1" />{isRTL ? 'مفتوح' : 'Open'}</Badge>;
    }
  };

  const getEventTypeBadge = (event: SalaryEvent) => {
    if (event.is_reversal) return <Badge variant="outline" className="text-muted-foreground">{isRTL ? 'عكس' : 'Reversal'}</Badge>;
    switch (event.event_type) {
      case 'bonus': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">{isRTL ? 'بونص' : 'Bonus'}</Badge>;
      case 'deduction': return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">{isRTL ? 'خصم' : 'Deduction'}</Badge>;
      case 'warning_deduction': return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">{isRTL ? 'خصم إنذار' : 'Warning'}</Badge>;
      case 'hourly_earning': return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">{isRTL ? 'ساعات' : 'Hourly'}</Badge>;
      case 'base_salary': return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">{isRTL ? 'أساسي' : 'Base'}</Badge>;
      default: return <Badge variant="outline">{event.event_type}</Badge>;
    }
  };

  const isPositiveEvent = (event: SalaryEvent) => {
    const positiveTypes = ['bonus', 'base_salary', 'hourly_earning'];
    return event.is_reversal ? !positiveTypes.includes(event.event_type) : positiveTypes.includes(event.event_type);
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: isRTL ? 'إجمالي الرواتب الأساسية' : 'Total Base Salaries', value: `${totalBaseSalaries} ${isRTL ? 'ج.م' : 'EGP'}`, icon: DollarSign, gradient: 'from-purple-500 to-purple-600' },
          { label: isRTL ? 'صافي الشهر الحالي' : 'Current Month Net', value: `${totalNetThisMonth} ${isRTL ? 'ج.م' : 'EGP'}`, icon: Wallet, gradient: 'from-emerald-500 to-emerald-600' },
          { label: isRTL ? 'عدد الموظفين' : 'Employees', value: employees.length, icon: Clock, gradient: 'from-blue-500 to-blue-600' },
          { label: isRTL ? 'حركات الشهر' : 'Month Events', value: events.length, icon: AlertCircle, gradient: 'from-amber-500 to-orange-500' },
        ].map(stat => (
          <Card key={stat.label} className="relative overflow-hidden hover:shadow-md transition-all duration-300">
            <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${stat.gradient}`} />
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="employees">
        <TabsList className="h-auto gap-1 bg-muted/60 p-1.5 rounded-xl">
          <TabsTrigger value="employees" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2 text-sm"><Wallet className="h-4 w-4 mr-1.5" />{isRTL ? 'المحافظ' : 'Wallets'}</TabsTrigger>
          <TabsTrigger value="ledger" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2 text-sm">{isRTL ? 'سجل الحركات' : 'Event Ledger'}</TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2 text-sm">{isRTL ? 'سجل الصرف' : 'Payment History'}</TabsTrigger>
        </TabsList>

        {/* ==================== TAB 1: Employee Wallets ==================== */}
        <TabsContent value="employees">
          <Card className="border-0 shadow-sm"><CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableHead className="font-semibold">{isRTL ? 'الاسم' : 'Name'}</TableHead>
                  <TableHead className="font-semibold">{isRTL ? 'الدور' : 'Role'}</TableHead>
                  <TableHead className="font-semibold">{isRTL ? 'الراتب الأساسي' : 'Base Salary'}</TableHead>
                  <TableHead className="font-semibold">{isRTL ? 'الرصيد الحالي' : 'Current Balance'}</TableHead>
                  <TableHead className="font-semibold">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead className="font-semibold">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">{isRTL ? 'جاري التحميل...' : 'Loading...'}</TableCell></TableRow>
                ) : employees.map(emp => {
                  const salary = getEmployeeSalary(emp.user_id);
                  const snapshot = getSnapshot(emp.user_id);
                  const isHourly = emp.is_paid_trainee && emp.hourly_rate;
                  const baseDisplay = isHourly
                    ? `${emp.hourly_rate} ${isRTL ? 'ج.م/ساعة' : 'EGP/hr'}`
                    : salary ? `${salary.base_salary} ${isRTL ? 'ج.م' : 'EGP'}` : (isRTL ? 'غير محدد' : 'Not set');

                  return (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{getName(emp)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getRoleLabel(emp.role, isRTL)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={salary || isHourly ? 'font-medium' : 'text-muted-foreground'}>{baseDisplay}</span>
                      </TableCell>
                      <TableCell>
                        {snapshot ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="font-bold text-lg">{snapshot.net_amount} {isRTL ? 'ج.م' : 'EGP'}</span>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs space-y-1">
                                <p>{isRTL ? 'أساسي' : 'Base'}: {snapshot.base_amount}</p>
                                {snapshot.total_earnings > 0 && <p className="text-blue-600">+{isRTL ? 'ساعات' : 'Earnings'}: {snapshot.total_earnings}</p>}
                                {snapshot.total_bonuses > 0 && <p className="text-green-600">+{isRTL ? 'بونص' : 'Bonuses'}: {snapshot.total_bonuses}</p>}
                                {snapshot.total_deductions > 0 && <p className="text-destructive">-{isRTL ? 'خصومات' : 'Deductions'}: {snapshot.total_deductions}</p>}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-muted-foreground">{salary ? `${salary.base_salary} ${isRTL ? 'ج.م' : 'EGP'}` : '-'}</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(snapshot)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {emp.employment_status === 'permanent' && (
                            <Button size="sm" variant="outline" onClick={() => openSalaryDialog(emp)}>
                              {isRTL ? 'تحديد راتب' : 'Set Salary'}
                            </Button>
                          )}
                          {(!snapshot || snapshot.status === 'open') && (
                            <>
                              <Button size="sm" variant="outline" className="text-green-600 border-green-500/50" onClick={() => openAdjustDialog(emp, 'bonus')}>
                                <Gift className="h-3 w-3 mr-1" />{isRTL ? 'بونص' : 'Bonus'}
                              </Button>
                              <Button size="sm" variant="outline" className="text-destructive border-destructive/50" onClick={() => openAdjustDialog(emp, 'deduction')}>
                                <Minus className="h-3 w-3 mr-1" />{isRTL ? 'خصم' : 'Deduct'}
                              </Button>
                            </>
                          )}
                          {snapshot && snapshot.status === 'open' && (
                            <Button size="sm" variant="outline" onClick={() => handleLockMonth(emp.user_id)} disabled={saving}>
                              <Lock className="h-3 w-3 mr-1" />{isRTL ? 'قفل' : 'Lock'}
                            </Button>
                          )}
                          {snapshot && snapshot.status === 'locked' && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleUnlockMonth(emp.user_id)} disabled={saving}>
                                <Unlock className="h-3 w-3 mr-1" />{isRTL ? 'فتح' : 'Unlock'}
                              </Button>
                              <Button size="sm" onClick={() => openPayDialog(emp)} disabled={saving}>
                                <DollarSign className="h-3 w-3 mr-1" />{isRTL ? 'صرف' : 'Pay'}
                              </Button>
                            </>
                          )}
                          {snapshot && (
                            <Button size="sm" variant="ghost" onClick={() => {
                              const monthDate = new Date(snapshot.month);
                              const monthLabel = formatDate(snapshot.month, language);
                              generateSalarySlip(
                                { name: getName(emp), email: emp.email, type: getRoleLabel(emp.role === 'reception' ? 'reception' : 'instructor', isRTL) },
                                { month: monthLabel, baseSalary: Number(snapshot.base_amount), earnings: Number(snapshot.total_earnings), bonuses: Number(snapshot.total_bonuses), deductions: Number(snapshot.total_deductions), netAmount: Number(snapshot.net_amount) },
                                isRTL,
                              );
                            }}>
                              <Printer className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* ==================== TAB 2: Event Ledger ==================== */}
        <TabsContent value="ledger">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                  <TableHead>{isRTL ? 'الموظف' : 'Employee'}</TableHead>
                  <TableHead>{isRTL ? 'النوع' : 'Type'}</TableHead>
                  <TableHead>{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                  <TableHead>{isRTL ? 'الوصف' : 'Description'}</TableHead>
                  <TableHead>{isRTL ? 'المصدر' : 'Source'}</TableHead>
                  <TableHead>{isRTL ? 'إجراء' : 'Action'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{isRTL ? 'لا توجد حركات هذا الشهر' : 'No events this month'}</TableCell></TableRow>
                ) : events.map(event => {
                  const emp = employees.find(e => e.user_id === event.employee_id);
                  const positive = isPositiveEvent(event);
                  const snapshot = getSnapshot(event.employee_id);
                  const isReversed = events.some(e => e.reversed_event_id === event.id);
                  return (
                    <TableRow key={event.id} className={event.is_reversal ? 'opacity-60' : ''}>
                      <TableCell className="text-sm">{new Date(event.created_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                      <TableCell className="font-medium">{emp ? getName(emp) : event.employee_id.slice(0, 8)}</TableCell>
                      <TableCell>{getEventTypeBadge(event)}</TableCell>
                      <TableCell className={`font-bold ${positive ? 'text-green-600' : 'text-destructive'}`}>
                        {positive ? '+' : '-'}{event.amount} {isRTL ? 'ج.م' : 'EGP'}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {isRTL ? (event.description_ar || event.description) : (event.description || event.description_ar) || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{event.source}</Badge>
                      </TableCell>
                      <TableCell>
                        {!event.is_reversal && !isReversed && snapshot?.status !== 'paid' && (
                          <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => handleReverseEvent(event)} disabled={saving}>
                            <RotateCcw className="h-3 w-3 mr-1" />{isRTL ? 'عكس' : 'Reverse'}
                          </Button>
                        )}
                        {isReversed && <span className="text-xs text-muted-foreground">{isRTL ? 'تم عكسه' : 'Reversed'}</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* ==================== TAB 3: Payment History ==================== */}
        <TabsContent value="history">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? 'الشهر' : 'Month'}</TableHead>
                  <TableHead>{isRTL ? 'الموظف' : 'Employee'}</TableHead>
                  <TableHead>{isRTL ? 'الأساسي' : 'Base'}</TableHead>
                  <TableHead>{isRTL ? 'بونص' : 'Bonus'}</TableHead>
                  <TableHead>{isRTL ? 'خصومات' : 'Deductions'}</TableHead>
                  <TableHead>{isRTL ? 'الصافي' : 'Net'}</TableHead>
                  <TableHead>{isRTL ? 'التاريخ' : 'Paid Date'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaryPayments.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{isRTL ? 'لا يوجد سجلات صرف' : 'No payment records'}</TableCell></TableRow>
                ) : salaryPayments.map(p => {
                  const emp = employees.find(e => e.user_id === p.employee_id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.month, language)}</TableCell>
                      <TableCell className="font-medium">{emp ? getName(emp) : p.employee_id}</TableCell>
                      <TableCell>{p.base_amount} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                      <TableCell className="text-green-600">{Number(p.bonus) > 0 ? `+${p.bonus}` : '-'}</TableCell>
                      <TableCell className="text-destructive">{Number(p.deductions) > 0 ? `-${p.deductions}` : '-'}</TableCell>
                      <TableCell className="font-bold">{p.net_amount} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                      <TableCell className="text-sm">{p.paid_date || '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* ==================== Set Salary Dialog ==================== */}
      <Dialog open={salaryDialog} onOpenChange={setSalaryDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{isRTL ? 'تحديد راتب' : 'Set Salary'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            {selectedEmployee && (
              <div className="p-3 rounded-lg border bg-muted/50">
                <p className="font-medium">{getName(selectedEmployee)}</p>
                <p className="text-sm text-muted-foreground">{selectedEmployee.email}</p>
              </div>
            )}
            {!selectedEmployee && (
              <div>
                <Label>{isRTL ? 'الموظف' : 'Employee'}</Label>
                <Select value={salaryForm.employee_id} onValueChange={v => setSalaryForm({ ...salaryForm, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر موظف' : 'Select employee'} /></SelectTrigger>
                  <SelectContent>{employees.map(e => <SelectItem key={e.user_id} value={e.user_id}>{getName(e)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label>{isRTL ? 'الراتب الأساسي (ج.م)' : 'Base Salary (EGP)'} *</Label>
              <Input type="number" value={salaryForm.base_salary} onChange={e => setSalaryForm({ ...salaryForm, base_salary: e.target.value })} />
            </div>
            <div><Label>{isRTL ? 'ساري من تاريخ' : 'Effective From'}</Label>
              <Input type="date" value={salaryForm.effective_from} onChange={e => setSalaryForm({ ...salaryForm, effective_from: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalaryDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleSetSalary} disabled={saving}>{saving ? '...' : (isRTL ? 'حفظ' : 'Save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Bonus/Deduction Event Dialog ==================== */}
      <Dialog open={adjustDialog} onOpenChange={setAdjustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {adjustForm.type === 'deduction' ? (isRTL ? 'تسجيل خصم' : 'Record Deduction') : (isRTL ? 'تسجيل بونص' : 'Record Bonus')}
            </DialogTitle>
            <DialogDescription>
              {isRTL ? 'سيتم إضافة حركة مالية في دفتر القيود وتحديث الرصيد تلقائياً' : 'A financial event will be added to the ledger and the balance will update automatically'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedEmployee && (
              <div className="p-3 rounded-lg border bg-muted/50">
                <p className="font-medium">{getName(selectedEmployee)}</p>
                {(() => { const s = getSnapshot(selectedEmployee.user_id); return s ? <p className="text-sm text-muted-foreground">{isRTL ? 'الرصيد الحالي' : 'Current balance'}: {s.net_amount} {isRTL ? 'ج.م' : 'EGP'}</p> : null; })()}
              </div>
            )}
            <div><Label>{isRTL ? 'المبلغ (ج.م)' : 'Amount (EGP)'} *</Label>
              <Input type="number" min="1" value={adjustForm.amount || ''} onChange={e => setAdjustForm({ ...adjustForm, amount: +e.target.value })} />
            </div>
            <div><Label>{isRTL ? 'السبب (English)' : 'Reason (English)'}</Label>
              <Input value={adjustForm.reason} onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })} />
            </div>
            <div><Label>{isRTL ? 'السبب (عربي)' : 'Reason (Arabic)'}</Label>
              <Input value={adjustForm.reason_ar} onChange={e => setAdjustForm({ ...adjustForm, reason_ar: e.target.value })} dir="rtl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button
              onClick={handleAddEvent}
              disabled={saving || !adjustForm.amount}
              className={adjustForm.type === 'deduction' ? 'bg-destructive hover:bg-destructive/90' : 'bg-green-600 hover:bg-green-700'}
            >
              {saving ? '...' : adjustForm.type === 'deduction' ? (isRTL ? 'تسجيل الخصم' : 'Record Deduction') : (isRTL ? 'تسجيل البونص' : 'Record Bonus')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== Pay Salary Dialog ==================== */}
      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? 'صرف راتب' : 'Pay Salary'}</DialogTitle>
            <DialogDescription>
              {isRTL ? 'سيتم إنشاء سجل صرف نهائي وقفل الشهر' : 'A final payment record will be created and the month will be closed'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedEmployee && (() => {
              const snapshot = getSnapshot(selectedEmployee.user_id);
              return snapshot ? (
                <div className="p-4 rounded-lg border bg-muted/50 space-y-2">
                  <p className="font-medium">{getName(selectedEmployee)}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">{isRTL ? 'الأساسي' : 'Base'}:</span>
                    <span>{snapshot.base_amount} {isRTL ? 'ج.م' : 'EGP'}</span>
                    {snapshot.total_bonuses > 0 && (<><span className="text-green-600">{isRTL ? 'بونص' : 'Bonuses'}:</span><span className="text-green-600">+{snapshot.total_bonuses}</span></>)}
                    {snapshot.total_deductions > 0 && (<><span className="text-destructive">{isRTL ? 'خصومات' : 'Deductions'}:</span><span className="text-destructive">-{snapshot.total_deductions}</span></>)}
                    {snapshot.total_earnings > 0 && (<><span className="text-blue-600">{isRTL ? 'ساعات' : 'Earnings'}:</span><span className="text-blue-600">+{snapshot.total_earnings}</span></>)}
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold text-lg">
                    <span>{isRTL ? 'الصافي' : 'Net Pay'}</span>
                    <span>{snapshot.net_amount} {isRTL ? 'ج.م' : 'EGP'}</span>
                  </div>
                </div>
              ) : null;
            })()}
            <div><Label>{isRTL ? 'طريقة الدفع' : 'Payment Method'}</Label>
              <Select value={payForm.payment_method} onValueChange={v => setPayForm({ ...payForm, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{isRTL ? 'كاش' : 'Cash'}</SelectItem>
                  <SelectItem value="transfer">{isRTL ? 'تحويل بنكي' : 'Bank Transfer'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{isRTL ? 'ملاحظات' : 'Notes'}</Label>
              <Input value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handlePaySalary} disabled={saving}>{saving ? '...' : (isRTL ? 'صرف الراتب' : 'Pay Salary')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
