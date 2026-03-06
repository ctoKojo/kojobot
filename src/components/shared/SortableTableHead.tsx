import { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc' | null;

interface SortableTableHeadProps {
  children: React.ReactNode;
  sortKey: string;
  currentSort: string | null;
  currentDirection: SortDirection;
  onSort: (key: string) => void;
  className?: string;
}

export function SortableTableHead({
  children,
  sortKey,
  currentSort,
  currentDirection,
  onSort,
  className,
}: SortableTableHeadProps) {
  const isActive = currentSort === sortKey;

  return (
    <TableHead
      className={cn('cursor-pointer select-none hover:bg-muted/50 transition-colors', className)}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1.5">
        {children}
        {isActive ? (
          currentDirection === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5 text-primary" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-primary" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
        )}
      </div>
    </TableHead>
  );
}

export function useTableSort(defaultKey?: string, defaultDirection: SortDirection = null) {
  const [sortKey, setSortKey] = useState<string | null>(defaultKey || null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDirection);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') {
        setSortKey(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortData = <T extends Record<string, any>>(data: T[], keyFn?: (item: T, key: string) => any): T[] => {
    if (!sortKey || !sortDirection) return data;
    return [...data].sort((a, b) => {
      const valA = keyFn ? keyFn(a, sortKey) : a[sortKey];
      const valB = keyFn ? keyFn(b, sortKey) : b[sortKey];
      
      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      
      let comparison = 0;
      if (typeof valA === 'string') {
        comparison = valA.localeCompare(valB, undefined, { numeric: true });
      } else {
        comparison = valA < valB ? -1 : valA > valB ? 1 : 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  return { sortKey, sortDirection, handleSort, sortData };
}
