import { supabase } from '@/integrations/supabase/client';
import { notifyEvent } from '@/lib/notifyEvent';

/**
 * Sends a notification event to ALL active admin users.
 * Used for operational/financial/academic alerts that the admin team should track.
 *
 * - Resolves all users with the `admin` role
 * - Fans out a `notifyEvent` call per admin (each gets their own Telegram + email)
 * - Idempotency key is suffixed with the admin user_id to prevent duplicate suppression
 *   when multiple admins exist
 * - Errors are swallowed; never throws (background-safe)
 */
export async function notifyAdmins(params: {
  eventKey: string;
  templateData?: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<void> {
  try {
    const { data: admins, error } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (error || !admins || admins.length === 0) {
      console.warn('[notifyAdmins] No admins found or query failed', error);
      return;
    }

    await Promise.allSettled(
      admins.map((a) =>
        notifyEvent({
          eventKey: params.eventKey,
          audience: 'admin',
          userId: a.user_id,
          templateData: params.templateData,
          idempotencyKey: `${params.idempotencyKey}-${a.user_id}`,
        }),
      ),
    );
  } catch (err) {
    console.error('[notifyAdmins] dispatch error:', err);
  }
}
