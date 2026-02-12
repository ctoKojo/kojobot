import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, Plus, Trash2, Save, Clock, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface WarningType {
  id: string;
  value: string;
  labelEn: string;
  labelAr: string;
  isSystem: boolean;
}

interface DeductionRule {
  id?: string;
  warning_type: string;
  warning_count: number;
  deduction_amount: number;
  is_active: boolean;
}

// System warning types that cannot be deleted
const systemWarningTypes: WarningType[] = [
  { id: '1', value: 'behavior', labelEn: 'Behavior', labelAr: 'سلوك', isSystem: true },
  { id: '2', value: 'non_compliance', labelEn: 'Non-Compliance', labelAr: 'عدم التزام', isSystem: true },
  { id: '3', value: 'poor_performance', labelEn: 'Poor Performance', labelAr: 'أداء ضعيف', isSystem: true },
  { id: '4', value: 'attendance', labelEn: 'Attendance', labelAr: 'حضور', isSystem: true },
  { id: '5', value: 'late_submission', labelEn: 'Late Submission', labelAr: 'تأخر في التسليم', isSystem: true },
];

export default function SettingsPage() {
  const { t, isRTL } = useLanguage();
  const { role } = useAuth();
  const [warningTypes, setWarningTypes] = useState<WarningType[]>(systemWarningTypes);
  const [newTypeEn, setNewTypeEn] = useState('');
  const [newTypeAr, setNewTypeAr] = useState('');
  const [autoWarningEnabled, setAutoWarningEnabled] = useState(true);
  const [warningThresholdDays, setWarningThresholdDays] = useState(1);

  // Deduction rules
  const [deductionRules, setDeductionRules] = useState<DeductionRule[]>([]);
  const [newRule, setNewRule] = useState<DeductionRule>({ warning_type: 'attendance', warning_count: 1, deduction_amount: 0, is_active: true });
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    if (role === 'admin') fetchDeductionRules();
  }, [role]);

  const fetchDeductionRules = async () => {
    const { data } = await supabase.from('warning_deduction_rules').select('*').order('warning_type').order('warning_count');
    setDeductionRules((data || []) as any);
  };

  const addDeductionRule = async () => {
    if (!newRule.deduction_amount) {
      toast.error(isRTL ? 'أدخل مبلغ الخصم' : 'Enter deduction amount');
      return;
    }
    setSavingRules(true);
    const { error } = await supabase.from('warning_deduction_rules').insert({
      warning_type: newRule.warning_type,
      warning_count: newRule.warning_count,
      deduction_amount: newRule.deduction_amount,
    } as any);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isRTL ? 'تم إضافة قاعدة الخصم' : 'Deduction rule added');
      setNewRule({ warning_type: 'attendance', warning_count: 1, deduction_amount: 0, is_active: true });
      fetchDeductionRules();
    }
    setSavingRules(false);
  };

  const deleteDeductionRule = async (id: string) => {
    await supabase.from('warning_deduction_rules').delete().eq('id', id);
    toast.success(isRTL ? 'تم حذف القاعدة' : 'Rule deleted');
    fetchDeductionRules();
  };

  const addWarningType = () => {
    if (!newTypeEn.trim()) {
      toast.error(isRTL ? 'الرجاء إدخال اسم النوع بالإنجليزية' : 'Please enter type name in English');
      return;
    }
    
    const newType: WarningType = {
      id: Date.now().toString(),
      value: newTypeEn.toLowerCase().replace(/\s+/g, '_'),
      labelEn: newTypeEn.trim(),
      labelAr: newTypeAr.trim() || newTypeEn.trim(),
      isSystem: false,
    };
    
    setWarningTypes([...warningTypes, newType]);
    setNewTypeEn('');
    setNewTypeAr('');
    toast.success(isRTL ? 'تم إضافة نوع الإنذار' : 'Warning type added');
  };

  const removeWarningType = (id: string) => {
    setWarningTypes(warningTypes.filter(t => t.id !== id));
    toast.success(isRTL ? 'تم حذف نوع الإنذار' : 'Warning type removed');
  };

  return (
    <DashboardLayout title={t.settings.title}>
      <div className="space-y-6 max-w-2xl">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t.settings.general}</CardTitle>
            <CardDescription>
              {isRTL ? 'إعدادات عامة للنظام' : 'General system settings'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Language */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">{t.settings.language}</Label>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'اختر لغة الواجهة' : 'Select interface language'}
                </p>
              </div>
              <LanguageToggle />
            </div>
            
            {/* Theme */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">{isRTL ? 'المظهر' : 'Theme'}</Label>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'اختر الوضع الفاتح أو الداكن' : 'Choose light or dark mode'}
                </p>
              </div>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>

        {/* Warning Settings - Admin Only */}
        {role === 'admin' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <CardTitle>{isRTL ? 'إعدادات الإنذارات' : 'Warning Settings'}</CardTitle>
              </div>
              <CardDescription>
                {isRTL ? 'إدارة أنواع الإنذارات وإعدادات النظام الآلي' : 'Manage warning types and automatic system settings'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Auto Warning Toggle */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label className="text-base">{isRTL ? 'الإنذارات الآلية' : 'Automatic Warnings'}</Label>
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? 'إصدار إنذارات تلقائية عند عدم تسليم الواجبات' : 'Issue warnings automatically for missed deadlines'}
                  </p>
                </div>
                <Switch 
                  checked={autoWarningEnabled} 
                  onCheckedChange={setAutoWarningEnabled} 
                />
              </div>

              {/* Warning Threshold */}
              {autoWarningEnabled && (
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label className="text-base">{isRTL ? 'مهلة الإنذار' : 'Warning Threshold'}</Label>
                      <p className="text-sm text-muted-foreground">
                        {isRTL ? 'عدد الأيام بعد انتهاء الموعد' : 'Days after deadline'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={7}
                      value={warningThresholdDays}
                      onChange={(e) => setWarningThresholdDays(Number(e.target.value))}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">{isRTL ? 'أيام' : 'days'}</span>
                  </div>
                </div>
              )}

              {/* Warning Types List */}
              <div>
                <Label className="text-base mb-3 block">{isRTL ? 'أنواع الإنذارات' : 'Warning Types'}</Label>
                <div className="space-y-2">
                  {warningTypes.map((type) => (
                    <div key={type.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <span className="font-medium">{isRTL ? type.labelAr : type.labelEn}</span>
                        {type.isSystem && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {isRTL ? 'نظام' : 'System'}
                          </Badge>
                        )}
                      </div>
                      {!type.isSystem && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeWarningType(type.id)}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Add New Type */}
              <div className="border-t pt-4">
                <Label className="text-base mb-3 block">{isRTL ? 'إضافة نوع جديد' : 'Add New Type'}</Label>
                <div className="grid gap-3">
                  <Input
                    placeholder={isRTL ? 'الاسم بالإنجليزية *' : 'Name in English *'}
                    value={newTypeEn}
                    onChange={(e) => setNewTypeEn(e.target.value)}
                  />
                  <Input
                    placeholder={isRTL ? 'الاسم بالعربية' : 'Name in Arabic'}
                    value={newTypeAr}
                    onChange={(e) => setNewTypeAr(e.target.value)}
                    dir="rtl"
                  />
                  <Button onClick={addWarningType} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    {isRTL ? 'إضافة' : 'Add'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Auto Deduction Rules - Admin Only */}
        {role === 'admin' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-destructive" />
                <CardTitle>{isRTL ? 'قواعد الخصم التلقائي' : 'Auto Deduction Rules'}</CardTitle>
              </div>
              <CardDescription>
                {isRTL ? 'حدد مبلغ الخصم التلقائي بناءً على عدد ونوع الإنذارات' : 'Set automatic deduction amounts based on warning type and count'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {deductionRules.length > 0 && (
                <div className="space-y-2">
                  {deductionRules.map(rule => {
                    const wt = systemWarningTypes.find(t => t.value === rule.warning_type);
                    return (
                      <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{isRTL && wt ? wt.labelAr : wt?.labelEn || rule.warning_type}</Badge>
                          <span className="text-sm">×{rule.warning_count}</span>
                          <span className="font-medium text-destructive">= {rule.deduction_amount} {isRTL ? 'ج.م' : 'EGP'}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => deleteDeductionRule(rule.id!)} className="text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="border-t pt-4">
                <Label className="text-base mb-3 block">{isRTL ? 'إضافة قاعدة جديدة' : 'Add New Rule'}</Label>
                <div className="grid gap-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">{isRTL ? 'نوع الإنذار' : 'Warning Type'}</Label>
                      <select
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={newRule.warning_type}
                        onChange={e => setNewRule({ ...newRule, warning_type: e.target.value })}
                      >
                        {systemWarningTypes.map(wt => (
                          <option key={wt.value} value={wt.value}>{isRTL ? wt.labelAr : wt.labelEn}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">{isRTL ? 'عدد الإنذارات' : 'Count'}</Label>
                      <Input type="number" min={1} value={newRule.warning_count} onChange={e => setNewRule({ ...newRule, warning_count: +e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">{isRTL ? 'الخصم (ج.م)' : 'Deduction (EGP)'}</Label>
                      <Input type="number" min={0} value={newRule.deduction_amount} onChange={e => setNewRule({ ...newRule, deduction_amount: +e.target.value })} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? 'مثال: 3 إنذارات حضور = خصم 200 ج.م تلقائياً' : 'Example: 3 attendance warnings = auto 200 EGP deduction'}
                  </p>
                  <Button onClick={addDeductionRule} disabled={savingRules} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    {isRTL ? 'إضافة قاعدة' : 'Add Rule'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notifications Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{t.notifications.title}</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {isRTL ? 'قريباً' : 'Coming Soon'}
              </Badge>
            </div>
            <CardDescription>
              {isRTL ? 'إعدادات الإشعارات' : 'Notification preferences'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 opacity-60">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">
                  {isRTL ? 'إشعارات الكويزات' : 'Quiz Notifications'}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'تلقي إشعارات عند إسناد كويزات جديدة' : 'Get notified when new quizzes are assigned'}
                </p>
              </div>
              <Switch defaultChecked disabled />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">
                  {isRTL ? 'إشعارات الواجبات' : 'Assignment Notifications'}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'تلقي إشعارات عند إضافة واجبات جديدة' : 'Get notified when new assignments are added'}
                </p>
              </div>
              <Switch defaultChecked disabled />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">
                  {isRTL ? 'تذكيرات المواعيد' : 'Due Date Reminders'}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'تذكيرات قبل انتهاء مواعيد التسليم' : 'Reminders before submission deadlines'}
                </p>
              </div>
              <Switch defaultChecked disabled />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
