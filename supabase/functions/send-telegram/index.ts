// Send Telegram messages via Lovable Connector Gateway
// Mirrors send-email's contract: templateName + templateData + idempotencyKey
// Auto-resolves chat_id from user_id (preferred) or accepts explicit chatId.
// Honors notification_channel_preferences (telegram_enabled).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3.23.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function tgUrl(botToken: string, method: string) {
  return `https://api.telegram.org/bot${botToken}/${method}`
}

const RequestSchema = z.object({
  // Either userId (preferred — auto-resolves chat_id + checks prefs) OR chatId directly
  userId: z.string().uuid().optional(),
  chatId: z.number().int().optional(),
  templateName: z.string().min(1).max(100),
  templateData: z.record(z.any()).optional(),
  // Optional override for free-form messages (announcements)
  customMessage: z.string().min(1).max(4000).optional(),
  idempotencyKey: z.string().min(1).max(255).optional(),
  // Skip channel preference check (e.g. for the linking confirmation itself)
  bypassPreferences: z.boolean().optional(),
}).refine((d) => d.userId || d.chatId, { message: 'userId or chatId is required' })

// Simple {{variable}} interpolation
function renderTemplate(tpl: string, data: Record<string, any>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const v = data[key]
    return v === undefined || v === null ? '' : String(v)
  })
}

// Convert a few common HTML tags from email templates to Telegram-safe HTML
// Telegram supports: b, i, u, s, code, pre, a, blockquote (limited subset)
function htmlToTelegramHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<h[1-6][^>]*>/gi, '<b>')
    .replace(/<\/h[1-6]>/gi, '</b>\n')
    .replace(/<strong[^>]*>/gi, '<b>')
    .replace(/<\/strong>/gi, '</b>')
    .replace(/<em[^>]*>/gi, '<i>')
    .replace(/<\/em>/gi, '</i>')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/div>/gi, '\n')
    // strip everything else
    .replace(/<(?!\/?(b|i|u|s|code|pre|a|blockquote)\b)[^>]+>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 4000)
}

// Build a Telegram message body for a given template/event
async function buildMessage(
  supabase: ReturnType<typeof createClient>,
  templateName: string,
  data: Record<string, any>,
  customMessage?: string,
): Promise<string | null> {
  // 1. Free-form override (announcements, custom sends)
  if (customMessage) {
    return htmlToTelegramHtml(renderTemplate(customMessage, data))
  }

  // 2. Reuse the email template body when available
  const { data: mapping } = await supabase
    .from('email_event_mappings')
    .select('use_db_template, template_id')
    .eq('event_key', templateName)
    .maybeSingle()

  if (mapping?.template_id) {
    const { data: tpl } = await supabase
      .from('email_templates')
      .select('subject_ar, body_html_ar, is_active')
      .eq('id', mapping.template_id)
      .maybeSingle()
    if (tpl?.is_active) {
      const subject = renderTemplate(tpl.subject_ar, data)
      const body = htmlToTelegramHtml(renderTemplate(tpl.body_html_ar, data))
      return `<b>${subject}</b>\n\n${body}`
    }
  }

  // 3. Minimal generic fallback
  const fallback = renderTemplate(
    '<b>{{title}}</b>\n\n{{message}}',
    { title: data.title || templateName, message: data.message || '' },
  )
  return fallback.includes('{{') ? null : fallback
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')

    if (!botToken) {
      return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN is not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { userId, chatId, templateName, templateData = {}, customMessage, bypassPreferences } = parsed.data
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Resolve chat_id and check preferences
    let resolvedChatId = chatId
    let resolvedUserId = userId ?? null

    if (userId) {
      // Check channel preference unless bypassed
      if (!bypassPreferences) {
        const { data: prefs } = await supabase.rpc('get_user_notification_channels', {
          p_user_id: userId,
          p_event_key: templateName,
        })
        const enabled = Array.isArray(prefs) ? prefs[0]?.telegram_enabled : (prefs as any)?.telegram_enabled
        if (enabled === false) {
          return new Response(JSON.stringify({ skipped: true, reason: 'telegram_disabled_by_user' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      // Resolve chat_id from telegram_links
      const { data: link } = await supabase
        .from('telegram_links')
        .select('chat_id, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle()

      if (!link) {
        return new Response(JSON.stringify({ skipped: true, reason: 'no_telegram_link' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      resolvedChatId = Number(link.chat_id)
    }

    if (!resolvedChatId) {
      return new Response(JSON.stringify({ error: 'Could not resolve chat_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build message
    const messageText = await buildMessage(supabase, templateName, templateData, customMessage)
    if (!messageText) {
      return new Response(JSON.stringify({ error: 'No template found and no custom message' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Send directly to Telegram Bot API
    const tgResponse = await fetch(tgUrl(botToken, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: resolvedChatId,
        text: messageText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })

    const tgData = await tgResponse.json()

    if (!tgResponse.ok || !tgData.ok) {
      const errMsg = tgData?.description || `Telegram API error [${tgResponse.status}]`
      // Log failure
      await supabase.from('telegram_send_log').insert({
        user_id: resolvedUserId,
        chat_id: resolvedChatId,
        template_name: templateName,
        status: 'failed',
        error_message: errMsg,
        metadata: { tgResponse: tgData },
      })

      // If user blocked the bot or chat not found, deactivate the link
      if (tgData?.error_code === 403 || /chat not found|bot was blocked/i.test(errMsg)) {
        if (resolvedUserId) {
          await supabase.from('telegram_links')
            .update({ is_active: false, unlinked_at: new Date().toISOString() })
            .eq('user_id', resolvedUserId)
        }
      }

      return new Response(JSON.stringify({ success: false, error: errMsg }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Log success
    await supabase.from('telegram_send_log').insert({
      user_id: resolvedUserId,
      chat_id: resolvedChatId,
      template_name: templateName,
      status: 'sent',
      message_id: tgData.result?.message_id ?? null,
    })

    return new Response(JSON.stringify({
      success: true,
      messageId: tgData.result?.message_id,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[send-telegram] Error:', error)
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
