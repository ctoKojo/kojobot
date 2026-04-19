import { Calendar as CalendarIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';

interface MonthSelectorProps {
  value: string; // 'YYYY-MM'
  onChange: (val: string) => void;
  monthsBack?: number; // how many past months to include (default 24)
  monthsForward?: number; // future months (default 0)
}

/**
 * Month selector for the Finance page.
 * Value format: 'YYYY-MM' (calendar month, 1st → last day).
 */
export function MonthSelector({ value, onChange, monthsBack = 24, monthsForward = 0 }: MonthSelectorProps) {
  const { language, isRTL } = useLanguage();
  const now = new Date();
  const options: { key: string; label: string }[] = [];

  for (let i = monthsForward; i >= -monthsBack; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });
    options.push({ key, label });
  }

  return (
    <div className="flex items-center gap-2">
      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[200px] h-9">
          <SelectValue placeholder={isRTL ? 'اختر الشهر' : 'Select month'} />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {options.map(opt => (
            <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Returns 'YYYY-MM' for current calendar month. */
export function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Parse 'YYYY-MM' → { start, end } as Date objects (1st → last day at 23:59:59). */
export function getMonthRange(monthKey: string): { start: Date; end: Date; firstDay: string } {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  return { start, end, firstDay };
}

/** Check if monthKey === current month */
export function isCurrentMonth(monthKey: string): boolean {
  return monthKey === getCurrentMonthKey();
}
