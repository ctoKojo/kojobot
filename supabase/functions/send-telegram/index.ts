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

const AUDIENCES = ['student','parent','instructor','admin','reception','staff'] as const

const RequestSchema = z.object({
  userId: z.string().uuid().optional(),
  chatId: z.number().int().optional(),
  templateName: z.string().min(1).max(100),
  templateData: z.record(z.any()).optional(),
  audience: z.enum(AUDIENCES).optional(),
  customMessage: z.string().min(1).max(4000).optional(),
  idempotencyKey: z.string().min(1).max(255).optional(),
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
  audience: string,
  data: Record<string, any>,
  customMessage?: string,
): Promise<{ text: string; mapping: any | null } | null> {
  if (customMessage) {
    return { text: htmlToTelegramHtml(renderTemplate(customMessage, data)), mapping: null }
  }

  let { data: mapping } = await supabase
    .from('email_event_mappings')
    .select('use_db_template, template_id, admin_channel_override, is_enabled, audience')
    .eq('event_key', templateName)
    .eq('audience', audience)
    .maybeSingle()

  if (!mapping) {
    const { data: fallback } = await supabase
      .from('email_event_mappings')
      .select('use_db_template, template_id, admin_channel_override, is_enabled, audience')
      .eq('event_key', templateName)
      .order('audience', { ascending: true })
      .limit(1)
      .maybeSingle()
    mapping = fallback
  }

  if (mapping?.is_enabled === false) return null

  // Resolve template_id either from mapping OR via convention `default-{eventKey}`
  let templateId: string | null = mapping?.template_id ?? null

  if (!templateId && !templateName.startsWith('default-')) {
    const { data: conventionTpl } = await supabase
      .from('email_templates')
      .select('id')
      .eq('name', `default-${templateName}`)
      .eq('is_active', true)
      .maybeSingle()
    if (conventionTpl?.id) {
      templateId = conventionTpl.id as string
      console.log(`[send-telegram] Using convention fallback: default-${templateName}`)
    }
  }

  // Also support direct lookup by exact templateName (test sends from UI)
  if (!templateId) {
    const { data: directTpl } = await supabase
      .from('email_templates')
      .select('id')
      .eq('name', templateName)
      .eq('is_active', true)
      .maybeSingle()
    if (directTpl?.id) templateId = directTpl.id as string
  }

  if (templateId) {
    const { data: tpl } = await supabase
      .from('email_templates')
      .select('subject_ar, body_html_ar, subject_telegram_ar, body_telegram_md_ar, is_active')
      .eq('id', templateId)
      .maybeSingle()

    if (tpl?.is_active) {
      const subject = renderTemplate(tpl.subject_telegram_ar || tpl.subject_ar, data)
      const bodyRaw = tpl.body_telegram_md_ar
        ? renderTemplate(tpl.body_telegram_md_ar, data)
        : htmlToTelegramHtml(renderTemplate(tpl.body_html_ar, data))
      return { text: `<b>${subject}</b>\n\n${bodyRaw}`.slice(0, 4000), mapping }
    }
  }

  const fallback = renderTemplate(
    '<b>{{title}}</b>\n\n{{message}}',
    { title: data.title || templateName, message: data.message || '' },
  )
  return fallback.includes('{{') ? null : { text: fallback, mapping }
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

    const { userId, chatId, templateName, templateData = {}, customMessage, bypassPreferences, audience: audienceArg } = parsed.data
    const audience = audienceArg ?? 'student'
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Build message first to know mapping + admin_channel_override
    const built = await buildMessage(supabase, templateName, audience, templateData, customMessage)
    if (!built) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no_template_or_disabled' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    // Allowed admin_channel_override values: user_choice | email_only | telegram_only | both | none
    const adminChannel: string = built.mapping?.admin_channel_override ?? 'user_choice'

    if (adminChannel === 'none' || adminChannel === 'email_only') {
      return new Response(JSON.stringify({ skipped: true, reason: `admin_channel_${adminChannel}` }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let resolvedChatId = chatId
    let resolvedUserId = userId ?? null

    if (userId) {
      // Respect user prefs only when admin says user_choice. 'telegram_only'/'both' force-send.
      if (!bypassPreferences && adminChannel === 'user_choice') {
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

    const messageText = built.text

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
