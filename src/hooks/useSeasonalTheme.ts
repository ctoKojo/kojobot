import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Checks if a seasonal theme is currently active based on the database
 * and the Africa/Cairo timezone.
 */
export function useSeasonalTheme(themeKey: string): boolean {
  const { data: isActive = false } = useQuery({
    queryKey: ['seasonal-theme', themeKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('seasonal_themes')
        .select('start_date, end_date, timezone')
        .eq('theme_key', themeKey)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (!data) return false;

      // Get current date in Cairo timezone
      const now = new Date();
      const cairoDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: data.timezone || 'Africa/Cairo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now); // returns yyyy-MM-dd

      return cairoDate >= data.start_date && cairoDate <= data.end_date;
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000,
  });

  return isActive;
}
