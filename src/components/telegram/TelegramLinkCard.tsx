import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, Link2, Unlink, Copy, CheckCircle2, ExternalLink } from 'lucide-react';

interface TelegramLink {
  id: string;
  chat_id: number;
  telegram_username: string | null;
  telegram_first_name: string | null;
  is_active: boolean;
  linked_at: string;
}

interface LinkCode {
  code: string;
  expires_at: string;
}

export function TelegramLinkCard() {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [code, setCode] = useState<LinkCode | null>(null);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<string>('');

  const loadLink = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('telegram_links')
      .select('id, chat_id, telegram_username, telegram_first_name, is_active, linked_at')
      .eq('user_id', userData.user.id)
      .eq('is_active', true)
      .maybeSingle();
    setLink(data as TelegramLink | null);
    setLoading(false);
  };

  const loadBotInfo = async () => {
    try {
      const { data } = await supabase.functions.invoke('telegram-bot-info', { body: {} });
      if (data?.username) setBotUsername(data.username);
    } catch {
      /* ignore — fallback shows manual instructions */
    }
  };

  useEffect(() => {
    void loadLink();
    void loadBotInfo();
  }, []);

  // Auto-refresh link status when a code is active (poll every 4s)
  useEffect(() => {
    if (!code || link) return;
    const interval = setInterval(() => {
      void loadLink();
    }, 4000);
    return () => clearInterval(interval);
  }, [code, link]);

  // Countdown for code expiry
  useEffect(() => {
    if (!code) {
      setCountdown('');
      return;
    }
    const tick = () => {
      const remaining = new Date(code.expires_at).getTime() - Date.now();
      if (remaining <= 0) {
        setCode(null);
        setCountdown('');
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${mins}:${String(secs).padStart(2, '0')}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [code]);

  const generateCode = async () => {
    setGenerating(true);
    const { data, error } = await supabase.rpc('generate_telegram_link_code');
    setGenerating(false);
    if (error || !data?.[0]) {
      toast({
        title: isRTL ? 'فشل توليد الكود' : 'Failed to generate code',
        description: error?.message,
        variant: 'destructive',
      });
      return;
    }
    setCode({ code: data[0].code, expires_at: data[0].expires_at });
  };

  const copyCommand = () => {
    if (!code) return;
    const text = `/start ${code.code}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: isRTL ? 'تم النسخ' : 'Copied' });
  };

  const unlink = async () => {
    if (!link) return;
    setUnlinking(true);
    const { error } = await supabase
      .from('telegram_links')
      .update({ is_active: false, unlinked_at: new Date().toISOString() })
      .eq('id', link.id);
    setUnlinking(false);
    if (error) {
      toast({
        title: isRTL ? 'فشل فك الربط' : 'Unlink failed',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    setLink(null);
    setCode(null);
    toast({
      title: isRTL ? 'تم فك الربط' : 'Unlinked',
      description: isRTL ? 'لن تتلقى إشعارات Telegram بعد الآن' : 'You will no longer receive Telegram notifications',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-[#2AABEE]/10 p-2">
            <Send className="h-5 w-5 text-[#2AABEE]" />
          </div>
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              {isRTL ? 'إشعارات Telegram' : 'Telegram Notifications'}
              {link && (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="h-3 w-3 me-1" />
                  {isRTL ? 'مفعّل' : 'Connected'}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {isRTL
                ? 'استقبل إشعارات الأكاديمية مباشرة على Telegram'
                : 'Receive academy notifications directly on Telegram'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {link ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 text-sm">
                <div className="font-medium">
                  {link.telegram_first_name || link.telegram_username || `Chat ${link.chat_id}`}
                </div>
                {link.telegram_username && (
                  <div className="text-xs text-muted-foreground">@{link.telegram_username}</div>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={unlink}
                disabled={unlinking}
              >
                <Unlink className="h-4 w-4 me-2" />
                {isRTL ? 'فك الربط' : 'Unlink'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isRTL
                ? 'تقدر تتحكم في أنواع الإشعارات اللي توصلك من الإعدادات تحت.'
                : 'Control which notifications you receive in the preferences below.'}
            </p>
          </div>
        ) : code ? (
          <div className="space-y-4">
            <div className="rounded-md border-2 border-dashed border-[#2AABEE]/40 bg-[#2AABEE]/5 p-4 space-y-3">
              <div className="text-sm font-medium">
                {isRTL ? 'خطوات الربط:' : 'Linking steps:'}
              </div>
              <ol className="text-sm space-y-2 list-decimal list-inside">
                <li>
                  {isRTL ? 'افتح البوت على Telegram:' : 'Open the bot on Telegram:'}{' '}
                  {botUsername ? (
                    <a
                      href={`https://t.me/${botUsername}?start=${code.code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#2AABEE] hover:underline font-medium"
                    >
                      @{botUsername} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">
                      {isRTL ? '(جاري التحميل...)' : '(loading...)'}
                    </span>
                  )}
                </li>
                <li>
                  {isRTL ? 'ابعت الأمر ده للبوت:' : 'Send this command to the bot:'}
                </li>
              </ol>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-md bg-background border font-mono text-sm">
                  /start {code.code}
                </code>
                <Button size="sm" variant="outline" onClick={copyCommand}>
                  {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {isRTL ? 'صلاحية الكود:' : 'Code expires in:'} <strong>{countdown}</strong>
                </span>
                <Button size="sm" variant="ghost" onClick={generateCode} disabled={generating}>
                  {isRTL ? 'كود جديد' : 'New code'}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {isRTL
                ? '⏳ بنتأكد من الربط تلقائياً... هتظهر علامة ✓ لما تكمل الخطوات'
                : '⏳ Auto-checking for confirmation... you\'ll see ✓ once linked'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isRTL
                ? 'اربط حسابك بـ Telegram عشان توصلك التذكيرات والإشعارات فوراً.'
                : 'Link your Telegram account to receive instant reminders and notifications.'}
            </p>
            <Button onClick={generateCode} disabled={generating} className="bg-[#2AABEE] hover:bg-[#229ED9]">
              <Send className="h-4 w-4 me-2" />
              {generating
                ? isRTL ? 'جاري التوليد...' : 'Generating...'
                : isRTL ? 'ربط Telegram' : 'Link Telegram'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
