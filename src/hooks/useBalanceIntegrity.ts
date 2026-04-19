import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type BalanceAccountType = 'customer' | 'employee';

export interface BalanceIntegrityResult {
  cached: number;
  computed: number;
  difference: number;
  hasMismatch: boolean;
  loading: boolean;
}

/**
 * Tier 2 mismatch detection — runs live on ledger pages.
 * Compares cached_balance with computed balance from journal_entry_lines.
 */
export function useBalanceIntegrity(
  accountType: BalanceAccountType,
  accountId: string | undefined,
  enabled = true,
) {
  const query = useQuery({
    queryKey: ['balance-integrity', accountType, accountId],
    queryFn: async () => {
      if (!accountId) return null;
      const { data, error } = await supabase.rpc('check_account_balance_integrity', {
        p_account_type: accountType,
        p_account_id: accountId,
      });
      if (error) throw error;
      return data as { cached: number; computed: number; difference: number };
    },
    enabled: enabled && !!accountId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return {
    cached: Number(query.data?.cached ?? 0),
    computed: Number(query.data?.computed ?? 0),
    difference: Number(query.data?.difference ?? 0),
    hasMismatch: Math.abs(Number(query.data?.difference ?? 0)) > 0.01,
    loading: query.isLoading,
    refetch: query.refetch,
  };
}
