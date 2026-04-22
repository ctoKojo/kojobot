import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Send, Loader2 } from 'lucide-react';
import type { EmailTemplateRow } from './TemplateEditorDialog';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: EmailTemplateRow;
}

export function SendTestDialog({ open, onOpenChange, template }: Props) {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [email, setEmail] = useState(user?.email ?? '');
  const [channel, setChannel] = useState<'email' | 'telegram' | 'both'>('email');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (channel !== 'telegram' && !email.trim()) {
      toast({ title: isRTL ? 'إدخال الإيميل مطلوب' : 'Email required', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const errors: string[] = [];

      if (channel === 'email' || channel === 'both') {
        const { error } = await supabase.functions.invoke('send-email', {
          body: {
            to: email,
            templateName: template.name,
            data: { recipientName: 'Test Recipient', studentName: 'Test Student' },
            isTest: true,
          },
        });
        if (error) errors.push(`Email: ${error.message}`);
      }

      if (channel === 'telegram' || channel === 'both') {
        if (!user?.id) {
          errors.push('Telegram requires a logged-in user');
        } else {
          const { error } = await supabase.functions.invoke('send-telegram', {
            body: {
              userId: user.id,
              templateName: template.name,
              data: { recipientName: 'Test Recipient', studentName: 'Test Student' },
              isTest: true,
            },
          });
          if (error) errors.push(`Telegram: ${error.message}`);
        }
      }

      // record test result on template
      const status = errors.length === 0 ? 'success' : 'failed';
      await supabase
        .from('email_templates')
        .update({ last_test_at: new Date().toISOString(), last_test_status: status })
        .eq('id', template.id);

      if (errors.length > 0) {
        toast({
          title: isRTL ? 'الاختبار فشل' : 'Test failed',
          description: errors.join('; '),
          variant: 'destructive',
        });
      } else {
        toast({
          title: isRTL ? 'تم إرسال الاختبار' : 'Test sent',
          description: isRTL ? 'افحص إيميلك / تيليجرام' : 'Check your inbox / Telegram',
        });
        onOpenChange(false);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isRTL ? 'إرسال اختبار' : 'Send test'}</DialogTitle>
          <DialogDescription>
            {isRTL
              ? `يُرسل القالب "${template.name}" ببيانات تجريبية للجهة المختارة.`
              : `Sends "${template.name}" with sample data to the chosen target.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{isRTL ? 'القناة' : 'Channel'}</Label>
            <RadioGroup value={channel} onValueChange={(v) => setChannel(v as any)}>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="ch-email" value="email" />
                <Label htmlFor="ch-email" className="font-normal cursor-pointer">
                  {isRTL ? 'إيميل' : 'Email'}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="ch-tg" value="telegram" />
                <Label htmlFor="ch-tg" className="font-normal cursor-pointer">Telegram</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="ch-both" value="both" />
                <Label htmlFor="ch-both" className="font-normal cursor-pointer">
                  {isRTL ? 'الاتنين' : 'Both'}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {channel !== 'telegram' && (
            <div className="space-y-2">
              <Label>{isRTL ? 'إيميل المستلم' : 'Recipient email'}</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" dir="ltr" />
            </div>
          )}

          {channel !== 'email' && (
            <div className="text-xs text-muted-foreground">
              {isRTL
                ? 'تيليجرام يُرسل لحسابك المربوط (لازم يكون مربوط).'
                : 'Telegram sends to your linked account (must be linked).'}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <Send className="h-4 w-4 me-1" />}
            {isRTL ? 'إرسال' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
