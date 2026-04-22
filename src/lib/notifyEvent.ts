import { supabase } from '@/integrations/supabase/client';
import { sendEmail, getUserEmail } from '@/lib/emailService';

export type NotificationAudience =
  | 'student'
  | 'parent'
  | 'instructor'
  | 'admin'
  | 'reception'
  | 'staff';

interface NotifyEventParams {
  /** event_key from email_event_catalog */
  eventKey: string;
  /** Target audience for resolving the right mapping/template */
  audience: NotificationAudience;
  /** Recipient's user_id (used for Telegram link resolution + email lookup) */
  userId: string;
  /** Variables to interpolate into template ({{key}} placeholders) */
  templateData?: Record<string, unknown>;
  /** Unique key for idempotent delivery */
  idempotencyKey: string;
}

/**
 * Single entry point for transactional events. The backend (`send-email`
 * and `send-telegram`) read `email_event_mappings.admin_channel_override`
 * to decide which channels to actually deliver on. Callers should NOT
 * decide channels — admin has the final say.
 *
 * Behavior:
 *  - Always invokes both edge functions; each will skip itself if the
 *    admin override says it's not its turn (`email`-only / `telegram`-only).
 *  - When audience is 'staff', resolves to the first active staff role
 *    (admin or reception) for that user.
 *  - Errors are swallowed and logged — never throws.
 */
export async function notifyEvent(params: NotifyEventParams): Promise<void> {
  const { eventKey, audience, userId, templateData, idempotencyKey } = params;

  try {
    const email = await getUserEmail(userId);

    // Fire both in parallel; each function self-skips per admin_channel_override
    await Promise.allSettled([
      email
        ? sendEmail({
            to: email,
            templateName: eventKey,
            templateData: templateData as Record<string, unknown> | undefined,
            idempotencyKey,
            // The dispatcher controls fan-out — disable the implicit one in send-email
            // (extension fields ignored by older clients)
            ...({ audience, skipTelegramFanout: true } as Record<string, unknown>),
          } as Parameters<typeof sendEmail>[0])
        : Promise.resolve({ success: false, skipped: 'no_email' as const }),
      supabase.functions.invoke('send-telegram', {
        body: {
          userId,
          templateName: eventKey,
          templateData: templateData ?? {},
          audience,
          idempotencyKey: `${idempotencyKey}-tg`,
        },
      }),
    ]);
  } catch (err) {
    console.error('[notifyEvent] dispatch error:', err);
  }
}
