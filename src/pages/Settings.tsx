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
import { AlertTriangle, Plus, Trash2, Save, Clock, Loader2, Bell, Key, CheckCircle, BookOpen, Globe, Star, MessageSquare, Eye, EyeOff } from 'lucide-react';
import { AcademyClosuresSettings } from '@/components/settings/AcademyClosuresSettings';
import { ComplianceGracePeriodsSettings } from '@/components/settings/ComplianceGracePeriodsSettings';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { GROUP_TYPES_LIST } from '@/lib/constants';

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
  { id: '6', value: 'no_reply', labelEn: 'No Reply to Student', labelAr: 'عدم الرد على الطالب', isSystem: true },
  { id: '7', value: 'late_grading', labelEn: 'Late Grading', labelAr: 'تأخر في التقييم', isSystem: true },
];

interface WarningSettings {
  warningTypes: WarningType[];
  autoWarningEnabled: boolean;
  warningThresholdDays: number;
}

export default function SettingsPage() {
  const { t, isRTL, language } = useLanguage();
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
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 shadow-lg shadow-slate-500/20">
            <Globe className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{t.settings.title}</h1>
            <p className="text-sm text-muted-foreground">{isRTL ? 'إعدادات النظام والتخصيص' : 'System settings and customization'}</p>
          </div>
        </div>

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

        {/* Compliance Grace Periods - Admin Only */}
        {role === 'admin' && <ComplianceGracePeriodsSettings isRTL={isRTL} />}

        {/* Sibling Discount Settings - Admin Only */}
        {role === 'admin' && <SiblingDiscountSettings isRTL={isRTL} />}

        {/* Content Access Permissions - Admin Only */}
        {role === 'admin' && <ContentAccessSettings isRTL={isRTL} />}

        {/* Academy Closures - Admin Only */}
        {role === 'admin' && <AcademyClosuresSettings isRTL={isRTL} language={language} />}

        {/* Push Notifications - Admin Only */}
        {role === 'admin' && <PushNotificationSettings isRTL={isRTL} />}

        {/* Social Links - Admin Only */}
        {role === 'admin' && <SocialLinksSettings isRTL={isRTL} />}

        {/* Testimonials - Admin Only */}
        {role === 'admin' && <TestimonialsSettings isRTL={isRTL} />}
      </div>
    </DashboardLayout>
  );
}

