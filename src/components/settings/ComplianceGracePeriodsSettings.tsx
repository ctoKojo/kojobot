import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Save, Loader2, Clock, History } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface GracePeriods {
  attendance_minutes: number;
  quiz_hours: number;
  assignment_hours: number;
  evaluation_hours: number;
  makeup_multiplier: number;
}

const DEFAULTS: GracePeriods = {
  attendance_minutes: 60,
  quiz_hours: 24,
  assignment_hours: 24,
  evaluation_hours: 24,
  makeup_multiplier: 1.5,
};

interface Props {
  isRTL: boolean;
}

interface Bounds {
  min: number;
  max: number;
  step?: number;
}

const BOUNDS: Record<keyof GracePeriods, Bounds> = {
  attendance_minutes: { min: 0, max: 180, step: 1 },
  quiz_hours: { min: 1, max: 72, step: 1 },
  assignment_hours: { min: 1, max: 72, step: 1 },
  evaluation_hours: { min: 1, max: 72, step: 1 },
  makeup_multiplier: { min: 1.0, max: 3.0, step: 0.1 },
};

export function ComplianceGracePeriodsSettings({ isRTL }: Props) {
  const { user } = useAuth();
  const [values, setValues] = useState<GracePeriods>(DEFAULTS);
  const [originalValues, setOriginalValues] = useState<GracePeriods>(DEFAULTS);
  const [version, setVersion] = useState<number>(1);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedByEmail, setUpdatedByEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('value, version, updated_at, updated_by')
        .eq('key', 'compliance_grace_periods')
        .maybeSingle();

      if (data?.value) {
        const v = { ...DEFAULTS, ...(data.value as unknown as Partial<GracePeriods>) };
        setValues(v);
        setOriginalValues(v);
        setVersion(data.version ?? 1);
        setUpdatedAt(data.updated_at ?? null);

        if (data.updated_by) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('user_id', data.updated_by)
            .maybeSingle();
          setUpdatedByEmail(profile?.full_name || profile?.email || null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const hasChanges = JSON.stringify(values) !== JSON.stringify(originalValues);

  const validate = (): string | null => {
    for (const key of Object.keys(BOUNDS) as (keyof GracePeriods)[]) {
      const v = values[key];
      const b = BOUNDS[key];
      if (Number.isNaN(v) || v < b.min || v > b.max) {
        return isRTL
          ? `قيمة ${key} يجب أن تكون بين ${b.min} و ${b.max}`
          : `${key} must be between ${b.min} and ${b.max}`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .update({
          value: values as any,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('key', 'compliance_grace_periods')
        .select('value, version, updated_at')
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setOriginalValues(values);
        setVersion(data.version ?? version + 1);
        setUpdatedAt(data.updated_at ?? new Date().toISOString());
      }
      toast.success(isRTL ? 'تم حفظ الفترات السماحية' : 'Grace periods saved');
    } catch (e: any) {
      console.error('Save grace periods error:', e);
      toast.error(
        isRTL
          ? `فشل الحفظ: ${e.message || 'خطأ غير معروف'}`
          : `Save failed: ${e.message || 'Unknown error'}`
      );
    } finally {
      setSaving(false);
    }
  };

  const formatPreview = (base: number, unitAr: string, unitEn: string) => {
    const makeup = Math.ceil(base * values.makeup_multiplier);
    return isRTL
      ? `عادي: ${base} ${unitAr} • تعويضي: ${makeup} ${unitAr}`
      : `Normal: ${base} ${unitEn} • Makeup: ${makeup} ${unitEn}`;
  };

  const fields: Array<{
    key: keyof GracePeriods;
    labelAr: string;
    labelEn: string;
    unitAr: string;
    unitEn: string;
    isMultiplier?: boolean;
  }> = [
    {
      key: 'attendance_minutes',
      labelAr: 'مهلة تسجيل الحضور',
      labelEn: 'Attendance grace',
      unitAr: 'دقيقة',
      unitEn: 'minutes',
    },
    {
      key: 'quiz_hours',
      labelAr: 'مهلة إسناد الكويز',
      labelEn: 'Quiz grace',
      unitAr: 'ساعة',
      unitEn: 'hours',
    },
    {
      key: 'assignment_hours',
      labelAr: 'مهلة رفع الواجب',
      labelEn: 'Assignment grace',
      unitAr: 'ساعة',
      unitEn: 'hours',
    },
    {
      key: 'evaluation_hours',
      labelAr: 'مهلة تقييم الطلاب',
      labelEn: 'Evaluation grace',
      unitAr: 'ساعة',
      unitEn: 'hours',
    },
    {
      key: 'makeup_multiplier',
      labelAr: 'مضاعف التعويضية',
      labelEn: 'Makeup multiplier',
      unitAr: '×',
      unitEn: '×',
      isMultiplier: true,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            <CardTitle>
              {isRTL ? 'الفترات السماحية للإنذارات' : 'Compliance Grace Periods'}
            </CardTitle>
          </div>
          {hasChanges && (
            <Button onClick={handleSave} disabled={saving} size="sm">
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
          {isRTL
            ? 'فترة الانتظار قبل إصدار إنذار للمدرب — تطبق على السيشنات العادية، ويتضاعف تلقائيًا للتعويضية.'
            : 'Grace window before issuing an instructor warning — applied to normal sessions, multiplied automatically for makeup sessions.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-4">
              {fields.map((f) => {
                const b = BOUNDS[f.key];
                const value = values[f.key];
                const isOutOfRange = value < b.min || value > b.max;
                return (
                  <div
                    key={f.key}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <Label className="text-base">{isRTL ? f.labelAr : f.labelEn}</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isRTL
                          ? `الحد: ${b.min} - ${b.max}`
                          : `Range: ${b.min} - ${b.max}`}
                      </p>
                      {!f.isMultiplier && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {f.key === 'attendance_minutes'
                            ? formatPreview(value, f.unitAr, f.unitEn)
                            : formatPreview(value, f.unitAr, f.unitEn)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={b.min}
                        max={b.max}
                        step={b.step || 1}
                        value={value}
                        onChange={(e) =>
                          setValues({
                            ...values,
                            [f.key]: f.isMultiplier
                              ? parseFloat(e.target.value)
                              : parseInt(e.target.value, 10),
                          })
                        }
                        className={`w-24 ${isOutOfRange ? 'border-destructive' : ''}`}
                      />
                      <span className="text-sm text-muted-foreground w-16">
                        {isRTL ? f.unitAr : f.unitEn}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Multiplier preview banner */}
            <div className="p-3 rounded-lg bg-muted/50 border border-dashed">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {isRTL ? 'معاينة التطبيق على التعويضية' : 'Makeup application preview'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {isRTL
                  ? `المضاعف الحالي ×${values.makeup_multiplier}: كل فترة تُضرب وتُقرب لأعلى.`
                  : `Current multiplier ×${values.makeup_multiplier}: each grace is multiplied and ceiled.`}
              </p>
            </div>

            {/* Audit trail */}
            <div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground border-t flex-wrap">
              <Badge variant="outline" className="gap-1">
                <History className="h-3 w-3" />
                {isRTL ? `الإصدار ${version}` : `Version ${version}`}
              </Badge>
              {updatedAt && (
                <span>
                  {isRTL ? 'آخر تعديل:' : 'Last updated:'}{' '}
                  {new Date(updatedAt).toLocaleString(isRTL ? 'ar-EG' : 'en-US')}
                </span>
              )}
              {updatedByEmail && (
                <span>
                  {isRTL ? 'بواسطة:' : 'by:'} {updatedByEmail}
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
