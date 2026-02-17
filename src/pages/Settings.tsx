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
import { AlertTriangle, Plus, Trash2, Save, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface WarningType {
  id: string;
  value: string;
  labelEn: string;
  labelAr: string;
  isSystem: boolean;
}

const systemWarningTypes: WarningType[] = [
  { id: '1', value: 'behavior', labelEn: 'Behavior', labelAr: 'سلوك', isSystem: true },
  { id: '2', value: 'non_compliance', labelEn: 'Non-Compliance', labelAr: 'عدم التزام', isSystem: true },
  { id: '3', value: 'poor_performance', labelEn: 'Poor Performance', labelAr: 'أداء ضعيف', isSystem: true },
  { id: '4', value: 'attendance', labelEn: 'Attendance', labelAr: 'حضور', isSystem: true },
  { id: '5', value: 'late_submission', labelEn: 'Late Submission', labelAr: 'تأخر في التسليم', isSystem: true },
];

interface WarningSettings {
  warningTypes: WarningType[];
  autoWarningEnabled: boolean;
  warningThresholdDays: number;
}

export default function SettingsPage() {
  const { t, isRTL } = useLanguage();
  const { role, user } = useAuth();
  const [warningTypes, setWarningTypes] = useState<WarningType[]>(systemWarningTypes);
  const [newTypeEn, setNewTypeEn] = useState('');
  const [newTypeAr, setNewTypeAr] = useState('');
  const [autoWarningEnabled, setAutoWarningEnabled] = useState(true);
  const [warningThresholdDays, setWarningThresholdDays] = useState(1);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings from database
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'warning_settings')
          .maybeSingle();

        if (data?.value) {
          const settings = data.value as unknown as WarningSettings;
          if (settings.warningTypes) {
            // Merge system types with saved custom types
            const customTypes = settings.warningTypes.filter((wt: WarningType) => !wt.isSystem);
            setWarningTypes([...systemWarningTypes, ...customTypes]);
          }
          if (typeof settings.autoWarningEnabled === 'boolean') {
            setAutoWarningEnabled(settings.autoWarningEnabled);
          }
          if (typeof settings.warningThresholdDays === 'number') {
            setWarningThresholdDays(settings.warningThresholdDays);
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoadingSettings(false);
      }
    };

    loadSettings();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const settings: WarningSettings = {
        warningTypes,
        autoWarningEnabled,
        warningThresholdDays,
      };

      const { error } = await supabase
        .from('system_settings')
        .upsert(
          { key: 'warning_settings', value: settings as any, updated_by: user?.id },
          { onConflict: 'key' }
        );

      if (error) throw error;

      setHasChanges(false);
      toast.success(isRTL ? 'تم حفظ الإعدادات بنجاح' : 'Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(isRTL ? 'فشل في حفظ الإعدادات' : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
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
    setHasChanges(true);
    toast.success(isRTL ? 'تم إضافة نوع الإنذار' : 'Warning type added');
  };

  const removeWarningType = (id: string) => {
    setWarningTypes(warningTypes.filter(t => t.id !== id));
    setHasChanges(true);
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
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">{t.settings.language}</Label>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'اختر لغة الواجهة' : 'Select interface language'}
                </p>
              </div>
              <LanguageToggle />
            </div>
            
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <CardTitle>{isRTL ? 'إعدادات الإنذارات' : 'Warning Settings'}</CardTitle>
                </div>
                {hasChanges && (
                  <Button onClick={saveSettings} disabled={saving} size="sm">
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {isRTL ? 'حفظ' : 'Save'}
                  </Button>
                )}
              </div>
              <CardDescription>
                {isRTL ? 'إدارة أنواع الإنذارات وإعدادات النظام الآلي' : 'Manage warning types and automatic system settings'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingSettings ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
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
                      onCheckedChange={(v) => { setAutoWarningEnabled(v); setHasChanges(true); }} 
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
                          onChange={(e) => { setWarningThresholdDays(Number(e.target.value)); setHasChanges(true); }}
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
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
