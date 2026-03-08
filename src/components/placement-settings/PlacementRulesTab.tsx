import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Save } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PlacementRule {
  id: string;
  age_group: string;
  foundation_min_for_intermediate: number;
  intermediate_min_for_intermediate: number;
  foundation_min_for_advanced: number;
  intermediate_min_for_advanced: number;
  advanced_min_for_advanced: number;
  confidence_margin: number;
  manual_review_margin: number;
  pass_threshold: number;
}

const AGE_LABELS: Record<string, { en: string; ar: string }> = {
  '6_9': { en: 'Kids (6-9)', ar: 'أطفال (6-9)' },
  '10_13': { en: 'Juniors (10-13)', ar: 'ناشئين (10-13)' },
  '14_18': { en: 'Teens (14-18)', ar: 'مراهقين (14-18)' },
};

const FIELDS: { key: keyof PlacementRule; en: string; ar: string }[] = [
  { key: 'pass_threshold', en: 'Pass Threshold %', ar: 'حد النجاح %' },
  { key: 'foundation_min_for_intermediate', en: 'Foundation min for Intermediate', ar: 'حد Foundation للمستوى المتوسط' },
  { key: 'intermediate_min_for_intermediate', en: 'Intermediate min for Intermediate', ar: 'حد Intermediate للمستوى المتوسط' },
  { key: 'foundation_min_for_advanced', en: 'Foundation min for Advanced', ar: 'حد Foundation للمستوى المتقدم' },
  { key: 'intermediate_min_for_advanced', en: 'Intermediate min for Advanced', ar: 'حد Intermediate للمستوى المتقدم' },
  { key: 'advanced_min_for_advanced', en: 'Advanced min for Advanced', ar: 'حد Advanced للمستوى المتقدم' },
  { key: 'confidence_margin', en: 'Confidence Margin', ar: 'هامش الثقة' },
  { key: 'manual_review_margin', en: 'Manual Review Margin', ar: 'هامش المراجعة اليدوية' },
];

export default function PlacementRulesTab() {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [rules, setRules] = useState<PlacementRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { fetchRules(); }, []);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('placement_rules').select('*').order('age_group');
      if (error) {
        console.error('Error fetching placement rules:', error);
        toast({ title: isRTL ? 'خطأ في تحميل القواعد' : 'Error loading rules', description: error.message, variant: 'destructive' });
      }
      if (data) setRules(data as any);
    } catch (err) {
      console.error('Unexpected error:', err);
    }
    setLoading(false);
  };

  const handleSave = async (r: PlacementRule) => {
    setSaving(r.age_group);
    const { id, age_group, ...rest } = r;
    const { error } = await supabase
      .from('placement_rules')
      .update({ ...rest, updated_at: new Date().toISOString() } as any)
      .eq('id', id);
    
    if (error) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: isRTL ? 'تم الحفظ' : 'Saved' });
    }
    setSaving(null);
  };

  const updateField = (idx: number, field: keyof PlacementRule, value: number) => {
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-64 w-full" />)}</div>;

  return (
    <div className="grid gap-6">
      {rules.map((r, idx) => {
        const label = AGE_LABELS[r.age_group];
        return (
          <Card key={r.id}>
            <CardHeader>
              <CardTitle className="text-lg">{isRTL ? label?.ar : label?.en}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {FIELDS.map(f => (
                  <div key={f.key}>
                    <Label className="text-xs">{isRTL ? f.ar : f.en}</Label>
                    <Input type="number" min={0} max={100} step={1}
                      value={r[f.key] as number}
                      onChange={e => updateField(idx, f.key, parseFloat(e.target.value) || 0)} />
                  </div>
                ))}
              </div>
              <Button onClick={() => handleSave(r)} disabled={saving === r.age_group}>
                <Save className="h-4 w-4 me-1" />
                {saving === r.age_group ? (isRTL ? 'جارٍ الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
