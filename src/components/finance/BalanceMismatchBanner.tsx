import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import type { BalanceAccountType } from '@/hooks/useBalanceIntegrity';

interface Props {
  accountType: BalanceAccountType;
  accountId: string;
  cached: number;
  computed: number;
  difference: number;
  onRebuilt?: () => void;
}

export function BalanceMismatchBanner({
  accountType,
  accountId,
  cached,
  computed,
  difference,
  onRebuilt,
}: Props) {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [rebuilding, setRebuilding] = useState(false);

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      const { error } = await (supabase.rpc as any)('rebuild_account_balance', {
        p_account_type: accountType,
        p_account_id: accountId,
      });
      if (error) throw error;
      toast({
        title: isRTL ? 'تم إعادة بناء الرصيد' : 'Balance rebuilt',
        description: isRTL ? 'تم تصحيح الرصيد المخزن.' : 'Cached balance corrected.',
      });
      onRebuilt?.();
    } catch (err: any) {
      toast({
        title: isRTL ? 'فشلت العملية' : 'Failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {isRTL ? '⚠️ تم اكتشاف عدم تطابق في الرصيد' : '⚠️ Balance mismatch detected'}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-2 mt-2">
        <div className="text-sm">
          {isRTL ? 'الرصيد المخزن: ' : 'Cached: '}
          <strong>{cached.toFixed(2)}</strong>
          {isRTL ? ' | المحسوب: ' : ' | Computed: '}
          <strong>{computed.toFixed(2)}</strong>
          {isRTL ? ' | الفرق: ' : ' | Diff: '}
          <strong>{difference.toFixed(2)}</strong>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRebuild}
          disabled={rebuilding}
          className="w-fit"
        >
          <RefreshCw className={`h-3 w-3 me-1 ${rebuilding ? 'animate-spin' : ''}`} />
          {isRTL ? 'إعادة البناء' : 'Rebuild'}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
