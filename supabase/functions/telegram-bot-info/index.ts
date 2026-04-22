// Returns the Telegram bot username for building deep-link URLs (t.me/<bot>?start=<code>)
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Require auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace('Bearer ', '')
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    )
    const { data: claims } = await supabaseAuth.auth.getClaims(token)
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
    const telegramApiKey = Deno.env.get('TELEGRAM_API_KEY')
    if (!lovableApiKey || !telegramApiKey) {
      return new Response(JSON.stringify({ error: 'Telegram not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const resp = await fetch(`${GATEWAY_URL}/getMe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'X-Connection-Api-Key': telegramApiKey,
        'Content-Type': 'application/json',
      },
    })
    const data = await resp.json()
    if (!resp.ok || !data.ok) {
      return new Response(JSON.stringify({ error: data?.description || 'getMe failed' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      success: true,
      username: data.result.username,
      first_name: data.result.first_name,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
