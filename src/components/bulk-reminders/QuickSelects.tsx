import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';
import type { StudentRow } from './types';

interface Props {
  students: StudentRow[];
  onSelect: (ids: Set<string>) => void;
  disabled?: boolean;
}

export function QuickSelects({ students, onSelect, disabled }: Props) {
  const { isRTL } = useLanguage();

  const selectIf = (predicate: (s: StudentRow) => boolean) => {
    const ids = new Set(students.filter(predicate).map((s) => s.user_id));
    onSelect(ids);
  };

  const today = new Date();
  const in7days = new Date();
  in7days.setDate(today.getDate() + 7);

  const buttons = [
    {
      label: isRTL ? 'الكل المعروض' : 'All visible',
      onClick: () => selectIf(() => true),
    },
    {
      label: isRTL ? 'يحتاج تجديد' : 'Needs renewal',
      onClick: () =>
        selectIf((s) => {
          if (!s.subscription_end_date) return false;
          const end = new Date(s.subscription_end_date);
          return end >= today && end <= in7days;
        }),
    },
    {
      label: isRTL ? 'اشتراك منتهي' : 'Expired subscription',
      onClick: () =>
        selectIf((s) => s.subscription_status === 'expired'),
    },
    {
      label: isRTL ? 'له ولي أمر' : 'Has parent',
      onClick: () => selectIf((s) => s.parents.length > 0),
    },
    {
      label: isRTL ? 'له بريد طالب' : 'Has student email',
      onClick: () => selectIf((s) => Boolean(s.email)),
    },
    {
      label: isRTL ? 'مسح الاختيار' : 'Clear selection',
      onClick: () => onSelect(new Set()),
      variant: 'ghost' as const,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Zap className="h-3.5 w-3.5" />
        {isRTL ? 'اختيار سريع:' : 'Quick select:'}
      </span>
      {buttons.map((b) => (
        <Button
          key={b.label}
          variant={b.variant ?? 'outline'}
          size="sm"
          onClick={b.onClick}
          disabled={disabled}
          className="h-7 text-xs"
        >
          {b.label}
        </Button>
      ))}
    </div>
  );
}
