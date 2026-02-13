import { useState, useEffect } from 'react';
import { DollarSign, Check, Clock, Plus, Minus, Gift, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface HourlyData {
  totalHours: number;
  roundedHours: number;
  totalPay: number;
  hasInferred: boolean;
  sessions: { date: string; groupName: string; hours: number; status: string }[];
}

export function SalariesTab() {
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hourlyDataMap, setHourlyDataMap] = useState<Record<string, HourlyData>>({});
  const [warningDeductionsMap, setWarningDeductionsMap] = useState<Record<string, { total: number; details: { type: string; count: number; amount: number }[] }>>({});
  const [monthAdjustmentsMap, setMonthAdjustmentsMap] = useState<Record<string, { totalDeductions: number; totalBonuses: number }>>({});

  // Dialogs
  const [salaryDialog, setSalaryDialog] = useState(false);
  const [payDialog, setPayDialog] = useState(false);
  const [adjustDialog, setAdjustDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Salary form
  const [salaryForm, setSalaryForm] = useState({ employee_id: '', employee_type: 'instructor', base_salary: '', effective_from: new Date().toISOString().split('T')[0] });

  // Pay form
  const [payForm, setPayForm] = useState({
    employee_id: '', salary_id: '', month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`,
    base_amount: 0, payment_method: 'cash', notes: '',
  });
  const [autoDeductions, setAutoDeductions] = useState<{ warning_type: string; count: number; amount: number }[]>([]);
  const [loadingDeductions, setLoadingDeductions] = useState(false);

  // Adjustment form
  const [adjustForm, setAdjustForm] = useState({
    employee_id: '', salary_id: '', month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`,
    type: 'deduction' as 'deduction' | 'bonus',
    amount: 0, reason: '', reason_ar: '', payment_method: 'cash', notes: '',
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('role', ['instructor', 'reception']);
    const userIds = (roles || []).map(r => r.user_id);
    const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', userIds.length > 0 ? userIds : ['none']);
    
    const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));
    const enriched = (profiles || []).map(p => ({ ...p, role: roleMap.get(p.user_id) }));
    setEmployees(enriched);

    const { data: sals } = await supabase.from('employee_salaries').select('*').eq('is_active', true);
    setSalaries(sals || []);

    const { data: pays } = await supabase.from('salary_payments').select('*').order('month', { ascending: false }).limit(100);
    setSalaryPayments(pays || []);

    // Fetch hourly data for paid trainees
    const paidTrainees = enriched.filter(e => e.is_paid_trainee && e.hourly_rate);
    if (paidTrainees.length > 0) {
      await fetchHourlyData(paidTrainees);
    }

    // Precompute warning-based deductions for all employees
    await fetchWarningDeductions(userIds);

    // Compute current month manual adjustments (deductions/bonuses)
    const cm = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
    const adjMap: Record<string, { totalDeductions: number; totalBonuses: number }> = {};
    (pays || []).forEach((p: any) => {
      if (p.month !== cm) return;
      if (!adjMap[p.employee_id]) adjMap[p.employee_id] = { totalDeductions: 0, totalBonuses: 0 };
      // Only count adjustment records (base_amount = 0) for manual adjustments
      if (Number(p.base_amount) === 0) {
        adjMap[p.employee_id].totalDeductions += Number(p.deductions || 0);
        adjMap[p.employee_id].totalBonuses += Number(p.bonus || 0);
      }
    });
    setMonthAdjustmentsMap(adjMap);

    setLoading(false);
  };

  const fetchWarningDeductions = async (userIds: string[]) => {
    if (userIds.length === 0) return;
    const [warningsRes, rulesRes] = await Promise.all([
      supabase.from('instructor_warnings').select('instructor_id, warning_type').eq('is_active', true).in('instructor_id', userIds),
      supabase.from('warning_deduction_rules').select('*').eq('is_active', true),
    ]);
    const warnings = warningsRes.data || [];
    const rules = (rulesRes.data || []) as any[];

    const map: Record<string, { total: number; details: { type: string; count: number; amount: number }[] }> = {};
    userIds.forEach(uid => {
      const myWarnings = warnings.filter(w => w.instructor_id === uid);
      const countByType: Record<string, number> = {};
      myWarnings.forEach(w => { countByType[w.warning_type] = (countByType[w.warning_type] || 0) + 1; });

      const details: { type: string; count: number; amount: number }[] = [];
      rules.forEach(rule => {
        const actualCount = countByType[rule.warning_type] || 0;
        if (actualCount >= rule.warning_count) {
          details.push({ type: rule.warning_type, count: actualCount, amount: rule.deduction_amount });
        }
      });
      if (details.length > 0) {
        map[uid] = { total: details.reduce((s, d) => s + d.amount, 0), details };
      }
    });
    setWarningDeductionsMap(map);
  };

  const fetchHourlyData = async (paidTrainees: any[]) => {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const staffIds = paidTrainees.map(t => t.user_id);
    
    // Fetch attendance records for all paid trainees this month
    const { data: attendanceData } = await supabase
      .from('session_staff_attendance')
      .select('staff_id, actual_hours, status, session_id')
      .in('staff_id', staffIds)
      .in('status', ['confirmed', 'inferred']);

    // Fetch session dates to filter by month
    const sessionIds = [...new Set((attendanceData || []).map(a => a.session_id))];
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, session_date, group_id')
      .in('id', sessionIds.length > 0 ? sessionIds : ['none'])
      .gte('session_date', monthStart)
      .lte('session_date', monthEnd);

    const sessionMap = new Map((sessions || []).map(s => [s.id, s]));

    // Fetch group names
    const groupIds = [...new Set((sessions || []).map(s => s.group_id))];
    const { data: groups } = await supabase
      .from('groups')
      .select('id, name, name_ar')
      .in('id', groupIds.length > 0 ? groupIds : ['none']);
    const groupMap = new Map((groups || []).map(g => [g.id, g]));

    const dataMap: Record<string, HourlyData> = {};
    
    paidTrainees.forEach(trainee => {
      const myAttendance = (attendanceData || []).filter(a => {
        if (a.staff_id !== trainee.user_id) return false;
        const sess = sessionMap.get(a.session_id);
        return !!sess; // Only sessions in current month range
      });

      const totalHours = myAttendance.reduce((sum, a) => sum + Number(a.actual_hours), 0);
      const roundedHours = Math.round(totalHours * 4) / 4;
      const hasInferred = myAttendance.some(a => a.status === 'inferred');

      const sessionDetails = myAttendance.map(a => {
        const sess = sessionMap.get(a.session_id);
        const grp = sess ? groupMap.get(sess.group_id) : null;
        return {
          date: sess?.session_date || '',
          groupName: language === 'ar' ? (grp?.name_ar || grp?.name || '') : (grp?.name || ''),
          hours: Number(a.actual_hours),
          status: a.status,
        };
      }).sort((a, b) => a.date.localeCompare(b.date));

      dataMap[trainee.user_id] = {
        totalHours,
        roundedHours,
        totalPay: roundedHours * (trainee.hourly_rate || 0),
        hasInferred,
        sessions: sessionDetails,
      };
    });

    setHourlyDataMap(dataMap);
  };

  const getEmployeeSalary = (employeeId: string) => salaries.find(s => s.employee_id === employeeId);
  const getEmployeePayment = (employeeId: string, month: string) => salaryPayments.find(p => p.employee_id === employeeId && p.month === month && Number(p.base_amount) > 0);

  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

  const handleSetSalary = async () => {
    if (!salaryForm.employee_id || !salaryForm.base_salary) return;
    setSaving(true);
    await supabase.from('employee_salaries').update({ is_active: false } as any).eq('employee_id', salaryForm.employee_id).eq('is_active', true);
    const { error } = await supabase.from('employee_salaries').insert({
      employee_id: salaryForm.employee_id, employee_type: salaryForm.employee_type,
      base_salary: Number(salaryForm.base_salary), effective_from: salaryForm.effective_from,
    } as any);
    if (error) { toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: error.message }); }
    else { toast({ title: isRTL ? 'تم تحديد الراتب' : 'Salary set successfully' }); setSalaryDialog(false); fetchData(); }
    setSaving(false);
  };

  const handlePaySalary = async () => {
    if (!payForm.employee_id) return;
    setSaving(true);
    const totalAutoDeduction = autoDeductions.reduce((sum, d) => sum + d.amount, 0);
    const deductionReasons = autoDeductions.map(d => `${d.warning_type}(×${d.count}): -${d.amount}`).join(', ');
    const { error } = await supabase.from('salary_payments').insert({
      employee_id: payForm.employee_id, salary_id: payForm.salary_id || null,
      month: payForm.month, base_amount: payForm.base_amount,
      deductions: totalAutoDeduction, bonus: 0,
      deduction_reason: deductionReasons || null,
      deduction_reason_ar: deductionReasons || null,
      status: 'paid', paid_date: new Date().toISOString().split('T')[0],
      paid_by: user?.id, payment_method: payForm.payment_method, notes: payForm.notes || null,
    } as any);
    if (error) { toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: error.message }); }
    else { toast({ title: isRTL ? 'تم صرف الراتب' : 'Salary paid successfully' }); setPayDialog(false); fetchData(); }
    setSaving(false);
  };

  const handleAdjustment = async () => {
    if (!adjustForm.employee_id || !adjustForm.amount) return;
    setSaving(true);
    const isDeduction = adjustForm.type === 'deduction';
    const { error } = await supabase.from('salary_payments').insert({
      employee_id: adjustForm.employee_id, salary_id: adjustForm.salary_id || null,
      month: adjustForm.month, base_amount: 0,
      deductions: isDeduction ? adjustForm.amount : 0,
      bonus: !isDeduction ? adjustForm.amount : 0,
      deduction_reason: isDeduction ? adjustForm.reason : null,
      deduction_reason_ar: isDeduction ? adjustForm.reason_ar : null,
      bonus_reason: !isDeduction ? adjustForm.reason : null,
      bonus_reason_ar: !isDeduction ? adjustForm.reason_ar : null,
      status: 'paid', paid_date: new Date().toISOString().split('T')[0],
      paid_by: user?.id, payment_method: adjustForm.payment_method, notes: adjustForm.notes || null,
    } as any);
    if (error) { toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: error.message }); }
    else {
      toast({ title: isRTL ? (isDeduction ? 'تم تسجيل الخصم' : 'تم تسجيل البونص') : (isDeduction ? 'Deduction recorded' : 'Bonus recorded') });
      setAdjustDialog(false); fetchData();
    }
    setSaving(false);
  };

  const openPayDialog = async (emp: any) => {
    const salary = getEmployeeSalary(emp.user_id);
    const isHourly = emp.is_paid_trainee && emp.hourly_rate;
    const hourlyData = hourlyDataMap[emp.user_id];
    const baseAmount = isHourly ? (hourlyData?.totalPay || 0) : (salary?.base_salary || 0);

    setPayForm({
      employee_id: emp.user_id, salary_id: salary?.id || '', month: currentMonth,
      base_amount: baseAmount, payment_method: 'cash', notes: '',
    });
    setSelectedEmployee(emp);
    // Use precomputed warning deductions
    const warnData = warningDeductionsMap[emp.user_id];
    if (warnData) {
      setAutoDeductions(warnData.details.map(d => ({ warning_type: d.type, count: d.count, amount: d.amount })));
    } else {
      setAutoDeductions([]);
    }
    setLoadingDeductions(false);
    setPayDialog(true);
  };

  const openAdjustDialog = (emp: any, type: 'deduction' | 'bonus') => {
    const salary = getEmployeeSalary(emp.user_id);
    setAdjustForm({
      employee_id: emp.user_id, salary_id: salary?.id || '', month: currentMonth,
      type, amount: 0, reason: '', reason_ar: '', payment_method: 'cash', notes: '',
    });
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

  const getName = (emp: any) => language === 'ar' && emp.full_name_ar ? emp.full_name_ar : emp.full_name;
  const totalFixedSalaries = salaries.reduce((sum, s) => sum + Number(s.base_salary), 0);
  const totalHourlySalaries = Object.values(hourlyDataMap).reduce((sum, d) => sum + (d.totalPay || 0), 0);
  const totalMonthlySalaries = totalFixedSalaries + totalHourlySalaries;

  const getBaseSalaryDisplay = (emp: any) => {
    const salary = getEmployeeSalary(emp.user_id);
    const isHourly = emp.is_paid_trainee && emp.hourly_rate;

    if (isHourly) {
      const hourlyData = hourlyDataMap[emp.user_id];
      if (hourlyData) {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <span className="font-medium">
                    {hourlyData.roundedHours} {isRTL ? 'س' : 'hrs'} = {hourlyData.totalPay} {isRTL ? 'ج.م' : 'EGP'}
                  </span>
                  {hourlyData.hasInferred && (
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="text-xs space-y-1">
                  <p>{isRTL ? `سعر الساعة: ${emp.hourly_rate} ج.م` : `Rate: ${emp.hourly_rate} EGP/hr`}</p>
                  <p>{isRTL ? `إجمالي الساعات: ${hourlyData.totalHours}` : `Total hours: ${hourlyData.totalHours}`}</p>
                  <p>{isRTL ? `بعد التقريب: ${hourlyData.roundedHours}` : `Rounded: ${hourlyData.roundedHours}`}</p>
                  {hourlyData.hasInferred && (
                    <p className="text-amber-500">{isRTL ? '⚠ يتضمن بيانات تقديرية' : '⚠ Includes estimated data'}</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
      return <span className="text-muted-foreground">{emp.hourly_rate} {isRTL ? 'ج.م/ساعة' : 'EGP/hr'}</span>;
    }

    if (salary) {
      return <span className="font-medium">{salary.base_salary} {isRTL ? 'ج.م' : 'EGP'}</span>;
    }

    return <span className="text-muted-foreground">{isRTL ? 'غير محدد' : 'Not set'}</span>;
  };

  const canPay = (emp: any) => {
    const salary = getEmployeeSalary(emp.user_id);
    const isHourly = emp.is_paid_trainee && emp.hourly_rate;
    const paid = getEmployeePayment(emp.user_id, currentMonth);
    if (paid) return false;
    if (isHourly) {
      const hourlyData = hourlyDataMap[emp.user_id];
      return hourlyData && hourlyData.roundedHours > 0;
    }
    return !!salary;
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{isRTL ? 'إجمالي الرواتب الشهرية' : 'Total Monthly Salaries'}</p>
          <p className="text-2xl font-bold text-destructive">{totalMonthlySalaries} {isRTL ? 'ج.م' : 'EGP'}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{isRTL ? 'عدد الموظفين' : 'Employees'}</p>
          <p className="text-2xl font-bold">{employees.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{isRTL ? 'بدون راتب محدد' : 'No Salary Set'}</p>
          <p className="text-2xl font-bold text-orange-600">{employees.filter(e => !getEmployeeSalary(e.user_id) && !(e.is_paid_trainee && e.hourly_rate)).length}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">{isRTL ? 'الموظفين' : 'Employees'}</TabsTrigger>
          <TabsTrigger value="history">{isRTL ? 'سجل الصرف' : 'Payment History'}</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                  <TableHead>{isRTL ? 'الدور' : 'Role'}</TableHead>
                  <TableHead>{isRTL ? 'نوع العمل' : 'Work Type'}</TableHead>
                   <TableHead>{isRTL ? 'الراتب الأساسي' : 'Base Salary'}</TableHead>
                   <TableHead>{isRTL ? 'صافي تقديري' : 'Est. Net'}</TableHead>
                   <TableHead>{isRTL ? 'حالة الشهر' : 'This Month'}</TableHead>
                   <TableHead>{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">{isRTL ? 'جاري التحميل...' : 'Loading...'}</TableCell></TableRow>
                ) : employees.map(emp => {
                  const paid = getEmployeePayment(emp.user_id, currentMonth);
                  const salary = getEmployeeSalary(emp.user_id);
                  const isHourly = emp.is_paid_trainee && emp.hourly_rate;
                  const hourlyData = hourlyDataMap[emp.user_id];
                  const baseAmount = isHourly ? (hourlyData?.totalPay || 0) : (salary?.base_salary || 0);
                  const warnDeductions = warningDeductionsMap[emp.user_id];
                  const manualAdj = monthAdjustmentsMap[emp.user_id];
                  const autoDeductionTotal = warnDeductions?.total || 0;
                  const manualDeductions = manualAdj?.totalDeductions || 0;
                  const manualBonuses = manualAdj?.totalBonuses || 0;
                  const estimatedNet = baseAmount - autoDeductionTotal - manualDeductions + manualBonuses;
                  return (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{getName(emp)}</TableCell>
                      <TableCell>
                        <Badge>{emp.role === 'admin' ? (isRTL ? 'مدير' : 'Admin') : emp.role === 'reception' ? (isRTL ? 'ريسيبشن' : 'Reception') : (isRTL ? 'مدرب' : 'Instructor')}</Badge>
                      </TableCell>
                      <TableCell>
                        {emp.employment_status === 'permanent' ? (
                          <Badge variant="outline" className={emp.work_type === 'part_time' ? 'border-purple-500 text-purple-600' : 'border-blue-500 text-blue-600'}>
                            {emp.work_type === 'part_time' ? (isRTL ? 'بارت تايم' : 'Part-time') : (isRTL ? 'فول تايم' : 'Full-time')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-500 text-amber-600">
                            {isRTL ? 'تدريب' : 'Training'}
                            {emp.is_paid_trainee && ` (${emp.hourly_rate} ${isRTL ? 'ج.م/ساعة' : 'EGP/hr'})`}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {getBaseSalaryDisplay(emp)}
                      </TableCell>
                      <TableCell>
                        {baseAmount > 0 ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="space-y-0.5">
                                  <span className={`font-bold text-sm ${estimatedNet < baseAmount ? 'text-destructive' : 'text-green-600'}`}>
                                    {estimatedNet} {isRTL ? 'ج.م' : 'EGP'}
                                  </span>
                                  {(autoDeductionTotal > 0 || manualDeductions > 0 || manualBonuses > 0) && (
                                    <div className="flex gap-1 flex-wrap">
                                      {autoDeductionTotal > 0 && <Badge variant="outline" className="text-[10px] px-1 py-0 text-destructive border-destructive/30">-{autoDeductionTotal}</Badge>}
                                      {manualDeductions > 0 && <Badge variant="outline" className="text-[10px] px-1 py-0 text-destructive border-destructive/30">-{manualDeductions}</Badge>}
                                      {manualBonuses > 0 && <Badge variant="outline" className="text-[10px] px-1 py-0 text-green-600 border-green-500/30">+{manualBonuses}</Badge>}
                                    </div>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-xs text-xs space-y-1">
                                <p>{isRTL ? 'الأساسي' : 'Base'}: {baseAmount} {isRTL ? 'ج.م' : 'EGP'}</p>
                                {warnDeductions && warnDeductions.details.map((d, i) => (
                                  <p key={i} className="text-destructive">{d.type} (×{d.count}): -{d.amount}</p>
                                ))}
                                {manualDeductions > 0 && <p className="text-destructive">{isRTL ? 'خصم يدوي' : 'Manual deduction'}: -{manualDeductions}</p>}
                                {manualBonuses > 0 && <p className="text-green-600">{isRTL ? 'بونص' : 'Bonus'}: +{manualBonuses}</p>}
                                <p className="font-bold border-t pt-1">{isRTL ? 'الصافي' : 'Net'}: {estimatedNet} {isRTL ? 'ج.م' : 'EGP'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-muted-foreground text-xs">{isRTL ? 'غير محدد' : 'N/A'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {paid ? (
                          <Badge className="bg-green-100 text-green-800"><Check className="h-3 w-3 mr-1" />{isRTL ? 'تم الصرف' : 'Paid'}</Badge>
                        ) : (
                          <Badge variant="outline" className="border-orange-500 text-orange-600"><Clock className="h-3 w-3 mr-1" />{isRTL ? 'لم يصرف' : 'Pending'}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {emp.employment_status === 'permanent' && (
                            <Button size="sm" variant="outline" onClick={() => openSalaryDialog(emp)}>
                              {isRTL ? 'تحديد راتب' : 'Set Salary'}
                            </Button>
                          )}
                          {canPay(emp) && (
                            <Button size="sm" onClick={() => openPayDialog(emp)}>
                              <DollarSign className="h-3 w-3 mr-1" />{isRTL ? 'صرف' : 'Pay'}
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="text-destructive border-destructive/50" onClick={() => openAdjustDialog(emp, 'deduction')}>
                            <Minus className="h-3 w-3 mr-1" />{isRTL ? 'خصم' : 'Deduct'}
                          </Button>
                          <Button size="sm" variant="outline" className="text-green-600 border-green-500/50" onClick={() => openAdjustDialog(emp, 'bonus')}>
                            <Gift className="h-3 w-3 mr-1" />{isRTL ? 'بونص' : 'Bonus'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="history">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? 'الشهر' : 'Month'}</TableHead>
                  <TableHead>{isRTL ? 'الموظف' : 'Employee'}</TableHead>
                  <TableHead>{isRTL ? 'النوع' : 'Type'}</TableHead>
                  <TableHead>{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                  <TableHead>{isRTL ? 'السبب' : 'Reason'}</TableHead>
                  <TableHead>{isRTL ? 'الصافي' : 'Net'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaryPayments.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{isRTL ? 'لا يوجد سجلات' : 'No records'}</TableCell></TableRow>
                ) : salaryPayments.map(p => {
                  const emp = employees.find(e => e.user_id === p.employee_id);
                  const isSalary = Number(p.base_amount) > 0;
                  const isDeduction = Number(p.deductions) > 0;
                  const isBonus = Number(p.bonus) > 0;
                  const typeLabel = isSalary ? (isRTL ? 'راتب' : 'Salary') : isDeduction ? (isRTL ? 'خصم' : 'Deduction') : (isRTL ? 'بونص' : 'Bonus');
                  const reason = isDeduction ? (isRTL && p.deduction_reason_ar ? p.deduction_reason_ar : p.deduction_reason) : isBonus ? (isRTL && p.bonus_reason_ar ? p.bonus_reason_ar : p.bonus_reason) : null;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{new Date(p.month).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long' })}</TableCell>
                      <TableCell className="font-medium">{emp ? getName(emp) : p.employee_id}</TableCell>
                      <TableCell>
                        <Badge className={isSalary ? 'bg-blue-100 text-blue-800' : isDeduction ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                          {typeLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className={isDeduction ? 'text-destructive font-medium' : isBonus ? 'text-green-600 font-medium' : 'font-medium'}>
                        {isSalary ? p.base_amount : isDeduction ? `-${p.deductions}` : `+${p.bonus}`} {isRTL ? 'ج.م' : 'EGP'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{reason || '-'}</TableCell>
                      <TableCell className="font-bold">{p.net_amount} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Set Salary Dialog */}
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

      {/* Pay Salary Dialog (with auto-deductions + hourly breakdown) */}
      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{isRTL ? 'صرف راتب' : 'Pay Salary'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            {selectedEmployee && (
              <div className="p-3 rounded-lg border bg-muted/50">
                <p className="font-medium">{getName(selectedEmployee)}</p>
              </div>
            )}

            {/* Hourly breakdown for paid trainees */}
            {selectedEmployee?.is_paid_trainee && selectedEmployee?.hourly_rate && hourlyDataMap[selectedEmployee.user_id] && (
              <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                <p className="text-sm font-semibold">{isRTL ? 'تفصيل الساعات:' : 'Hours Breakdown:'}</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {hourlyDataMap[selectedEmployee.user_id].sessions.map((s, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="flex items-center gap-1">
                        {s.date} - {s.groupName}
                        {s.status === 'inferred' && <AlertCircle className="h-3 w-3 text-amber-500" />}
                      </span>
                      <span>{s.hours} {isRTL ? 'س' : 'hrs'}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-2 flex justify-between text-sm font-medium">
                  <span>{isRTL ? 'الإجمالي' : 'Total'}: {hourlyDataMap[selectedEmployee.user_id].roundedHours} {isRTL ? 'ساعة' : 'hrs'}</span>
                  <span>× {selectedEmployee.hourly_rate} = {hourlyDataMap[selectedEmployee.user_id].totalPay} {isRTL ? 'ج.م' : 'EGP'}</span>
                </div>
                {hourlyDataMap[selectedEmployee.user_id].hasInferred && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {isRTL ? 'يتضمن بيانات تقديرية - يرجى مراجعة حضور المدرب' : 'Includes estimated data - please review instructor attendance'}
                  </p>
                )}
              </div>
            )}

            <div><Label>{isRTL ? 'الشهر' : 'Month'}</Label>
              <Input type="date" value={payForm.month} onChange={e => setPayForm({ ...payForm, month: e.target.value })} />
            </div>
            <div><Label>{isRTL ? 'المبلغ الأساسي' : 'Base Amount'}</Label>
              <Input type="number" value={payForm.base_amount} onChange={e => setPayForm({ ...payForm, base_amount: +e.target.value })} />
            </div>

            {/* Auto Deductions from Warning Rules */}
            {loadingDeductions ? (
              <p className="text-sm text-muted-foreground">{isRTL ? 'جاري حساب الخصومات...' : 'Calculating deductions...'}</p>
            ) : autoDeductions.length > 0 && (
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 space-y-2">
                <p className="text-sm font-semibold text-destructive">{isRTL ? 'خصومات تلقائية من الإنذارات:' : 'Auto deductions from warnings:'}</p>
                {autoDeductions.map((d, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{d.warning_type} (×{d.count})</span>
                    <span className="text-destructive font-medium">-{d.amount} {isRTL ? 'ج.م' : 'EGP'}</span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between font-bold text-sm">
                  <span>{isRTL ? 'إجمالي الخصم' : 'Total Deduction'}</span>
                  <span className="text-destructive">-{autoDeductions.reduce((s, d) => s + d.amount, 0)} {isRTL ? 'ج.م' : 'EGP'}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>{isRTL ? 'الصافي' : 'Net Pay'}</span>
                  <span>{payForm.base_amount - autoDeductions.reduce((s, d) => s + d.amount, 0)} {isRTL ? 'ج.م' : 'EGP'}</span>
                </div>
              </div>
            )}

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

      {/* Bonus / Deduction Dialog */}
      <Dialog open={adjustDialog} onOpenChange={setAdjustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {adjustForm.type === 'deduction' ? (isRTL ? 'تسجيل خصم' : 'Record Deduction') : (isRTL ? 'تسجيل بونص' : 'Record Bonus')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedEmployee && (
              <div className="p-3 rounded-lg border bg-muted/50">
                <p className="font-medium">{getName(selectedEmployee)}</p>
              </div>
            )}
            <div><Label>{isRTL ? 'الشهر' : 'Month'}</Label>
              <Input type="date" value={adjustForm.month} onChange={e => setAdjustForm({ ...adjustForm, month: e.target.value })} />
            </div>
            <div><Label>{isRTL ? 'المبلغ (ج.م)' : 'Amount (EGP)'} *</Label>
              <Input type="number" value={adjustForm.amount} onChange={e => setAdjustForm({ ...adjustForm, amount: +e.target.value })} />
            </div>
            <div><Label>{isRTL ? 'السبب (English)' : 'Reason (English)'}</Label>
              <Input value={adjustForm.reason} onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })} />
            </div>
            <div><Label>{isRTL ? 'السبب (عربي)' : 'Reason (Arabic)'}</Label>
              <Input value={adjustForm.reason_ar} onChange={e => setAdjustForm({ ...adjustForm, reason_ar: e.target.value })} dir="rtl" />
            </div>
            <div><Label>{isRTL ? 'طريقة الدفع' : 'Payment Method'}</Label>
              <Select value={adjustForm.payment_method} onValueChange={v => setAdjustForm({ ...adjustForm, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{isRTL ? 'كاش' : 'Cash'}</SelectItem>
                  <SelectItem value="transfer">{isRTL ? 'تحويل بنكي' : 'Bank Transfer'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{isRTL ? 'ملاحظات' : 'Notes'}</Label>
              <Input value={adjustForm.notes} onChange={e => setAdjustForm({ ...adjustForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button 
              onClick={handleAdjustment} 
              disabled={saving}
              className={adjustForm.type === 'deduction' ? 'bg-destructive hover:bg-destructive/90' : 'bg-green-600 hover:bg-green-700'}
            >
              {saving ? '...' : adjustForm.type === 'deduction' ? (isRTL ? 'تسجيل الخصم' : 'Record Deduction') : (isRTL ? 'تسجيل البونص' : 'Record Bonus')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
