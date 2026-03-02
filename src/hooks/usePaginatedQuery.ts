import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type TableNames = keyof Database['public']['Tables'];

interface PaginationState {
  page: number;
  pageSize: number;
  totalCount: number;
}

interface UsePaginatedQueryOptions {
  initialPageSize?: number;
}

interface PaginatedResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setPageSize: (size: number) => void;
  refetch: () => Promise<void>;
}

export function usePaginatedQuery<T>(
  tableName: TableNames,
  options: UsePaginatedQueryOptions = {}
): PaginatedResult<T> & { 
  fetchPage: (
    queryBuilder?: (query: ReturnType<typeof supabase.from>) => any
  ) => Promise<void>;
} {
  const { initialPageSize = 20 } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: initialPageSize,
    totalCount: 0,
  });
  const [queryModifier, setQueryModifier] = useState<((query: any) => any) | null>(null);

  const totalPages = useMemo(() => 
    Math.ceil(pagination.totalCount / pagination.pageSize) || 1,
    [pagination.totalCount, pagination.pageSize]
  );

  const hasNextPage = pagination.page < totalPages;
  const hasPreviousPage = pagination.page > 1;

  const fetchPage = useCallback(async (
    modifier?: (query: any) => any
  ) => {
    setLoading(true);
    setError(null);
    
    if (modifier) {
      setQueryModifier(() => modifier);
    }

    const activeModifier = modifier || queryModifier;

    try {
      let query = supabase
        .from(tableName)
        .select('*', { count: 'exact' });

      // Apply custom query modifications
      if (activeModifier) {
        query = activeModifier(query);
      }

      // Apply pagination
      const from = (pagination.page - 1) * pagination.pageSize;
      const to = from + pagination.pageSize - 1;
      query = query.range(from, to);

      const { data: result, error: queryError, count } = await query;

      if (queryError) throw queryError;

      setData((result || []) as T[]);
      setPagination(prev => ({
        ...prev,
        totalCount: count || 0,
      }));
    } catch (err) {
      setError(err as Error);
      console.error(`Error fetching ${tableName}:`, err);
    } finally {
      setLoading(false);
    }
  }, [tableName, pagination.page, pagination.pageSize, queryModifier]);

  const goToPage = useCallback((newPage: number) => {
    const validPage = Math.max(1, Math.min(newPage, totalPages));
    setPagination(prev => ({ ...prev, page: validPage }));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setPagination(prev => ({ ...prev, page: prev.page + 1 }));
    }
  }, [hasNextPage]);

  const previousPage = useCallback(() => {
    if (hasPreviousPage) {
      setPagination(prev => ({ ...prev, page: prev.page - 1 }));
    }
  }, [hasPreviousPage]);

  const setPageSize = useCallback((size: number) => {
    setPagination(prev => ({ 
      ...prev, 
      pageSize: size,
      page: 1 // Reset to first page when changing page size
    }));
  }, []);

  const refetch = useCallback(async () => {
    await fetchPage(queryModifier || undefined);
  }, [fetchPage, queryModifier]);

  return {
    data,
    loading,
    error,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalCount: pagination.totalCount,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    goToPage,
    nextPage,
    previousPage,
    setPageSize,
    refetch,
    fetchPage,
  };
}
