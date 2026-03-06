import { Search, SlidersHorizontal, Download, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export interface ColumnDef {
  key: string;
  label: string;
  visible: boolean;
}

interface TableToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  columns?: ColumnDef[];
  onColumnToggle?: (key: string) => void;
  onExport?: () => void;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  selectedCount?: number;
  bulkActions?: React.ReactNode;
  className?: string;
}

export function TableToolbar({
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  columns,
  onColumnToggle,
  onExport,
  filters,
  actions,
  selectedCount = 0,
  bulkActions,
  className,
}: TableToolbarProps) {
  const { isRTL } = useLanguage();

  return (
    <div className={cn('space-y-3', className)}>
      {/* Bulk action bar */}
      {selectedCount > 0 && bulkActions && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
          <Badge variant="secondary" className="font-semibold">
            {selectedCount} {isRTL ? 'محدد' : 'selected'}
          </Badge>
          <div className="flex items-center gap-2">{bulkActions}</div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder || (isRTL ? 'بحث...' : 'Search...')}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="ps-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute end-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => onSearchChange('')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Filters */}
        {filters && <div className="flex items-center gap-2 flex-wrap">{filters}</div>}

        {/* Right actions */}
        <div className="flex items-center gap-2 sm:ms-auto">
          {/* Column visibility */}
          {columns && onColumnToggle && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <SlidersHorizontal className="h-4 w-4 me-2" />
                  {isRTL ? 'الأعمدة' : 'Columns'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="w-48">
                <DropdownMenuLabel>{isRTL ? 'إظهار/إخفاء الأعمدة' : 'Toggle columns'}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.key}
                    checked={col.visible}
                    onCheckedChange={() => onColumnToggle(col.key)}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Export */}
          {onExport && (
            <Button variant="outline" size="sm" className="h-9" onClick={onExport}>
              <Download className="h-4 w-4 me-2" />
              {isRTL ? 'تصدير' : 'Export'}
            </Button>
          )}

          {actions}
        </div>
      </div>
    </div>
  );
}
