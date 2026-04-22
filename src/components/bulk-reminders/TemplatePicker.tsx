import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import type { CatalogEvent } from './types';
import { Loader2, Code } from 'lucide-react';

interface Props {
  templateName: string;
  onTemplateChange: (key: string) => void;
  templateData: Record<string, string>;
  onTemplateDataChange: (data: Record<string, string>) => void;
  customSubject: string;
  onCustomSubjectChange: (v: string) => void;
  customMessage: string;
  onCustomMessageChange: (v: string) => void;
  disabled?: boolean;
}

export function TemplatePicker({
  templateName,
  onTemplateChange,
  templateData,
  onTemplateDataChange,
  customSubject,
  onCustomSubjectChange,
  customMessage,
  onCustomMessageChange,
  disabled,
}: Props) {
  const { isRTL } = useLanguage();
  const [events, setEvents] = useState<CatalogEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('email_event_catalog')
      .select('event_key, display_name_en, display_name_ar, category, available_variables')
      .eq('is_active', true)
      .order('category')
      .order('event_key');
    setEvents((data as any) ?? []);
    setLoading(false);
  };

  const grouped = events.reduce<Record<string, CatalogEvent[]>>((acc, e) => {
    (acc[e.category] ||= []).push(e);
    return acc;
  }, {});

  const selected = events.find((e) => e.event_key === templateName);
  const variables = selected?.available_variables ?? [];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{isRTL ? 'قالب الإيميل' : 'Email template'}</Label>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isRTL ? 'جاري تحميل القوالب...' : 'Loading templates...'}
          </div>
        ) : (
          <Select value={templateName} onValueChange={onTemplateChange} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder={isRTL ? 'اختر قالب' : 'Select a template'} />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(grouped).map(([cat, items]) => (
                <SelectGroup key={cat}>
                  <SelectLabel className="capitalize">{cat}</SelectLabel>
                  {items.map((e) => (
                    <SelectItem key={e.event_key} value={e.event_key}>
                      {isRTL ? e.display_name_ar : e.display_name_en}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        )}
        {selected && (
          <p className="text-xs text-muted-foreground">
            {isRTL ? 'مفتاح:' : 'Key:'} <code className="text-foreground">{selected.event_key}</code>
          </p>
        )}
      </div>

      {variables.length > 0 && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">
              {isRTL ? 'متغيرات القالب' : 'Template variables'}
            </h4>
            <Badge variant="secondary" className="text-xs">
              {variables.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {isRTL
              ? 'هتتعبأ تلقائياً للطلاب وأولياء الأمور. اكتب قيمة هنا لو عايز توفر قيمة افتراضية للكل.'
              : 'These auto-fill per recipient. Fill in defaults if you want to override.'}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {variables.map((v) => {
              const auto = ['recipientName', 'studentName', 'parentName', 'groupName', 'levelName'].includes(v.key);
              return (
                <div key={v.key} className="space-y-1">
                  <Label className="text-xs flex items-center gap-2">
                    <span>{isRTL ? v.label_ar : v.label_en}</span>
                    <code className="text-[10px] text-muted-foreground">{`{{${v.key}}}`}</code>
                    {auto && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4">
                        {isRTL ? 'تلقائي' : 'auto'}
                      </Badge>
                    )}
                  </Label>
                  <Input
                    value={templateData[v.key] ?? ''}
                    onChange={(e) =>
                      onTemplateDataChange({ ...templateData, [v.key]: e.target.value })
                    }
                    placeholder={
                      auto
                        ? isRTL
                          ? '— يتم التعبئة تلقائياً —'
                          : '— filled automatically —'
                        : (isRTL ? 'أدخل قيمة' : 'Enter value')
                    }
                    disabled={disabled}
                    className="h-8 text-sm"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3 rounded-lg border border-dashed p-4">
        <h4 className="text-sm font-semibold">
          {isRTL ? 'تخصيص (اختياري)' : 'Customize (optional)'}
        </h4>
        <p className="text-xs text-muted-foreground">
          {isRTL
            ? 'سيب فاضي لاستخدام القالب الافتراضي. تقدر تستخدم نفس المتغيرات زي {{studentName}}.'
            : 'Leave blank to use the default template. You can use variables like {{studentName}}.'}
        </p>
        <div className="space-y-1">
          <Label className="text-xs">{isRTL ? 'موضوع مخصص' : 'Custom subject'}</Label>
          <Input
            value={customSubject}
            onChange={(e) => onCustomSubjectChange(e.target.value)}
            placeholder={isRTL ? 'مثال: تذكير مهم - {{studentName}}' : 'e.g. Important reminder - {{studentName}}'}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{isRTL ? 'رسالة مخصصة (HTML)' : 'Custom message (HTML)'}</Label>
          <Textarea
            value={customMessage}
            onChange={(e) => onCustomMessageChange(e.target.value)}
            placeholder={isRTL ? '<p>محتوى مخصص بالكامل...</p>' : '<p>Fully custom content...</p>'}
            rows={4}
            disabled={disabled}
            className="font-mono text-xs"
          />
        </div>
      </div>
    </div>
  );
}
