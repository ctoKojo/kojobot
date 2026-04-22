import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/contexts/LanguageContext';
import { Search, Filter, X, Users } from 'lucide-react';
import type { StudentFilters } from './types';
import { DEFAULT_FILTERS } from './types';

interface Props {
  filters: StudentFilters;
  onFiltersChange: (f: StudentFilters) => void;
  disabled?: boolean;
}

interface OptionItem {
  id: string;
  name: string;
  name_ar?: string;
}

export function StudentFiltersPanel({ filters, onFiltersChange, disabled }: Props) {
  const { isRTL } = useLanguage();
  const [groups, setGroups] = useState<OptionItem[]>([]);
  const [levels, setLevels] = useState<OptionItem[]>([]);
  const [ageGroups, setAgeGroups] = useState<OptionItem[]>([]);

  useEffect(() => {
    void loadOptions();
  }, []);

  const loadOptions = async () => {
    const [g, l, a] = await Promise.all([
      supabase.from('groups').select('id, name, name_ar').eq('is_active', true).order('name'),
      supabase.from('levels').select('id, name, name_ar').eq('is_active', true).order('level_order'),
      supabase.from('age_groups').select('id, name, name_ar').eq('is_active', true).order('min_age'),
    ]);
    setGroups((g.data as any) ?? []);
    setLevels((l.data as any) ?? []);
    setAgeGroups((a.data as any) ?? []);
  };

  const toggleArr = <T extends string>(arr: T[], value: T): T[] =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  const labelOf = (o: OptionItem) => (isRTL ? o.name_ar || o.name : o.name);

  const activeCount =
    filters.groupIds.length +
    filters.levelIds.length +
    filters.ageGroupIds.length +
    filters.subscriptionStatuses.length +
    (filters.noParent ? 1 : 0) +
    (filters.hideNoEmail ? 0 : 0);

  const clearAll = () => onFiltersChange({ ...DEFAULT_FILTERS, search: filters.search });

  const subscriptionStatusOptions: Array<{ value: StudentFilters['subscriptionStatuses'][number]; label: string; label_ar: string }> = [
    { value: 'active', label: 'Active', label_ar: 'نشط' },
    { value: 'needs_renewal', label: 'Needs renewal', label_ar: 'يحتاج تجديد' },
    { value: 'expired', label: 'Expired', label_ar: 'منتهي' },
    { value: 'none', label: 'No subscription', label_ar: 'بدون اشتراك' },
  ];

  const FilterPopover = ({
    label,
    items,
    selected,
    onToggle,
  }: {
    label: string;
    items: OptionItem[];
    selected: string[];
    onToggle: (id: string) => void;
  }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9" disabled={disabled}>
          <Filter className="h-3.5 w-3.5" />
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
              {selected.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <ScrollArea className="max-h-72">
          <div className="p-2 space-y-1">
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">
                {isRTL ? 'لا يوجد عناصر' : 'No items'}
              </p>
            ) : (
              items.map((it) => (
                <label
                  key={it.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={selected.includes(it.id)}
                    onCheckedChange={() => onToggle(it.id)}
                  />
                  <span>{labelOf(it)}</span>
                </label>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute top-2.5 h-4 w-4 text-muted-foreground start-2.5" />
          <Input
            placeholder={isRTL ? 'بحث بالاسم أو البريد أو الهاتف...' : 'Search by name, email, or phone...'}
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="ps-8"
            disabled={disabled}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterPopover
            label={isRTL ? 'مجموعة' : 'Group'}
            items={groups}
            selected={filters.groupIds}
            onToggle={(id) => onFiltersChange({ ...filters, groupIds: toggleArr(filters.groupIds, id) })}
          />
          <FilterPopover
            label={isRTL ? 'مستوى' : 'Level'}
            items={levels}
            selected={filters.levelIds}
            onToggle={(id) => onFiltersChange({ ...filters, levelIds: toggleArr(filters.levelIds, id) })}
          />
          <FilterPopover
            label={isRTL ? 'فئة عمرية' : 'Age group'}
            items={ageGroups}
            selected={filters.ageGroupIds}
            onToggle={(id) => onFiltersChange({ ...filters, ageGroupIds: toggleArr(filters.ageGroupIds, id) })}
          />

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-9" disabled={disabled}>
                <Users className="h-3.5 w-3.5" />
                {isRTL ? 'حالة الاشتراك' : 'Subscription'}
                {filters.subscriptionStatuses.length > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
                    {filters.subscriptionStatuses.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="space-y-1">
                {subscriptionStatusOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={filters.subscriptionStatuses.includes(opt.value)}
                      onCheckedChange={() =>
                        onFiltersChange({
                          ...filters,
                          subscriptionStatuses: toggleArr(filters.subscriptionStatuses, opt.value),
                        })
                      }
                    />
                    <span>{isRTL ? opt.label_ar : opt.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll} disabled={disabled} className="h-9 gap-1">
              <X className="h-3.5 w-3.5" />
              {isRTL ? 'مسح الفلاتر' : 'Clear'}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={filters.noParent}
            onCheckedChange={(c) => onFiltersChange({ ...filters, noParent: Boolean(c) })}
            disabled={disabled}
          />
          <span>{isRTL ? 'بدون ولي أمر مرتبط فقط' : 'Only students without linked parent'}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={filters.hideNoEmail}
            onCheckedChange={(c) => onFiltersChange({ ...filters, hideNoEmail: Boolean(c) })}
            disabled={disabled}
          />
          <span>{isRTL ? 'إخفاء من ليس لديه بريد إيميل' : 'Hide students without any email'}</span>
        </label>
      </div>
    </div>
  );
}
