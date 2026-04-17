import { useLanguage } from '@/contexts/LanguageContext';
import { TableToolbar, type ColumnDef } from '@/components/shared/TableToolbar';

interface StudentsFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  columns: ColumnDef[];
  onColumnToggle: (key: string) => void;
}

/**
 * Filters bar for the Students table.
 * Pure UI — receives data via props, owns no fetching.
 */
export function StudentsFilters({
  searchQuery,
  onSearchChange,
  columns,
  onColumnToggle,
}: StudentsFiltersProps) {
  const { isRTL } = useLanguage();

  return (
    <TableToolbar
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      searchPlaceholder={isRTL ? 'بحث بالاسم أو الإيميل...' : 'Search by name or email...'}
      columns={columns}
      onColumnToggle={onColumnToggle}
    />
  );
}
