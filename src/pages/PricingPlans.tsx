import { useState, useEffect } from 'react';
import { DollarSign, Plus, Edit, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getGroupTypeLabel, GROUP_TYPES_LIST } from '@/lib/constants';

interface PricingPlan {
  id: string;
  name: string;
  name_ar: string;
  attendance_mode: string;
  group_type: string;
  min_students: number;
  max_students: number;
  price_before_discount: number;
  discount_percentage: number;
  price_3_months: number;
  price_1_month: number;
  is_active: boolean;
}

const emptyPlan = {
  name: '', name_ar: '', attendance_mode: 'offline', group_type: 'kojo_squad',
  min_students: 1, max_students: 8, price_before_discount: 0, discount_percentage: 0,
  price_3_months: 0, price_1_month: 0,
};

export default function PricingPlans() {
  const { isRTL, language } = useLanguage();
  const { role } = useAuth();
  const { toast } = useToast();
  const isReadOnly = role === 'reception';
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
  const [form, setForm] = useState(emptyPlan);

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    const { data } = await supabase.from('pricing_plans').select('*').order('attendance_mode').order('group_type');
    setPlans((data as any) || []);
    setLoading(false);
  };

  const openCreate = () => { setEditingPlan(null); setForm(emptyPlan); setDialogOpen(true); };
  const openEdit = (plan: PricingPlan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name, name_ar: plan.name_ar, attendance_mode: plan.attendance_mode,
      group_type: plan.group_type, min_students: plan.min_students, max_students: plan.max_students,
      price_before_discount: plan.price_before_discount, discount_percentage: plan.discount_percentage,
      price_3_months: plan.price_3_months, price_1_month: plan.price_1_month,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.name_ar || !form.price_3_months) {
      toast({ title: isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    if (editingPlan) {
      await supabase.from('pricing_plans').update(form as any).eq('id', editingPlan.id);
      toast({ title: isRTL ? 'تم تحديث الباقة' : 'Plan updated' });
    } else {
      await supabase.from('pricing_plans').insert(form as any);
      toast({ title: isRTL ? 'تم إضافة الباقة' : 'Plan added' });
    }
    setDialogOpen(false);
    fetchPlans();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('pricing_plans').delete().eq('id', id);
    toast({ title: isRTL ? 'تم حذف الباقة' : 'Plan deleted' });
    fetchPlans();
  };

  const groupTypeLabel = (type: string) => getGroupTypeLabel(type, false);

  const offlinePlans = plans.filter(p => p.attendance_mode === 'offline');
  const onlinePlans = plans.filter(p => p.attendance_mode === 'online');

  const renderTable = (items: PricingPlan[], title: string) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{isRTL ? 'الباقة' : 'Plan'}</TableHead>
              <TableHead>{isRTL ? 'الطلاب' : 'Students'}</TableHead>
              <TableHead>{isRTL ? 'السعر الأصلي' : 'Original Price'}</TableHead>
              <TableHead>{isRTL ? 'الخصم' : 'Discount'}</TableHead>
              <TableHead>{isRTL ? '3 شهور' : '3 Months'}</TableHead>
              <TableHead>{isRTL ? 'شهري' : 'Monthly'}</TableHead>
              <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
              {!isReadOnly && <TableHead>{isRTL ? 'إجراءات' : 'Actions'}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(plan => (
              <TableRow key={plan.id}>
                <TableCell className="font-medium">{language === 'ar' ? plan.name_ar : plan.name}</TableCell>
                <TableCell>{plan.min_students} - {plan.max_students}</TableCell>
                <TableCell>{plan.price_before_discount} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                <TableCell>{plan.discount_percentage}%</TableCell>
                <TableCell className="font-bold text-primary">{plan.price_3_months} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                <TableCell>{plan.price_1_month} {isRTL ? 'ج.م' : 'EGP'}</TableCell>
                <TableCell>
                  <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                    {plan.is_active ? (isRTL ? 'فعال' : 'Active') : (isRTL ? 'غير فعال' : 'Inactive')}
                  </Badge>
                </TableCell>
                {!isReadOnly && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(plan)}><Edit className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(plan.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout title={isRTL ? 'خطط التسعير' : 'Pricing Plans'}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">{isRTL ? 'إدارة خطط التسعير' : 'Manage Pricing Plans'}</h2>
          {!isReadOnly && <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />{isRTL ? 'إضافة باقة' : 'Add Plan'}</Button>}
        </div>

        {renderTable(offlinePlans, isRTL ? 'أوفلاين (حضوري)' : 'Offline (In-Person)')}
        {renderTable(onlinePlans, isRTL ? 'أونلاين' : 'Online')}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingPlan ? (isRTL ? 'تعديل الباقة' : 'Edit Plan') : (isRTL ? 'إضافة باقة' : 'Add Plan')}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{isRTL ? 'الاسم (English)' : 'Name (English)'}</Label>
                  <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                <div><Label>{isRTL ? 'الاسم (عربي)' : 'Name (Arabic)'}</Label>
                  <Input value={form.name_ar} onChange={e => setForm({...form, name_ar: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{isRTL ? 'طريقة الحضور' : 'Attendance Mode'}</Label>
                  <Select value={form.attendance_mode} onValueChange={v => setForm({...form, attendance_mode: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="offline">{isRTL ? 'حضوري' : 'Offline'}</SelectItem>
                      <SelectItem value="online">{isRTL ? 'أونلاين' : 'Online'}</SelectItem>
                    </SelectContent>
                  </Select></div>
                <div><Label>{isRTL ? 'نوع المجموعة' : 'Group Type'}</Label>
                  <Select value={form.group_type} onValueChange={v => setForm({...form, group_type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GROUP_TYPES_LIST.map(gt => (
                        <SelectItem key={gt.value} value={gt.value}>{isRTL ? gt.labelAr : gt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{isRTL ? 'أقل عدد طلاب' : 'Min Students'}</Label>
                  <Input type="number" value={form.min_students} onChange={e => setForm({...form, min_students: +e.target.value})} /></div>
                <div><Label>{isRTL ? 'أكثر عدد طلاب' : 'Max Students'}</Label>
                  <Input type="number" value={form.max_students} onChange={e => setForm({...form, max_students: +e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{isRTL ? 'السعر قبل الخصم' : 'Price Before Discount'}</Label>
                  <Input type="number" value={form.price_before_discount} onChange={e => setForm({...form, price_before_discount: +e.target.value})} /></div>
                <div><Label>{isRTL ? 'نسبة الخصم %' : 'Discount %'}</Label>
                  <Input type="number" value={form.discount_percentage} onChange={e => setForm({...form, discount_percentage: +e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>{isRTL ? 'سعر 3 شهور' : 'Price 3 Months'}</Label>
                  <Input type="number" value={form.price_3_months} onChange={e => setForm({...form, price_3_months: +e.target.value})} /></div>
                <div><Label>{isRTL ? 'السعر الشهري' : 'Monthly Price'}</Label>
                  <Input type="number" value={form.price_1_month} onChange={e => setForm({...form, price_1_month: +e.target.value})} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={handleSave}>{isRTL ? 'حفظ' : 'Save'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
