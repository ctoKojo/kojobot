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

interface ExamSettings {
  id: string;
  age_group: string;
  total_questions: number;
  foundation_questions: number;
  intermediate_questions: number;
  advanced_questions: number;
  duration_minutes: number;
  allow_retake: boolean;
  max_attempts: number;
  is_active: boolean;
}

const AGE_GROUP_LABELS: Record<string, { en: string; ar: string }> = {
  '6_9': { en: 'Kids (6-9)', ar: 'أطفال (6-9)' },
  '10_13': { en: 'Juniors (10-13)', ar: 'ناشئين (10-13)' },
  '14_18': { en: 'Teens (14-18)', ar: 'مراهقين (14-18)' },
};

export default function GeneralSettingsTab() {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [settings, setSettings] = useState<ExamSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('placement_exam_settings' as any)
      .select('*')
      .order('age_group');
    if (data) setSettings(data as any);
    setLoading(false);
  };

  const handleSave = async (s: ExamSettings) => {
    setSaving(s.age_group);
    const total = s.foundation_questions + s.intermediate_questions + s.advanced_questions;
    const { error } = await supabase
      .from('placement_exam_settings' as any)
      .update({
        total_questions: total,
        foundation_questions: s.foundation_questions,
        intermediate_questions: s.intermediate_questions,
        advanced_questions: s.advanced_questions,
        duration_minutes: s.duration_minutes,
        allow_retake: s.allow_retake,
        max_attempts: s.max_attempts,
        is_active: s.is_active,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', s.id);
    
    if (error) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: isRTL ? 'تم الحفظ' : 'Saved' });
      fetchSettings();
    }
    setSaving(null);
  };

  const updateField = (idx: number, field: keyof ExamSettings, value: any) => {
    setSettings(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-48 w-full" />)}</div>;

  return (
    <div className="grid gap-6">
      {settings.map((s, idx) => {
        const label = AGE_GROUP_LABELS[s.age_group];
        const total = s.foundation_questions + s.intermediate_questions + s.advanced_questions;
        return (
          <Card key={s.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                {isRTL ? label?.ar : label?.en}
                <Badge variant={s.is_active ? 'default' : 'secondary'}>
                  {s.is_active ? (isRTL ? 'مفعل' : 'Active') : (isRTL ? 'معطل' : 'Inactive')}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-sm">{isRTL ? 'مفعل' : 'Active'}</Label>
                <Switch checked={s.is_active} onCheckedChange={v => updateField(idx, 'is_active', v)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label>{isRTL ? 'أسئلة Foundation' : 'Foundation Qs'}</Label>
                  <Input type="number" min={0} value={s.foundation_questions}
                    onChange={e => updateField(idx, 'foundation_questions', parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>{isRTL ? 'أسئلة Intermediate' : 'Intermediate Qs'}</Label>
                  <Input type="number" min={0} value={s.intermediate_questions}
                    onChange={e => updateField(idx, 'intermediate_questions', parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>{isRTL ? 'أسئلة Advanced' : 'Advanced Qs'}</Label>
                  <Input type="number" min={0} value={s.advanced_questions}
                    onChange={e => updateField(idx, 'advanced_questions', parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>{isRTL ? 'الإجمالي' : 'Total'}</Label>
                  <Input readOnly value={total} className="bg-muted" />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <Label>{isRTL ? 'المدة (دقائق)' : 'Duration (min)'}</Label>
                  <Input type="number" min={0} value={s.duration_minutes}
                    onChange={e => updateField(idx, 'duration_minutes', parseInt(e.target.value) || 0)} />
                  <p className="text-xs text-muted-foreground mt-1">{isRTL ? '0 = بدون حد' : '0 = no limit'}</p>
                </div>
                <div>
                  <Label>{isRTL ? 'أقصى محاولات' : 'Max Attempts'}</Label>
                  <Input type="number" min={1} value={s.max_attempts}
                    onChange={e => updateField(idx, 'max_attempts', parseInt(e.target.value) || 1)} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={s.allow_retake} onCheckedChange={v => updateField(idx, 'allow_retake', v)} />
                  <Label>{isRTL ? 'السماح بالإعادة' : 'Allow Retake'}</Label>
                </div>
              </div>
              <Button onClick={() => handleSave(s)} disabled={saving === s.age_group}>
                <Save className="h-4 w-4 me-1" />
                {saving === s.age_group ? (isRTL ? 'جارٍ الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
