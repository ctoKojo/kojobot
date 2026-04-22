import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Send, X, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Lightweight banner shown ONCE on the dashboard if the user hasn't
 * linked Telegram yet. After dismiss (or if already linked), it never
 * shows again — user can still link from the notifications settings page.
 */
export function TelegramLinkPromptBanner() {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [linkRes, profRes] = await Promise.all([
        supabase
          .from('telegram_links')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('telegram_prompt_dismissed_at')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const isLinked = !!linkRes.data;
      const isDismissed = !!profRes.data?.telegram_prompt_dismissed_at;
      setShow(!isLinked && !isDismissed);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const dismiss = async () => {
    setShow(false);
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ telegram_prompt_dismissed_at: new Date().toISOString() })
      .eq('user_id', user.id);
  };

  const goLink = () => {
    navigate('/my-notifications');
  };

  if (!show) return null;

  return (
    <Card className="border-[#2AABEE]/30 bg-gradient-to-br from-[#2AABEE]/5 to-transparent">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="rounded-md bg-[#2AABEE]/15 p-2.5 shrink-0">
          <Send className="h-5 w-5 text-[#2AABEE]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">
            {isRTL ? 'اربط تيليجرام واستلم الإشعارات فورًا' : 'Link Telegram for instant notifications'}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {isRTL
              ? 'تذكير الحصص والدرجات والاستحقاقات تيجي على موبايلك مباشرة'
              : 'Class reminders, grades, and dues delivered straight to your phone'}
          </div>
        </div>
        <Button size="sm" onClick={goLink} className="bg-[#2AABEE] hover:bg-[#229ED9] shrink-0">
          {isRTL ? 'اربط دلوقتي' : 'Link now'}
          <ArrowRight className={`h-3.5 w-3.5 ms-1 ${isRTL ? 'rotate-180' : ''}`} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={dismiss}
          className="h-8 w-8 shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
