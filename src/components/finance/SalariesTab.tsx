import { useState, useEffect } from 'react';
import { Plus, DollarSign, Check, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function SalariesTab() {
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [salaryDialog, setSalaryDialog] = useState(false);
  const [payDialog, setPayDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Salary form
  const [salaryForm, setSalaryForm] = useState({ employee_id: '', employee_type: 'instructor', base_salary: '', effective_from: new Date().toISOString().split('T')[0] });

  // Pay form
  const [payForm, setPayForm] = useState({
    employee_id: '', salary_id: '', month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`,
    base_amount: 0, deductions: 0, bonus: 0, deduction_reason: '', deduction_reason_ar: '', bonus_reason: '', bonus_reason_ar: '', payment_method: 'cash', notes: '',
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    // Get instructors (and admins) with their profiles
    const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('role', ['instructor', 'admin']);
    const userIds = (roles || []).map(r => r.user_id);
    const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', userIds.length > 0 ? userIds : ['none']);
    
    const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));
    const enriched = (profiles || []).map(p => ({ ...p, role: roleMap.get(p.user_id) }));
    setEmployees(enriched);

    // Get active salaries
    const { data: sals } = await supabase.from('employee_salaries').select('*').eq('is_active', true);
    setSalaries(sals || []);

    // Get salary payments for current and last 2 months
    const { data: pays } = await supabase.from('salary_payments').select('*').order('month', { ascending: false }).limit(100);
    setSalaryPayments(pays || []);

    setLoading(false);
  };

  const getEmployeeSalary = (employeeId: string) => salaries.find(s => s.employee_id === employeeId);
  const getEmployeePayment = (employeeId: string, month: string) => salaryPayments.find(p => p.employee_id === employeeId && p.month === month);

  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

  const handleSetSalary = async () => {
    if (!salaryForm.employee_id || !salaryForm.base_salary) return;
    setSaving(true);

    // Deactivate old salary
    await supabase.from('employee_salaries').update({ is_active: false } as any).eq('employee_id', salaryForm.employee_id).eq('is_active', true);

    // Insert new
    const { error } = await supabase.from('employee_salaries').insert({
      employee_id: salaryForm.employee_id,
      employee_type: salaryForm.employee_type,
      base_salary: Number(salaryForm.base_salary),
      effective_from: salaryForm.effective_from,
    } as any);

    if (error) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: error.message });
    } else {
      toast({ title: isRTL ? 'تم تحديد الراتب' : 'Salary set successfully' });
      setSalaryDialog(false);
      fetchData();
    }
    setSaving(false);
  };

  const handlePaySalary = async () => {
    if (!payForm.employee_id) return;
    setSaving(true);

    const { error } = await supabase.from('salary_payments').insert({
      employee_id: payForm.employee_id,
      salary_id: payForm.salary_id || null,
      month: payForm.month,
      base_amount: payForm.base_amount,
      deductions: payForm.deductions,
      bonus: payForm.bonus,
      deduction_reason: payForm.deduction_reason || null,
      deduction_reason_ar: payForm.deduction_reason_ar || null,
      bonus_reason: payForm.bonus_reason || null,
      bonus_reason_ar: payForm.bonus_reason_ar || null,
      status: 'paid',
      paid_date: new Date().toISOString().split('T')[0],
      paid_by: user?.id,
      payment_method: payForm.payment_method,
      notes: payForm.notes || null,
    } as any);

    if (error) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: error.message });
    } else {
      toast({ title: isRTL ? 'تم صرف الراتب' : 'Salary paid successfully' });
      setPayDialog(false);
      fetchData();
    }
    setSaving(false);
  };

  const openPayDialog = (emp: any) => {
    const salary = getEmployeeSalary(emp.user_id);
    setPayForm({
      employee_id: emp.user_id,
      salary_id: salary?.id || '',
      month: currentMonth,
      base_amount: salary?.base_salary || 0,
      deductions: 0, bonus: 0,
      deduction_reason: '', deduction_reason_ar: '',
      bonus_reason: '', bonus_reason_ar: '',
      payment_method: 'cash', notes: '',
    });
    setSelectedEmployee(emp);
    setPayDialog(true);
  };

  const openSalaryDialog = (emp?: any) => {
    const existingSalary = emp ? getEmployeeSalary(emp.user_id) : null;
    setSalaryForm({
      employee_id: emp?.user_id || '',
      employee_type: emp?.role || 'instructor',
      base_salary: existingSalary?.base_salary?.toString() || '',
      effective_from: new Date().toISOString().split('T')[0],
    });
    setSelectedEmployee(emp || null);
    setSalaryDialog(true);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const getName = (emp: any) => language === 'ar' && emp.full_name_ar ? emp.full_name_ar : emp.full_name;

  const totalMonthlySalaries = salaries.reduce((sum, s) => sum + Number(s.base_salary), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{isRTL ? 'إجمالي الرواتب الشهرية' : 'Total Monthly Salaries'}</p>
            <p className="text-2xl font-bold text-destructive">{totalMonthlySalaries} {isRTL ? 'ج.م' : 'EGP'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{isRTL ? 'عدد الموظفين' : 'Employees'}</p>
            <p className="text-2xl font-bold">{employees.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{isRTL ? 'بدون راتب محدد' : 'No Salary Set'}</p>
            <p className="text-2xl font-bold text-orange-600">{employees.filter(e => !getEmployeeSalary(e.user_id)).length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">{isRTL ? 'الموظفين' : 'Employees'}</TabsTrigger>
          <TabsTrigger value="history">{isRTL ? 'سجل الصرف' : 'Payment History'}</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                    <TableHead>{isRTL ? 'الدور' : 'Role'}</TableHead>
                    <TableHead>{isRTL ? 'نوع العمل' : 'Work Type'}</TableHead>
                    <TableHead>{isRTL ? 'الراتب الأساسي' : 'Base Salary'}</TableHead>
                    <TableHead>{isRTL ? 'حالة الشهر' : 'This Month'}</TableHead>
                    <TableHead>{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8">{isRTL ? 'جاري التحميل...' : 'Loading...'}</TableCell></TableRow>
                  ) : employees.map(emp => {
                    const salary = getEmployeeSalary(emp.user_id);
                    const paid = getEmployeePayment(emp.user_id, currentMonth);
                    return (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{getName(emp)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{emp.role === 'admin' ? (isRTL ? 'مدير' : 'Admin') : (isRTL ? 'مدرب' : 'Instructor')}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={emp.work_type === 'part_time' ? 'border-purple-500 text-purple-600' : 'border-blue-500 text-blue-600'}>
                            {emp.work_type === 'part_time' ? (isRTL ? 'بارت تايم' : 'Part-time') : (isRTL ? 'فول تايم' : 'Full-time')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {salary ? (
                            <span className="font-medium">{salary.base_salary} {isRTL ? 'ج.م' : 'EGP'}</span>
                          ) : (
                            <span className="text-muted-foreground">{isRTL ? 'غير محدد' : 'Not set'}</span>
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
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => openSalaryDialog(emp)}>
                              {isRTL ? 'تحديد راتب' : 'Set Salary'}
                            </Button>
                            {salary && !paid && (
                              <Button size="sm" onClick={() => openPayDialog(emp)}>
                                <DollarSign className="h-3 w-3 mr-1" />{isRTL ? 'صرف' : 'Pay'}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'الشهر' : 'Month'}</TableHead>
                    <TableHead>{isRTL ? 'الموظف' : 'Employee'}</TableHead>
                    <TableHead>{isRTL ? 'الأساسي' : 'Base'}</TableHead>
                    <TableHead>{isRTL ? 'خصومات' : 'Deductions'}</TableHead>
                    <TableHead>{isRTL ? 'بونص' : 'Bonus'}</TableHead>
                    <TableHead>{isRTL ? 'الصافي' : 'Net'}</TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryPayments.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{isRTL ? 'لا يوجد سجلات' : 'No records'}</TableCell></TableRow>
                  ) : salaryPayments.map(p => {
                    const emp = employees.find(e => e.user_id === p.employee_id);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>{new Date(p.month).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long' })}</TableCell>
                        <TableCell className="font-medium">{emp ? getName(emp) : p.employee_id}</TableCell>
                        <TableCell>{p.base_amount} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                        <TableCell className={Number(p.deductions) > 0 ? 'text-destructive' : ''}>
                          {Number(p.deductions) > 0 ? `-${p.deductions}` : '-'}
                          {p.deduction_reason && <span className="block text-xs text-muted-foreground">{isRTL && p.deduction_reason_ar ? p.deduction_reason_ar : p.deduction_reason}</span>}
                        </TableCell>
                        <TableCell className={Number(p.bonus) > 0 ? 'text-green-600' : ''}>
                          {Number(p.bonus) > 0 ? `+${p.bonus}` : '-'}
                          {p.bonus_reason && <span className="block text-xs text-muted-foreground">{isRTL && p.bonus_reason_ar ? p.bonus_reason_ar : p.bonus_reason}</span>}
                        </TableCell>
                        <TableCell className="font-bold">{p.net_amount} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                        <TableCell>
                          <Badge className={p.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                            {p.status === 'paid' ? (isRTL ? 'مصروف' : 'Paid') : (isRTL ? 'معلق' : 'Pending')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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

      {/* Pay Salary Dialog */}
      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{isRTL ? 'صرف راتب' : 'Pay Salary'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {selectedEmployee && (
              <div className="p-3 rounded-lg border bg-muted/50">
                <p className="font-medium">{getName(selectedEmployee)}</p>
              </div>
            )}
            <div><Label>{isRTL ? 'الشهر' : 'Month'}</Label>
              <Input type="date" value={payForm.month} onChange={e => setPayForm({ ...payForm, month: e.target.value })} />
            </div>
            <div><Label>{isRTL ? 'الراتب الأساسي' : 'Base Amount'}</Label>
              <Input type="number" value={payForm.base_amount} onChange={e => setPayForm({ ...payForm, base_amount: +e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{isRTL ? 'خصومات' : 'Deductions'}</Label>
                <Input type="number" value={payForm.deductions} onChange={e => setPayForm({ ...payForm, deductions: +e.target.value })} />
              </div>
              <div><Label>{isRTL ? 'سبب الخصم' : 'Deduction Reason'}</Label>
                <Input value={payForm.deduction_reason} onChange={e => setPayForm({ ...payForm, deduction_reason: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{isRTL ? 'بونص' : 'Bonus'}</Label>
                <Input type="number" value={payForm.bonus} onChange={e => setPayForm({ ...payForm, bonus: +e.target.value })} />
              </div>
              <div><Label>{isRTL ? 'سبب البونص' : 'Bonus Reason'}</Label>
                <Input value={payForm.bonus_reason} onChange={e => setPayForm({ ...payForm, bonus_reason: e.target.value })} />
              </div>
            </div>
            <div className="p-3 rounded-lg border bg-primary/5">
              <p className="text-sm text-muted-foreground">{isRTL ? 'الصافي المستحق' : 'Net Amount'}</p>
              <p className="text-xl font-bold">{payForm.base_amount - payForm.deductions + payForm.bonus} {isRTL ? 'ج.م' : 'EGP'}</p>
            </div>
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
