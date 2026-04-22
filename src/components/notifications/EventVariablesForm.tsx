/**
 * EventVariablesForm — type-aware inputs for notification event variables.
 *
 * Source of truth: `email_event_catalog.available_variables[]` enriched with
 * `type` (text|number|date|url), `sample`, `required`. Falls back gracefully
 * when fields are missing.
 *
 * Usage: pass current `value` (parsed JSON) + onChange. Parent owns the state
 * so the form stays in sync with the JSON tab.
 */
import { useMemo } from 'react';
import { format, parse, isValid } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLanguage } from '@/contexts/LanguageContext';
import type { EventVariable } from '@/lib/templateValidation';

interface Props {
  variables: EventVariable[];
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

export function EventVariablesForm({ variables, value, onChange }: Props) {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const setField = (key: string, v: unknown) => {
    const next = { ...value };
    if (v === '' || v === null || v === undefined) {
      delete next[key];
    } else {
      next[key] = v;
    }
    onChange(next);
  };

  if (!variables || variables.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm py-8 border rounded-md">
        {isRTL
          ? 'هذا الحدث ليس له متغيرات معرّفة'
          : 'This event has no defined variables'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {variables.map((v) => (
        <FieldRow
          key={v.key}
          variable={v}
          value={value[v.key]}
          onChange={(next) => setField(v.key, next)}
          isRTL={isRTL}
        />
      ))}
    </div>
  );
}

function FieldRow({
  variable,
  value,
  onChange,
  isRTL,
}: {
  variable: EventVariable;
  value: unknown;
  onChange: (v: unknown) => void;
  isRTL: boolean;
}) {
  const label = isRTL ? variable.label_ar : variable.label_en;
  const type = variable.type ?? 'text';
  const placeholder = variable.sample ?? '';

  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-3">
      <div className="pt-2 space-y-1">
        <Label className="text-xs font-mono break-all">{variable.key}</Label>
        <div className="text-[11px] text-muted-foreground leading-tight">
          {label}
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
            {type}
          </Badge>
          {variable.required && (
            <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
              {isRTL ? 'مطلوب' : 'required'}
            </Badge>
          )}
        </div>
      </div>
      <div>
        {type === 'date' ? (
          <DateField value={value} onChange={onChange} placeholder={placeholder} />
        ) : type === 'number' ? (
          <Input
            type="number"
            value={value === undefined || value === null ? '' : String(value)}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') return onChange('');
              const n = Number(raw);
              onChange(Number.isFinite(n) ? n : raw);
            }}
            placeholder={placeholder}
          />
        ) : type === 'url' ? (
          <Input
            type="url"
            value={value === undefined || value === null ? '' : String(value)}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
        ) : (
          <Input
            type="text"
            value={value === undefined || value === null ? '' : String(value)}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
        )}
      </div>
    </div>
  );
}

function DateField({
  value,
  onChange,
  placeholder,
}: {
  value: unknown;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const parsed = useMemo(() => {
    if (typeof value !== 'string' || !value) return undefined;
    const d = parse(value, 'yyyy-MM-dd', new Date());
    return isValid(d) ? d : undefined;
  }, [value]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !parsed && 'text-muted-foreground',
          )}
        >
          <CalendarIcon className="me-2 h-4 w-4" />
          {parsed
            ? format(parsed, 'PPP')
            : (typeof value === 'string' && value) || placeholder || 'Pick a date'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parsed}
          onSelect={(d) => onChange(d ? format(d, 'yyyy-MM-dd') : '')}
          initialFocus
          className={cn('p-3 pointer-events-auto')}
        />
      </PopoverContent>
    </Popover>
  );
}
