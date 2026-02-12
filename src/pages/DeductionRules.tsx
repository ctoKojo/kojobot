import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, DollarSign } from 'lucide-react';

interface DeductionRule {
  id?: string;
  warning_type: string;
  warning_count: number;
  deduction_amount: number;
  is_active: boolean;
}

const warningTypes = [
  { value: 'behavior', labelEn: 'Behavior', labelAr: 'سلوك' },
  { value: 'non_compliance', labelEn: 'Non-Compliance', labelAr: 'عدم التزام' },
  { value: 'poor_performance', labelEn: 'Poor Performance', labelAr: 'أداء ضعيف' },
  { value: 'attendance', labelEn: 'Attendance', labelAr: 'حضور' },
  { value: 'late_submission', labelEn: 'Late Submission', labelAr: 'تأخر في التسليم' },
];

export default function DeductionRules() {
  const { isRTL } = useLanguage();
  const [rules, setRules] = useState<DeductionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [warningType, setWarningType] = useState('attendance');
  const [warningCount, setWarningCount] = useState(1);
  const [deductionAmount, setDeductionAmount] = useState(0);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    const { data } = await supabase
      .from('warning_deduction_rules')
      .select('*')
      .order('warning_type')
      .order('warning_count');
    setRules((data || []) as any);
    setLoading(false);
  };

  const addRule = async () => {
    if (!deductionAmount || deductionAmount <= 0) {
      toast.error(isRTL ? 'أدخل مبلغ خصم صحيح' : 'Enter a valid deduction amount');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('warning_deduction_rules').insert({
      warning_type: warningType,
      warning_count: warningCount,
      deduction_amount: deductionAmount,
    } as any);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isRTL ? 'تم إضافة القاعدة' : 'Rule added');
      setWarningCount(1);
      setDeductionAmount(0);
      fetchRules();
    }
    setSaving(false);
  };

  const deleteRule = async (id: string) => {
    await supabase.from('warning_deduction_rules').delete().eq('id', id);
    toast.success(isRTL ? 'تم حذف القاعدة' : 'Rule deleted');
    fetchRules();
  };

  const getWarningLabel = (value: string) => {
    const wt = warningTypes.find(w => w.value === value);
    return isRTL ? wt?.labelAr : wt?.labelEn || value;
  };

  return (
    <DashboardLayout title={isRTL ? 'قواعد الخصم التلقائي' : 'Auto Deduction Rules'}>
      <div className="space-y-6 max-w-3xl">
        {/* Explanation */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-destructive" />
              <CardTitle className="text-xl">{isRTL ? 'كيف تعمل؟' : 'How it works?'}</CardTitle>
            </div>
            <CardDescription className="text-sm">
              {isRTL
                ? 'حدد مبلغ الخصم التلقائي من الراتب بناءً على عدد ونوع الإنذارات. مثلاً: إذا وصل المدرب لـ 3 إنذارات حضور، يتم خصم 200 ج.م تلقائياً.'
                : 'Define automatic salary deductions based on warning type and count. Example: if an instructor reaches 3 attendance warnings, 200 EGP is automatically deducted.'}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Add New Rule */}
        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'إضافة قاعدة جديدة' : 'Add New Rule'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{isRTL ? 'نوع الإنذار' : 'Warning Type'}</Label>
                <Select value={warningType} onValueChange={setWarningType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {warningTypes.map(wt => (
                      <SelectItem key={wt.value} value={wt.value}>
                        {isRTL ? wt.labelAr : wt.labelEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? 'عدد الإنذارات' : 'Warning Count'}</Label>
                <Input
                  type="number"
                  min={1}
                  value={warningCount}
                  onChange={e => setWarningCount(+e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? 'مبلغ الخصم (ج.م)' : 'Deduction (EGP)'}</Label>
                <Input
                  type="number"
                  min={0}
                  value={deductionAmount}
                  onChange={e => setDeductionAmount(+e.target.value)}
                />
              </div>
            </div>
            <Button onClick={addRule} disabled={saving} className="mt-4 w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              {isRTL ? 'إضافة قاعدة' : 'Add Rule'}
            </Button>
          </CardContent>
        </Card>

        {/* Rules Table */}
        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'القواعد الحالية' : 'Current Rules'}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center py-8">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
            ) : rules.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {isRTL ? 'لا توجد قواعد بعد. أضف قاعدة جديدة أعلاه.' : 'No rules yet. Add a new rule above.'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'نوع الإنذار' : 'Warning Type'}</TableHead>
                    <TableHead>{isRTL ? 'العدد' : 'Count'}</TableHead>
                    <TableHead>{isRTL ? 'الخصم' : 'Deduction'}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map(rule => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <Badge variant="outline">{getWarningLabel(rule.warning_type)}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">×{rule.warning_count}</TableCell>
                      <TableCell className="font-medium text-destructive">
                        {rule.deduction_amount} {isRTL ? 'ج.م' : 'EGP'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteRule(rule.id!)}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
