import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Users, AlertTriangle, TrendingUp, CreditCard, Ban, Search } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { notificationService } from '@/lib/notificationService';

export default function Finance() {
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalRevenue: 0, totalOutstanding: 0, activeCount: 0, suspendedCount: 0, overdueCount: 0 });
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    // Fetch subscriptions with profile info
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('*, pricing_plans(name, name_ar, attendance_mode, group_type)')
      .order('created_at', { ascending: false });

    // Get student profiles for each subscription
    const studentIds = [...new Set((subs || []).map((s: any) => s.student_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, full_name_ar, email, phone')
      .in('user_id', studentIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
    const enriched = (subs || []).map((s: any) => ({ ...s, profile: profileMap.get(s.student_id) }));
    setSubscriptions(enriched);

    // Fetch recent payments
    const { data: payData } = await supabase
      .from('payments')
      .select('*, subscriptions(student_id)')
      .order('created_at', { ascending: false })
      .limit(50);
    setPayments(payData || []);

    // Calc stats
    const active = enriched.filter((s: any) => s.status === 'active');
    const totalRevenue = active.reduce((sum: number, s: any) => sum + Number(s.paid_amount || 0), 0);
    const totalOutstanding = active.reduce((sum: number, s: any) => sum + Number(s.remaining_amount || 0), 0);
    const suspendedCount = active.filter((s: any) => s.is_suspended).length;
    const overdueCount = active.filter((s: any) => s.next_payment_date && new Date(s.next_payment_date) < new Date() && Number(s.remaining_amount) > 0).length;

    setStats({ totalRevenue, totalOutstanding, activeCount: active.length, suspendedCount, overdueCount });
    setLoading(false);
  };

  const openPaymentDialog = (sub: any) => {
    setSelectedSub(sub);
    setPaymentAmount(sub.installment_amount || sub.remaining_amount || 0);
    setPaymentMethod('cash');
    setPaymentNotes('');
    setPaymentDialog(true);
  };

  const handleRecordPayment = async () => {
    if (!selectedSub || paymentAmount <= 0) return;

    // Insert payment
    await supabase.from('payments').insert({
      subscription_id: selectedSub.id,
      student_id: selectedSub.student_id,
      amount: paymentAmount,
      payment_method: paymentMethod,
      payment_type: 'regular',
      notes: paymentNotes,
      recorded_by: user?.id,
    } as any);

    // Update subscription (remaining_amount is a generated column, only update paid_amount)
    const newPaid = Number(selectedSub.paid_amount) + paymentAmount;
    const newRemaining = Number(selectedSub.total_amount) - newPaid;
    
    let nextPaymentDate = selectedSub.next_payment_date;
    if (selectedSub.payment_type === 'installment' && selectedSub.installment_amount > 0) {
      const paidInstallments = Math.floor(newPaid / selectedSub.installment_amount);
      const startDate = new Date(selectedSub.start_date);
      nextPaymentDate = new Date(startDate.getTime() + paidInstallments * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
    if (newRemaining <= 0) nextPaymentDate = null;

    const wasSuspended = selectedSub.is_suspended;

    await supabase.from('subscriptions').update({
      paid_amount: newPaid,
      next_payment_date: nextPaymentDate,
      is_suspended: false,
    }).eq('id', selectedSub.id);

    // Send notifications
    await notificationService.notifyPaymentRecorded(selectedSub.student_id, paymentAmount, Math.max(0, newRemaining));
    if (wasSuspended) {
      await notificationService.notifyAccountReactivated(selectedSub.student_id);
    }

    toast({ title: isRTL ? 'تم تسجيل الدفعة بنجاح' : 'Payment recorded successfully' });
    setPaymentDialog(false);
    fetchData();
  };

  const filtered = subscriptions.filter(s => {
    if (filter === 'active') return s.status === 'active' && !s.is_suspended;
    if (filter === 'suspended') return s.is_suspended;
    if (filter === 'overdue') return s.next_payment_date && new Date(s.next_payment_date) < new Date() && Number(s.remaining_amount) > 0;
    if (filter === 'expired') return s.status === 'expired';
    return true;
  }).filter(s => {
    if (!search) return true;
    const name = s.profile?.full_name?.toLowerCase() || '';
    const nameAr = s.profile?.full_name_ar?.toLowerCase() || '';
    return name.includes(search.toLowerCase()) || nameAr.includes(search.toLowerCase());
  });

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';

  return (
    <DashboardLayout title={isRTL ? 'الإدارة المالية' : 'Finance Management'}>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          {[
            { label: isRTL ? 'إجمالي الإيرادات' : 'Total Revenue', value: `${stats.totalRevenue} ${isRTL ? 'ج.م' : 'EGP'}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-100' },
            { label: isRTL ? 'المبالغ المستحقة' : 'Outstanding', value: `${stats.totalOutstanding} ${isRTL ? 'ج.م' : 'EGP'}`, icon: DollarSign, color: 'text-orange-600', bg: 'bg-orange-100' },
            { label: isRTL ? 'اشتراكات نشطة' : 'Active', value: stats.activeCount, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
            { label: isRTL ? 'متأخرين' : 'Overdue', value: stats.overdueCount, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
            { label: isRTL ? 'موقوفين' : 'Suspended', value: stats.suspendedCount, icon: Ban, color: 'text-gray-600', bg: 'bg-gray-100' },
          ].map(stat => (
            <Card key={stat.label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${stat.bg}`}><stat.icon className={`h-5 w-5 ${stat.color}`} /></div>
                  <div>
                    <p className="text-2xl font-bold">{loading ? '...' : stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="subscriptions">
          <TabsList>
            <TabsTrigger value="subscriptions">{isRTL ? 'الاشتراكات' : 'Subscriptions'}</TabsTrigger>
            <TabsTrigger value="payments">{isRTL ? 'سجل المدفوعات' : 'Payment History'}</TabsTrigger>
          </TabsList>

          <TabsContent value="subscriptions">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder={isRTL ? 'بحث عن طالب...' : 'Search student...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                  </div>
                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                      <SelectItem value="active">{isRTL ? 'نشط' : 'Active'}</SelectItem>
                      <SelectItem value="overdue">{isRTL ? 'متأخر' : 'Overdue'}</SelectItem>
                      <SelectItem value="suspended">{isRTL ? 'موقوف' : 'Suspended'}</SelectItem>
                      <SelectItem value="expired">{isRTL ? 'منتهي' : 'Expired'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                      <TableHead>{isRTL ? 'الباقة' : 'Plan'}</TableHead>
                      <TableHead>{isRTL ? 'نوع الدفع' : 'Payment Type'}</TableHead>
                      <TableHead>{isRTL ? 'المدفوع' : 'Paid'}</TableHead>
                      <TableHead>{isRTL ? 'المتبقي' : 'Remaining'}</TableHead>
                      <TableHead>{isRTL ? 'الدفع القادم' : 'Next Payment'}</TableHead>
                      <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead>{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((sub: any) => {
                      const isOverdue = sub.next_payment_date && new Date(sub.next_payment_date) < new Date() && Number(sub.remaining_amount) > 0;
                      return (
                        <TableRow key={sub.id} className={sub.is_suspended ? 'bg-destructive/5' : isOverdue ? 'bg-warning/5' : ''}>
                          <TableCell>
                            <button className="text-left hover:underline" onClick={() => navigate(`/student/${sub.student_id}`)}>
                              <p className="font-medium">{language === 'ar' ? sub.profile?.full_name_ar || sub.profile?.full_name : sub.profile?.full_name}</p>
                              <p className="text-xs text-muted-foreground">{sub.profile?.email}</p>
                            </button>
                          </TableCell>
                          <TableCell>{language === 'ar' ? sub.pricing_plans?.name_ar : sub.pricing_plans?.name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {sub.payment_type === 'installment' ? (isRTL ? 'تقسيط' : 'Installment') : (isRTL ? 'كامل' : 'Full')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-green-600 font-medium">{sub.paid_amount} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                          <TableCell className={Number(sub.remaining_amount) > 0 ? 'text-orange-600 font-medium' : ''}>{sub.remaining_amount || 0} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                          <TableCell>{sub.next_payment_date ? formatDate(sub.next_payment_date) : '-'}</TableCell>
                          <TableCell>
                            {sub.is_suspended ? <Badge variant="destructive">{isRTL ? 'موقوف' : 'Suspended'}</Badge>
                              : isOverdue ? <Badge className="bg-orange-100 text-orange-800">{isRTL ? 'متأخر' : 'Overdue'}</Badge>
                              : Number(sub.remaining_amount) <= 0 ? <Badge className="bg-green-100 text-green-800">{isRTL ? 'مدفوع' : 'Paid'}</Badge>
                              : <Badge className="bg-blue-100 text-blue-800">{isRTL ? 'نشط' : 'Active'}</Badge>}
                          </TableCell>
                          <TableCell>
                            {Number(sub.remaining_amount) > 0 && (
                              <Button size="sm" variant="outline" onClick={() => openPaymentDialog(sub)}>
                                <CreditCard className="h-3 w-3 mr-1" />{isRTL ? 'دفعة' : 'Pay'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">{isRTL ? 'لا توجد اشتراكات' : 'No subscriptions found'}</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader><CardTitle>{isRTL ? 'آخر المدفوعات' : 'Recent Payments'}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                      <TableHead>{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                      <TableHead>{isRTL ? 'طريقة الدفع' : 'Method'}</TableHead>
                      <TableHead>{isRTL ? 'النوع' : 'Type'}</TableHead>
                      <TableHead>{isRTL ? 'ملاحظات' : 'Notes'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDate(p.payment_date)}</TableCell>
                        <TableCell className="font-medium text-green-600">{p.amount} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                        <TableCell>{p.payment_method === 'cash' ? (isRTL ? 'كاش' : 'Cash') : (isRTL ? 'تحويل' : 'Transfer')}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {p.payment_type === 'prior_payment' ? (isRTL ? 'دفعة سابقة' : 'Prior') : (isRTL ? 'عادي' : 'Regular')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Payment Dialog */}
        <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isRTL ? 'تسجيل دفعة جديدة' : 'Record Payment'}</DialogTitle>
            </DialogHeader>
            {selectedSub && (
              <div className="space-y-4 py-4">
                <div className="p-3 rounded-lg border bg-muted/50">
                  <p className="font-medium">{language === 'ar' ? selectedSub.profile?.full_name_ar : selectedSub.profile?.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? 'المتبقي: ' : 'Remaining: '}{selectedSub.remaining_amount} {isRTL ? 'ج.م' : 'EGP'}
                  </p>
                </div>
                <div><Label>{isRTL ? 'المبلغ' : 'Amount'}</Label>
                  <Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(+e.target.value)} /></div>
                <div><Label>{isRTL ? 'طريقة الدفع' : 'Payment Method'}</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{isRTL ? 'كاش' : 'Cash'}</SelectItem>
                      <SelectItem value="transfer">{isRTL ? 'تحويل بنكي' : 'Bank Transfer'}</SelectItem>
                    </SelectContent>
                  </Select></div>
                <div><Label>{isRTL ? 'ملاحظات' : 'Notes'}</Label>
                  <Input value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} /></div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={handleRecordPayment}>{isRTL ? 'تسجيل الدفعة' : 'Record Payment'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
