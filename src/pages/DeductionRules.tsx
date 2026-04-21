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
  severity: string;
  action: string;
  version: number;
  is_active: boolean;
}

const warningTypes = [
  { value: 'no_attendance', labelEn: 'No Attendance', labelAr: 'عدم تسجيل حضور' },
  { value: 'no_quiz', labelEn: 'No Quiz', labelAr: 'عدم إضافة كويز' },
  { value: 'no_assignment', labelEn: 'No Assignment', labelAr: 'عدم إضافة واجب' },
  { value: 'no_reply', labelEn: 'No Reply to Student', labelAr: 'عدم الرد على الطالب' },
  { value: 'late_grading', labelEn: 'Late Grading', labelAr: 'تأخر في التقييم' },
  { value: 'behavior', labelEn: 'Behavior', labelAr: 'سلوك' },
  { value: 'non_compliance', labelEn: 'Non-Compliance', labelAr: 'عدم التزام' },
  { value: 'poor_performance', labelEn: 'Poor Performance', labelAr: 'أداء ضعيف' },
  { value: 'attendance', labelEn: 'Attendance', labelAr: 'حضور' },
  { value: 'late_submission', labelEn: 'Late Submission', labelAr: 'تأخر في التسليم' },
  { value: 'other', labelEn: 'Other', labelAr: 'أخرى' },
];

const severityOptions = [
  { value: 'minor', labelEn: 'Minor', labelAr: 'بسيط', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'major', labelEn: 'Major', labelAr: 'متوسط', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'critical', labelEn: 'Critical', labelAr: 'حرج', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
];

const actionOptions = [
  { value: 'deduction', labelEn: 'Deduction', labelAr: 'خصم مالي' },
  { value: 'suspension_recommendation', labelEn: 'Suspension Recommendation', labelAr: 'توصية بالإيقاف' },
];

export default function DeductionRules({ embedded = false }: { embedded?: boolean } = {}) {
  const { isRTL } = useLanguage();
  const [rules, setRules] = useState<DeductionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [warningType, setWarningType] = useState('attendance');
  const [warningCount, setWarningCount] = useState(1);
  const [deductionAmount, setDeductionAmount] = useState(0);
  const [severity, setSeverity] = useState('minor');
  const [action, setAction] = useState('deduction');

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
    if (action === 'deduction' && (!deductionAmount || deductionAmount <= 0)) {
      toast.error(isRTL ? 'أدخل مبلغ خصم صحيح' : 'Enter a valid deduction amount');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('warning_deduction_rules').insert({
      warning_type: warningType,
      warning_count: warningCount,
      deduction_amount: action === 'suspension_recommendation' ? 0 : deductionAmount,
      severity,
      action,
    } as any);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isRTL ? 'تم إضافة القاعدة' : 'Rule added');
      setWarningCount(1);
      setDeductionAmount(0);
      setSeverity('minor');
      setAction('deduction');
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

  const getSeverityBadge = (sev: string) => {
    const opt = severityOptions.find(s => s.value === sev);
    return opt ? { label: isRTL ? opt.labelAr : opt.labelEn, color: opt.color } : { label: sev, color: '' };
  };

  const getActionLabel = (act: string) => {
    const opt = actionOptions.find(a => a.value === act);
    return isRTL ? opt?.labelAr : opt?.labelEn || act;
  };

  const inner = (
    <div className="space-y-6 max-w-4xl">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            {isRTL ? 'قواعد الخصم التلقائي' : 'Auto Deduction Rules'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRTL ? 'إدارة قواعد الخصم التلقائي من الرواتب' : 'Manage automatic salary deduction rules'}
          </p>
        </div>
      )}

        {/* Explanation */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">{isRTL ? 'كيف تعمل؟' : 'How it works?'}</CardTitle>
            <CardDescription className="text-sm">
              {isRTL
                ? 'حدد مبلغ الخصم التلقائي من الراتب بناءً على عدد ونوع وخطورة الإنذارات خلال 30 يوم. يمكنك أيضاً تحديد توصية بالإيقاف بدلاً من الخصم.'
                : 'Define automatic salary deductions based on warning type, count, and severity within a 30-day rolling window. You can also set suspension recommendations instead of deductions.'}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Add New Rule */}
        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'إضافة قاعدة جديدة' : 'Add New Rule'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                <Label>{isRTL ? 'عدد الإنذارات (30 يوم)' : 'Warning Count (30 days)'}</Label>
                <Input
                  type="number"
                  min={1}
                  value={warningCount}
                  onChange={e => setWarningCount(+e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? 'درجة الخطورة' : 'Severity'}</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {severityOptions.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        {isRTL ? s.labelAr : s.labelEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? 'الإجراء' : 'Action'}</Label>
                <Select value={action} onValueChange={setAction}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {actionOptions.map(a => (
                      <SelectItem key={a.value} value={a.value}>
                        {isRTL ? a.labelAr : a.labelEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {action === 'deduction' && (
                <div className="space-y-2">
                  <Label>{isRTL ? 'مبلغ الخصم (ج.م)' : 'Deduction (EGP)'}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={deductionAmount}
                    onChange={e => setDeductionAmount(+e.target.value)}
                  />
                </div>
              )}
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>{isRTL ? 'نوع الإنذار' : 'Warning Type'}</TableHead>
                      <TableHead>{isRTL ? 'العدد' : 'Count'}</TableHead>
                      <TableHead>{isRTL ? 'الخطورة' : 'Severity'}</TableHead>
                      <TableHead>{isRTL ? 'الإجراء' : 'Action'}</TableHead>
                      <TableHead>{isRTL ? 'الخصم' : 'Deduction'}</TableHead>
                      <TableHead>{isRTL ? 'الإصدار' : 'Ver.'}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map(rule => {
                      const sevBadge = getSeverityBadge(rule.severity || 'minor');
                      return (
                        <TableRow key={rule.id}>
                          <TableCell>
                            <Badge variant="outline">{getWarningLabel(rule.warning_type)}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">×{rule.warning_count}</TableCell>
                          <TableCell>
                            <Badge className={sevBadge.color}>{sevBadge.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{getActionLabel(rule.action || 'deduction')}</span>
                          </TableCell>
                          <TableCell className="font-medium text-destructive">
                            {(rule.action || 'deduction') === 'deduction' 
                              ? `${rule.deduction_amount} ${isRTL ? 'ج.م' : 'EGP'}` 
                              : '-'
                            }
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            v{rule.version || 1}
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
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
