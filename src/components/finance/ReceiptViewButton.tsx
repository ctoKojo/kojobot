import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  /** storage path inside payment-receipts bucket */
  path: string | null | undefined;
  size?: 'sm' | 'icon';
  variant?: 'ghost' | 'outline';
}

/**
 * Lazy receipt viewer — generates signed URL only on click (not on render).
 * Renders nothing if path is empty.
 */
export function ReceiptViewButton({ path, size = 'sm', variant = 'ghost' }: Props) {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  if (!path) return null;

  const handleClick = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('payment-receipts')
        .createSignedUrl(path, 60);
      if (error || !data?.signedUrl) throw error || new Error('No URL');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'تعذر فتح الإيصال' : 'Cannot open receipt',
        description: e?.message || (isRTL ? 'حاول مرة أخرى' : 'Try again'),
      });
    } finally {
      setLoading(false);
    }
  };

  if (size === 'icon') {
    return (
      <Button
        type="button"
        variant={variant}
        size="icon"
        className="h-7 w-7"
        onClick={handleClick}
        disabled={loading}
        title={isRTL ? 'عرض الإيصال' : 'View receipt'}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className="h-7 gap-1"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
      <span className="text-xs">{isRTL ? 'الإيصال' : 'Receipt'}</span>
    </Button>
  );
}
