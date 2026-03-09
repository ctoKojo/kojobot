import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Save } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface V2Settings {
  id: string;
  duration_minutes: number;
  pass_threshold_section_a: number;
  pass_threshold_section_b: number;
  track_margin: number;
  section_a_question_count: number;
  section_b_question_count: number;
  section_c_question_count: number;
  allow_retake: boolean;
  max_attempts: number;
  is_active: boolean;
}

const DEFAULT_SETTINGS: Omit<V2Settings, 'id'> = {
  duration_minutes: 60,
  pass_threshold_section_a: 60,
  pass_threshold_section_b: 60,
  track_margin: 15,
  section_a_question_count: 20,
  section_b_question_count: 20,
  section_c_question_count: 10,
  allow_retake: false,
  max_attempts: 1,
  is_active: true,
};

export default function GeneralSettingsTab() {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [settings, setSettings] = useState<V2Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('placement_v2_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching v2 settings:', error);
        toast({ title: isRTL ? 'خطأ في تحميل الإعدادات' : 'Error loading settings', variant: 'destructive' });
        return;
      }

      if (data) {
        setSettings(data as any);
      } else {
        // Auto-create singleton
        const { data: created, error: createErr } = await supabase
          .from('placement_v2_settings')
          .insert(DEFAULT_SETTINGS as any)
          .select('*')
          .single();
        if (createErr) {
          console.error('Error creating settings:', createErr);
        } else {
          setSettings(created as any);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('placement_v2_settings')
        .update({
          duration_minutes: settings.duration_minutes,
          pass_threshold_section_a: settings.pass_threshold_section_a,
          pass_threshold_section_b: settings.pass_threshold_section_b,
          track_margin: settings.track_margin,
          section_a_question_count: settings.section_a_question_count,
          section_b_question_count: settings.section_b_question_count,
          section_c_question_count: settings.section_c_question_count,
          allow_retake: settings.allow_retake,
          max_attempts: settings.max_attempts,
          is_active: settings.is_active,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', settings.id);

      if (error) {
        toast({ title: isRTL ? 'فشل الحفظ' : 'Save failed', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: isRTL ? 'تم الحفظ بنجاح' : 'Saved successfully' });
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof V2Settings, value: any) => {
    setSettings(prev => prev ? { ...prev, [field]: value } : null);
  };

  if (loading) return <Skeleton className="h-64 w-full" />;

  if (!settings) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground mb-4">{isRTL ? 'خطأ في تحميل الإعدادات' : 'Error loading settings'}</p>
          <Button onClick={fetchSettings}>{isRTL ? 'إعادة المحاولة' : 'Retry'}</Button>
        </CardContent>
      </Card>
    );
  }

  const totalQuestions = settings.section_a_question_count + settings.section_b_question_count + settings.section_c_question_count;

  return (
    <div className="grid gap-6">
      {/* Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            {isRTL ? 'حالة الامتحان' : 'Exam Status'}
            <Badge variant={settings.is_active ? 'default' : 'secondary'}>
              {settings.is_active ? (isRTL ? 'مفعل' : 'Active') : (isRTL ? 'معطل' : 'Inactive')}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-sm">{isRTL ? 'مفعل' : 'Active'}</Label>
            <Switch checked={settings.is_active} onCheckedChange={v => update('is_active', v)} />
          </div>
        </CardHeader>
      </Card>

      {/* Question Counts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{isRTL ? 'عدد الأسئلة لكل قسم' : 'Questions Per Section'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>{isRTL ? 'القسم A (بوابة Level 0)' : 'Section A (Level 0 Gate)'}</Label>
              <Input type="number" min={1} value={settings.section_a_question_count}
                onChange={e => update('section_a_question_count', parseInt(e.target.value) || 1)} />
            </div>
            <div>
              <Label>{isRTL ? 'القسم B (بوابة Level 1)' : 'Section B (Level 1 Gate)'}</Label>
              <Input type="number" min={1} value={settings.section_b_question_count}
                onChange={e => update('section_b_question_count', parseInt(e.target.value) || 1)} />
            </div>
            <div>
              <Label>{isRTL ? 'القسم C (ميول المسار)' : 'Section C (Track Inclination)'}</Label>
              <Input type="number" min={2} step={2} value={settings.section_c_question_count}
                onChange={e => update('section_c_question_count', parseInt(e.target.value) || 2)} />
              <p className="text-xs text-muted-foreground mt-1">{isRTL ? 'يجب أن يكون عدداً زوجياً (نصف SW + نصف HW)' : 'Must be even (half SW + half HW)'}</p>
            </div>
            <div>
              <Label>{isRTL ? 'الإجمالي' : 'Total'}</Label>
              <Input readOnly value={totalQuestions} className="bg-muted" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{isRTL ? 'حدود النجاح والتسكين' : 'Pass Thresholds & Placement'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label>{isRTL ? 'حد نجاح القسم A (%)' : 'Section A Pass (%)'}</Label>
              <Input type="number" min={0} max={100} value={settings.pass_threshold_section_a}
                onChange={e => update('pass_threshold_section_a', parseInt(e.target.value) || 0)} />
              <p className="text-xs text-muted-foreground mt-1">{isRTL ? 'أقل من هذا → Level 0' : 'Below this → Level 0'}</p>
            </div>
            <div>
              <Label>{isRTL ? 'حد نجاح القسم B (%)' : 'Section B Pass (%)'}</Label>
              <Input type="number" min={0} max={100} value={settings.pass_threshold_section_b}
                onChange={e => update('pass_threshold_section_b', parseInt(e.target.value) || 0)} />
              <p className="text-xs text-muted-foreground mt-1">{isRTL ? 'أقل من هذا → Level 1' : 'Below this → Level 1'}</p>
            </div>
            <div>
              <Label>{isRTL ? 'هامش تحديد المسار (%)' : 'Track Margin (%)'}</Label>
              <Input type="number" min={0} max={50} value={settings.track_margin}
                onChange={e => update('track_margin', parseInt(e.target.value) || 0)} />
              <p className="text-xs text-muted-foreground mt-1">{isRTL ? 'فرق أقل = balanced → مراجعة يدوية' : 'Below = balanced → manual review'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Duration & Retake */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{isRTL ? 'إعدادات أخرى' : 'Other Settings'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label>{isRTL ? 'المدة (دقائق)' : 'Duration (min)'}</Label>
              <Input type="number" min={0} value={settings.duration_minutes}
                onChange={e => update('duration_minutes', parseInt(e.target.value) || 0)} />
              <p className="text-xs text-muted-foreground mt-1">{isRTL ? '0 = بدون حد' : '0 = no limit'}</p>
            </div>
            <div>
              <Label>{isRTL ? 'أقصى محاولات' : 'Max Attempts'}</Label>
              <Input type="number" min={1} value={settings.max_attempts}
                onChange={e => update('max_attempts', parseInt(e.target.value) || 1)} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={settings.allow_retake} onCheckedChange={v => update('allow_retake', v)} />
              <Label>{isRTL ? 'السماح بالإعادة' : 'Allow Retake'}</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <Button onClick={handleSave} disabled={saving} className="w-fit">
        <Save className="h-4 w-4 me-1" />
        {saving ? (isRTL ? 'جارٍ الحفظ...' : 'Saving...') : (isRTL ? 'حفظ الإعدادات' : 'Save Settings')}
      </Button>
    </div>
  );
}
