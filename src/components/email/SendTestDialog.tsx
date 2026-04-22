import { useEffect, useState } from 'react';
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

interface LinkedEvent {
  event_key: string;
  available_variables: Array<{ key: string; label_en?: string; label_ar?: string; sample?: string | number }>;
  preview_data: Record<string, string | number>;
}

/**
 * Build sample data for ALL variables of the linked event so the test send
 * actually fills the template instead of leaving every {{var}} empty.
 * Priority: preview_data > variable.sample > "[label]" placeholder.
 */
function buildSampleData(
  events: LinkedEvent[],
  isRTL: boolean,
  user: { email?: string | null } | null,
): Record<string, string | number> {
  const data: Record<string, string | number> = {
    recipientName: 'Test Recipient',
    studentName: 'Test Student',
    recipientEmail: user?.email ?? 'test@example.com',
  };

  for (const ev of events) {
    (ev.available_variables || []).forEach((v) => {
      if (data[v.key] !== undefined) return;
      if (v.sample !== undefined && v.sample !== null && v.sample !== '') {
        data[v.key] = v.sample;
      } else {
        data[v.key] = isRTL ? `[${v.label_ar || v.key}]` : `[${v.label_en || v.key}]`;
      }
    });
    if (ev.preview_data && typeof ev.preview_data === 'object') {
      Object.entries(ev.preview_data).forEach(([k, val]) => {
        if (val !== null && val !== undefined && val !== '') {
          data[k] = val as string | number;
        }
      });
    }
  }

  return data;
}

export function SendTestDialog({ open, onOpenChange, template }: Props) {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [email, setEmail] = useState(user?.email ?? '');
  const [channel, setChannel] = useState<'email' | 'telegram' | 'both'>('email');
  const [sending, setSending] = useState(false);
  const [linkedEvents, setLinkedEvents] = useState<LinkedEvent[]>([]);

  // Load mappings + linked event catalog so we can build realistic test data
  // and so Telegram can resolve the template via event_key (it doesn't accept
  // raw template names).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data: mappings } = await supabase
        .from('email_event_mappings')
        .select('event_key')
        .eq('template_id', template.id);

      const eventKeys = (mappings || []).map((m) => m.event_key);
      if (eventKeys.length === 0) {
        if (!cancelled) setLinkedEvents([]);
        return;
      }

      const { data: events } = await supabase
        .from('email_event_catalog')
        .select('event_key, available_variables, preview_data')
        .in('event_key', eventKeys);

      if (!cancelled) {
        setLinkedEvents(
          (events || []).map((e) => ({
            event_key: e.event_key,
            available_variables: (e.available_variables as any) || [],
            preview_data: (e.preview_data as any) || {},
          })),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, template.id]);

  const handleSend = async () => {
    if (channel !== 'telegram' && !email.trim()) {
      toast({ title: isRTL ? 'إدخال الإيميل مطلوب' : 'Email required', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const errors: string[] = [];

      const testIdempotencyKey = `test-${template.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const testData = buildSampleData(linkedEvents, isRTL, user);
      const primaryEventKey = linkedEvents[0]?.event_key;

      if (channel === 'email' || channel === 'both') {
        const { error } = await supabase.functions.invoke('send-email', {
          body: {
            to: email,
            templateName: template.name,
            templateData: testData,
            idempotencyKey: testIdempotencyKey,
            audience: template.audience,
            skipTelegramFanout: true,
            isTest: true,
          },
        });
        if (error) errors.push(`Email: ${error.message}`);
      }

      if (channel === 'telegram' || channel === 'both') {
        if (!user?.id) {
          errors.push('Telegram requires a logged-in user');
        } else if (!primaryEventKey) {
          errors.push(
            isRTL
              ? 'تيليجرام: القالب مش مربوط بأي حدث — اربطه أولاً من تبويب "الأحداث المرتبطة"'
              : 'Telegram: template is not linked to any event — link it first from the "Linked events" tab',
          );
        } else {
          const { error } = await supabase.functions.invoke('send-telegram', {
            body: {
              userId: user.id,
              templateName: primaryEventKey,
              templateData: testData,
              idempotencyKey: `${testIdempotencyKey}-tg`,
              audience: template.audience,
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

  const noLinkedEvent = linkedEvents.length === 0;

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

          {noLinkedEvent && (
            <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded p-2">
              {isRTL
                ? 'تحذير: القالب مش مربوط بأي حدث، فالبيانات التجريبية هتكون أساسية فقط، والتيليجرام مش هيشتغل.'
                : 'Warning: this template is not linked to any event, so test data will be minimal and Telegram will not work.'}
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
