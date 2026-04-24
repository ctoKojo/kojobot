// Telegram bot long-poll worker (uses TELEGRAM_BOT_TOKEN directly, bypasses Connector Gateway)
// - Drains getUpdates with Telegram long polling
// - Handles /start <CODE> for account linking
// - Handles /unlink to disconnect
// - Stores all messages in telegram_inbox for audit
// Designed to be invoked every minute by pg_cron (runs ~55s per invocation).

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_RUNTIME_MS = 55_000
const MIN_REMAINING_MS = 5_000

function tgUrl(botToken: string, method: string) {
  return `https://api.telegram.org/bot${botToken}/${method}`
}

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  try {
    await fetch(tgUrl(botToken, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
  } catch (e) {
    console.error('[telegram-bot-poll] reply failed:', e)
  }
}

async function handleCommand(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  botToken: string,
  update: any,
): Promise<void> {
  const message = update.message
  if (!message?.text) return

  const chatId = Number(message.chat.id)
  const text: string = message.text.trim()
  const username: string | undefined = message.from?.username
  const firstName: string | undefined = message.from?.first_name

  // /start <CODE>
  const startMatch = text.match(/^\/start(?:@\w+)?\s+([A-Za-z0-9]{4,12})\s*$/)
  if (startMatch) {
    const code = startMatch[1].toUpperCase()
    const { data: codeRow } = await supabase
      .from('telegram_link_codes')
      .select('id, user_id, expires_at, used_at')
      .eq('code', code)
      .maybeSingle()

    if (!codeRow) {
      await sendTelegramMessage(botToken, chatId,
        '❌ <b>كود غير صحيح</b>\n\nمن فضلك ارجع للموقع واطلب كود جديد.')
      return
    }
    if (codeRow.used_at) {
      await sendTelegramMessage(botToken, chatId,
        '⚠️ <b>هذا الكود مستخدم بالفعل</b>\n\nاطلب كود جديد من حسابك.')
      return
    }
    if (new Date(codeRow.expires_at).getTime() < Date.now()) {
      await sendTelegramMessage(botToken, chatId,
        '⏰ <b>انتهت صلاحية الكود</b>\n\nاطلب كود جديد (صالح لمدة 15 دقيقة).')
      return
    }

    // Upsert link
    const { error: upsertErr } = await supabase
      .from('telegram_links')
      .upsert({
        user_id: codeRow.user_id,
        chat_id: chatId,
        telegram_username: username ?? null,
        telegram_first_name: firstName ?? null,
        is_active: true,
        linked_at: new Date().toISOString(),
        unlinked_at: null,
      }, { onConflict: 'user_id' })

    if (upsertErr) {
      console.error('[telegram-bot-poll] link upsert failed:', upsertErr)
      await sendTelegramMessage(botToken, chatId,
        '❌ <b>فشل الربط</b>\n\nهذا الحساب مرتبط بمستخدم آخر. تواصل مع الدعم.')
      return
    }

    await supabase
      .from('telegram_link_codes')
      .update({ used_at: new Date().toISOString(), used_chat_id: chatId })
      .eq('id', codeRow.id)

    await sendTelegramMessage(botToken, chatId,
      '✅ <b>تم الربط بنجاح!</b>\n\nهتوصلك من دلوقتي إشعارات Kojobot Academy على تيليجرام 🎓\n\nلإيقاف الربط ابعت /unlink')
    return
  }

  // /start without code
  if (/^\/start(@\w+)?\s*$/.test(text)) {
    await sendTelegramMessage(botToken, chatId,
      '👋 <b>أهلاً بك في Kojobot Academy</b>\n\nلربط حسابك:\n1. سجل دخول على الموقع\n2. روح للإعدادات → Telegram\n3. اطلب كود الربط\n4. ابعت هنا: <code>/start ABC123</code>')
    return
  }

  // /unlink
  if (/^\/unlink(@\w+)?\s*$/.test(text)) {
    const { data: link } = await supabase
      .from('telegram_links')
      .select('user_id')
      .eq('chat_id', chatId)
      .eq('is_active', true)
      .maybeSingle()

    if (!link) {
      await sendTelegramMessage(botToken, chatId,
        'ℹ️ مفيش حساب مربوط بالشات ده.')
      return
    }
    await supabase.from('telegram_links')
      .update({ is_active: false, unlinked_at: new Date().toISOString() })
      .eq('chat_id', chatId)
    await sendTelegramMessage(botToken, chatId,
      '✅ <b>تم فك الربط</b>\n\nمش هتوصلك إشعارات تانية. لإعادة الربط، ارجع للموقع.')
    return
  }

  // /help or anything else
  if (/^\/help/.test(text)) {
    await sendTelegramMessage(botToken, chatId,
      '<b>الأوامر المتاحة:</b>\n\n/start CODE - ربط الحساب\n/unlink - فك الربط\n/help - عرض المساعدة')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  if (!botToken) {
    return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN is not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Read offset
  const { data: state, error: stateErr } = await supabase
    .from('telegram_bot_state').select('update_offset').eq('id', 1).single()

  if (stateErr) {
    return new Response(JSON.stringify({ error: stateErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let currentOffset = Number(state.update_offset)
  let totalProcessed = 0

  while (true) {
    const remainingMs = MAX_RUNTIME_MS - (Date.now() - startTime)
    if (remainingMs < MIN_REMAINING_MS) break
    const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5)
    if (timeout < 1) break

    const resp = await fetch(tgUrl(botToken, 'getUpdates'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offset: currentOffset, timeout, allowed_updates: ['message'] }),
    })

    const data = await resp.json()
    if (!resp.ok) {
      console.error('[telegram-bot-poll] getUpdates error:', data)
      break
    }

    const updates = (data.result ?? []) as any[]
    if (updates.length === 0) continue

    // Store all in inbox (idempotent on update_id PK)
    const inboxRows = updates.filter((u) => u.message).map((u) => ({
      update_id: u.update_id,
      chat_id: u.message.chat.id,
      text: u.message.text ?? null,
      raw_update: u,
    }))

    if (inboxRows.length > 0) {
      await supabase.from('telegram_inbox').upsert(inboxRows, { onConflict: 'update_id' })
    }

    // Process commands
    for (const update of updates) {
      try {
        await handleCommand(supabase, botToken, update)
        await supabase.from('telegram_inbox')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('update_id', update.update_id)
      } catch (e) {
        console.error('[telegram-bot-poll] handleCommand failed:', e)
      }
    }

    totalProcessed += updates.length
    const newOffset = Math.max(...updates.map((u: any) => Number(u.update_id))) + 1
    await supabase.from('telegram_bot_state')
      .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
      .eq('id', 1)
    currentOffset = newOffset
  }

  return new Response(JSON.stringify({
    success: true,
    processed: totalProcessed,
    finalOffset: currentOffset,
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