function ContentAccessSettings({ isRTL }: { isRTL: boolean }) {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const subscriptionTypes = GROUP_TYPES_LIST.map(g => ({ value: g.value, labelEn: g.label, labelAr: g.labelAr }));

  const attendanceModes = [
    { value: 'offline', labelEn: 'Offline', labelAr: 'حضوري' },
    { value: 'online', labelEn: 'Online', labelAr: 'أونلاين' },
  ];

  useEffect(() => {
    const loadRules = async () => {
      const { data } = await supabase
        .from('content_access_rules')
        .select('*')
        .eq('is_active', true)
        .order('subscription_type');
      
      if (data && data.length > 0) {
        setRules(data);
      } else {
        // Initialize with defaults
        const defaults: any[] = [];
        for (const sub of subscriptionTypes) {
          for (const mode of attendanceModes) {
            defaults.push({
              subscription_type: sub.value,
              attendance_mode: mode.value,
              can_view_slides: true,
              can_view_summary_video: sub.value !== 'kojo_squad',
              can_view_full_video: sub.value === 'kojo_x',
              can_view_assignment: true,
              can_view_quiz: true,
            });
          }
        }
        setRules(defaults);
      }
      setLoading(false);
    };
    loadRules();
  }, []);

  const updateRule = (subType: string, attMode: string, field: string, value: boolean) => {
    setRules(prev => prev.map(r => 
      r.subscription_type === subType && r.attendance_mode === attMode
        ? { ...r, [field]: value }
        : r
    ));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const rule of rules) {
        const { error } = await supabase
          .from('content_access_rules')
          .upsert({
            subscription_type: rule.subscription_type,
            attendance_mode: rule.attendance_mode,
            can_view_slides: rule.can_view_slides,
            can_view_summary_video: rule.can_view_summary_video,
            can_view_full_video: rule.can_view_full_video,
            can_view_assignment: rule.can_view_assignment,
            can_view_quiz: rule.can_view_quiz,
            effective_from: new Date().toISOString().split('T')[0],
            is_active: true,
          }, { onConflict: 'subscription_type,attendance_mode' });
        
        if (error) throw error;
      }
      setHasChanges(false);
      toast.success(isRTL ? 'تم حفظ صلاحيات المحتوى' : 'Content permissions saved');
    } catch (error) {
      console.error(error);
      toast.error(isRTL ? 'فشل في حفظ الصلاحيات' : 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const getSubLabel = (value: string) => {
    const sub = subscriptionTypes.find(s => s.value === value);
    return isRTL ? sub?.labelAr : sub?.labelEn;
  };

  const getModeLabel = (value: string) => {
    const mode = attendanceModes.find(m => m.value === value);
    return isRTL ? mode?.labelAr : mode?.labelEn;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle>{isRTL ? 'صلاحيات المحتوى التعليمي' : 'Content Access Permissions'}</CardTitle>
          </div>
          {hasChanges && (
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {isRTL ? 'حفظ' : 'Save'}
            </Button>
          )}
        </div>
        <CardDescription>
          {isRTL ? 'تحكم في المحتوى المتاح لكل باقة اشتراك' : 'Control content available for each subscription tier'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-start p-2 font-medium">{isRTL ? 'الباقة' : 'Tier'}</th>
                    <th className="text-start p-2 font-medium">{isRTL ? 'الوضع' : 'Mode'}</th>
                    <th className="text-center p-2 font-medium">{isRTL ? 'سلايد' : 'Slides'}</th>
                    <th className="text-center p-2 font-medium">{isRTL ? 'فيديو ملخص' : 'Summary'}</th>
                    <th className="text-center p-2 font-medium">{isRTL ? 'فيديو كامل' : 'Full Video'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="p-2 font-medium">{getSubLabel(rule.subscription_type)}</td>
                      <td className="p-2">
                        <Badge variant="outline">{getModeLabel(rule.attendance_mode)}</Badge>
                      </td>
                      <td className="p-2 text-center">
                        <Switch
                          checked={rule.can_view_slides}
                          onCheckedChange={(v) => updateRule(rule.subscription_type, rule.attendance_mode, 'can_view_slides', v)}
                        />
                      </td>
                      <td className="p-2 text-center">
                        <Switch
                          checked={rule.can_view_summary_video}
                          onCheckedChange={(v) => updateRule(rule.subscription_type, rule.attendance_mode, 'can_view_summary_video', v)}
                        />
                      </td>
                      <td className="p-2 text-center">
                        <Switch
                          checked={rule.can_view_full_video}
                          onCheckedChange={(v) => updateRule(rule.subscription_type, rule.attendance_mode, 'can_view_full_video', v)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              {isRTL ? '* التعديلات تسري على الاشتراكات الجديدة فقط' : '* Changes apply to new subscriptions only'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function PushNotificationSettings({ isRTL }: { isRTL: boolean }) {
  const [vapidStatus, setVapidStatus] = useState<'loading' | 'configured' | 'not_configured'>('loading');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'vapid_public_key')
      .maybeSingle()
      .then(({ data }) => {
        setVapidStatus(data?.value ? 'configured' : 'not_configured');
      });
  }, []);

  const generateKeys = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-vapid-keys');
      if (error) throw error;
      setVapidStatus('configured');
      toast.success(isRTL ? 'تم إنشاء مفاتيح Push بنجاح' : 'Push keys generated successfully');
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'فشل في إنشاء المفاتيح' : 'Failed to generate keys');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle>{isRTL ? 'إشعارات Push' : 'Push Notifications'}</CardTitle>
        </div>
        <CardDescription>
          {isRTL
            ? 'إعداد إشعارات الدفع لإرسال تنبيهات حتى عندما يكون المتصفح مغلقاً'
            : 'Set up push notifications to send alerts even when the browser is closed'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {vapidStatus === 'loading' ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : vapidStatus === 'configured' ? (
          <div className="flex items-center gap-3 p-4 bg-accent/50 rounded-lg border border-accent">
            <CheckCircle className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">
                {isRTL ? 'مفاتيح VAPID مُهيأة' : 'VAPID Keys Configured'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isRTL
                  ? 'إشعارات Push جاهزة. المستخدمون سيتم تسجيلهم تلقائياً عند فتح صفحة الرسائل.'
                  : 'Push notifications are ready. Users will be auto-subscribed when they open the Messages page.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                {isRTL
                  ? 'لتفعيل إشعارات Push، تحتاج لإنشاء مفاتيح VAPID. هذا يتم مرة واحدة فقط.'
                  : 'To enable push notifications, you need to generate VAPID keys. This is a one-time setup.'}
              </p>
            </div>
            <Button onClick={generateKeys} disabled={generating} className="w-full">
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Key className="h-4 w-4 mr-2" />
              )}
              {isRTL ? 'إنشاء مفاتيح VAPID' : 'Generate VAPID Keys'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


const socialPlatforms = [
  { value: 'instagram', labelEn: 'Instagram', labelAr: 'انستجرام' },
  { value: 'facebook', labelEn: 'Facebook', labelAr: 'فيسبوك' },
  { value: 'tiktok', labelEn: 'TikTok', labelAr: 'تيك توك' },
  { value: 'whatsapp', labelEn: 'WhatsApp', labelAr: 'واتساب' },
];

interface SocialLink {
  platform: string;
  url: string;
}

function SocialLinksSettings({ isRTL }: { isRTL: boolean }) {
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPlatform, setNewPlatform] = useState('');
  const [newUrl, setNewUrl] = useState('');

  useEffect(() => {
    supabase
      .from('landing_settings')
      .select('social_links')
      .single()
      .then(({ data }) => {
        if (data?.social_links && Array.isArray(data.social_links)) {
          setLinks(data.social_links as unknown as SocialLink[]);
        }
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('landing_settings')
        .update({ social_links: links as any })
        .eq('id', '00000000-0000-0000-0000-000000000001');
      if (error) throw error;
      toast.success(isRTL ? 'تم حفظ روابط التواصل' : 'Social links saved');
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'فشل في الحفظ' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const addLink = () => {
    if (!newPlatform || !newUrl.trim()) return;
    if (links.find(l => l.platform === newPlatform)) {
      toast.error(isRTL ? 'هذه المنصة مضافة بالفعل' : 'This platform is already added');
      return;
    }
    setLinks([...links, { platform: newPlatform, url: newUrl.trim() }]);
    setNewPlatform('');
    setNewUrl('');
  };

  const removeLink = (platform: string) => {
    setLinks(links.filter(l => l.platform !== platform));
  };

  const updateUrl = (platform: string, url: string) => {
    setLinks(links.map(l => l.platform === platform ? { ...l, url } : l));
  };

  const availablePlatforms = socialPlatforms.filter(p => !links.find(l => l.platform === p.value));

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle>{isRTL ? 'روابط التواصل الاجتماعي' : 'Social Media Links'}</CardTitle>
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isRTL ? 'حفظ' : 'Save'}
          </Button>
        </div>
        <CardDescription>
          {isRTL ? 'إدارة روابط التواصل الاجتماعي في صفحة الهبوط' : 'Manage social media links on the landing page'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing links */}
        {links.map((link) => {
          const plat = socialPlatforms.find(p => p.value === link.platform);
          return (
            <div key={link.platform} className="flex items-center gap-2">
              <Badge variant="secondary" className="min-w-[90px] justify-center">
                {isRTL ? plat?.labelAr : plat?.labelEn}
              </Badge>
              <Input
                value={link.url}
                onChange={(e) => updateUrl(link.platform, e.target.value)}
                placeholder="https://..."
                className="flex-1"
                dir="ltr"
              />
              <Button variant="ghost" size="icon" onClick={() => removeLink(link.platform)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          );
        })}

        {/* Add new */}
        {availablePlatforms.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <Select value={newPlatform} onValueChange={setNewPlatform}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={isRTL ? 'المنصة' : 'Platform'} />
              </SelectTrigger>
              <SelectContent>
                {availablePlatforms.map(p => (
                  <SelectItem key={p.value} value={p.value}>
                    {isRTL ? p.labelAr : p.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://..."
              className="flex-1"
              dir="ltr"
            />
            <Button variant="outline" size="icon" onClick={addLink}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SiblingDiscountSettings({ isRTL }: { isRTL: boolean }) {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [percentage, setPercentage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'sibling_discount')
        .maybeSingle();
      if (data?.value) {
        const v = data.value as any;
        setEnabled(v.enabled || false);
        setPercentage(v.percentage || 10);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from('system_settings').upsert(
        { key: 'sibling_discount', value: { enabled, percentage } as any, updated_by: user?.id },
        { onConflict: 'key' }
      );
      setHasChanges(false);
      toast.success(isRTL ? 'تم حفظ إعدادات خصم الإخوة' : 'Sibling discount settings saved');
    } catch {
      toast.error(isRTL ? 'فشل في الحفظ' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>{isRTL ? 'خصم الإخوة' : 'Sibling Discount'}</CardTitle>
          </div>
          {hasChanges && (
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {isRTL ? 'حفظ' : 'Save'}
            </Button>
          )}
        </div>
        <CardDescription>
          {isRTL ? 'خصم تلقائي عند وجود إخوة بإشتراكات نشطة' : 'Auto-discount when siblings have active subscriptions'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <Label className="text-base">{isRTL ? 'تفعيل خصم الإخوة' : 'Enable Sibling Discount'}</Label>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'اقتراح خصم تلقائي عند إنشاء اشتراك لطالب له إخوة' : 'Suggest discount when creating subscription for a student with siblings'}
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={(v) => { setEnabled(v); setHasChanges(true); }} />
            </div>
            {enabled && (
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label className="text-base">{isRTL ? 'نسبة الخصم %' : 'Discount Percentage %'}</Label>
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? 'النسبة المقترحة تلقائياً (قابلة للتعديل)' : 'Auto-suggested percentage (editable)'}
                  </p>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={percentage}
                  onChange={(e) => { setPercentage(Number(e.target.value)); setHasChanges(true); }}
                  className="w-20"
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface Testimonial {
  id: string;
  parent_name: string;
  parent_name_ar: string | null;
  content_en: string | null;
  content_ar: string | null;
  rating: number;
  is_approved: boolean;
  show_on_landing: boolean;
  sort_order: number;
}

function TestimonialsSettings({ isRTL }: { isRTL: boolean }) {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ parent_name: '', content: '', rating: 5 });

  const loadTestimonials = async () => {
    const { data } = await supabase
      .from('testimonials')
      .select('*')
      .order('sort_order', { ascending: true });
    if (data) setTestimonials(data as unknown as Testimonial[]);
    setLoading(false);
  };

  useEffect(() => { loadTestimonials(); }, []);

  const handleAdd = async () => {
    if (!form.parent_name.trim() || !form.content.trim()) {
      toast.error(isRTL ? 'ادخل الاسم والمحتوى' : 'Enter name and content');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('testimonials').insert({
        parent_name: form.parent_name,
        parent_name_ar: form.parent_name,
        content_en: form.content,
        content_ar: form.content,
        rating: form.rating,
        is_approved: true,
        show_on_landing: true,
        sort_order: testimonials.length
      });
      if (error) throw error;
      setForm({ parent_name: '', content: '', rating: 5 });
      setShowForm(false);
      await loadTestimonials();
      toast.success(isRTL ? 'تمت الإضافة' : 'Added successfully');
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'فشل في الإضافة' : 'Failed to add');
    } finally {
      setSaving(false);
    }
  };

  const toggleLanding = async (id: string, current: boolean) => {
    await supabase.from('testimonials').update({ show_on_landing: !current }).eq('id', id);
    await loadTestimonials();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('testimonials').delete().eq('id', id);
    await loadTestimonials();
    toast.success(isRTL ? 'تم الحذف' : 'Deleted');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle>{isRTL ? 'استبيانات الرضا' : 'Testimonials'}</CardTitle>
          </div>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" />
            {isRTL ? 'إضافة' : 'Add'}
          </Button>
        </div>
        <CardDescription>
          {isRTL ? 'إدارة آراء أولياء الأمور المعروضة على صفحة الهبوط' : 'Manage parent testimonials shown on the landing page'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <div>
              <Label className="text-xs">{isRTL ? 'اسم ولي الأمر' : 'Parent Name'}</Label>
              <Input value={form.parent_name} onChange={(e) => setForm({...form, parent_name: e.target.value})} placeholder={isRTL ? 'مثال: أحمد محمد' : 'e.g. Ahmed Mohamed'} />
            </div>
            <div>
              <Label className="text-xs">{isRTL ? 'المحتوى' : 'Content'}</Label>
              <Input value={form.content} onChange={(e) => setForm({...form, content: e.target.value})} placeholder={isRTL ? 'رأي ولي الأمر...' : 'Parent feedback...'} />
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-xs">{isRTL ? 'التقييم' : 'Rating'}</Label>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(r => (
                  <button key={r} onClick={() => setForm({...form, rating: r})} className="p-0.5">
                    <Star size={18} fill={r <= form.rating ? '#f59e0b' : 'transparent'} color="#f59e0b" />
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleAdd} disabled={saving} size="sm" className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {isRTL ? 'حفظ' : 'Save'}
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : testimonials.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {isRTL ? 'لا توجد استبيانات بعد' : 'No testimonials yet'}
          </p>
        ) : (
          <div className="space-y-3">
            {testimonials.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-3 p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{t.parent_name}</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: t.rating }).map((_, i) => (
                        <Star key={i} size={12} fill="#f59e0b" color="#f59e0b" />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {t.content_en || t.content_ar}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => toggleLanding(t.id, t.show_on_landing)}
                    title={t.show_on_landing ? 'Hide from landing' : 'Show on landing'}
                  >
                    {t.show_on_landing ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
