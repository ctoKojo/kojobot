import { supabase } from '@/integrations/supabase/client';

type EmailTemplate = string;

interface SendEmailParams {
  to: string;
  templateName: EmailTemplate;
  templateData?: Record<string, any>;
  /**
   * A unique key for this logical send event.
   * Same key = no duplicate send. Format: `<type>-<entity-id>-<context>`
   * Example: `payment-due-${subscriptionId}-${dueDate}`
   */
  idempotencyKey: string;
  /** Optional override for the email subject. {{variables}} are interpolated. */
  customSubject?: string;
  /** Optional override for the email body HTML. {{variables}} are interpolated. */
  customBody?: string;
}

interface SendEmailResult {
  success: boolean;
  skipped?: string;
  id?: string;
  error?: string;
}

/**
 * Send a transactional email via the send-email Edge Function (Resend).
 * Errors are caught and logged — never throw to the caller, since email
 * failures should not break the primary user flow (notification, payment, etc.)
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: params,
    });

    if (error) {
      console.error('[sendEmail] Edge function error:', error);
      return { success: false, error: error.message };
    }

    return data as SendEmailResult;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[sendEmail] Exception:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Get a user's email from their profile, with fallback to auth user.
 * Returns null if no email available.
 */
export async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', userId)
      .maybeSingle();

    if (profile?.email) return profile.email;
    return null;
  } catch {
    return null;
  }
}
