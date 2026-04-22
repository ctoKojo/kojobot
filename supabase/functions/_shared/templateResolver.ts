// Unified template resolution + rendering used by send-email, send-telegram,
// and notifications-e2e-test. Single source of truth for the 4-step lookup:
//   1. event_event_mappings (event_key + audience, with audience fallback)
//   2. mapping.template_id when use_db_template=true
//   3. direct lookup in email_templates by exact name (test sends from UI)
//   4. convention fallback: `default-{eventKey}` in email_templates
//   5. (caller-specific) built-in code fallback
//
// This file performs ZERO side effects (no logs, no sends, no external calls
// beyond Supabase queries). Safe to call in-process from the E2E tester.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export type ResolvedSource = 'mapping' | 'direct' | 'convention' | 'none'

export interface MappingRow {
  use_db_template: boolean
  is_enabled: boolean
  template_id: string | null
  admin_channel_override: string
  audience: string
}

export interface TemplateRow {
  id?: string
  subject_en?: string | null
  subject_ar?: string | null
  body_html_en?: string | null
  body_html_ar?: string | null
  subject_telegram_en?: string | null
  subject_telegram_ar?: string | null
  body_telegram_md_en?: string | null
  body_telegram_md_ar?: string | null
  is_active: boolean
}

export interface ResolveResult {
  template: TemplateRow | null
  mapping: MappingRow | null
  source: ResolvedSource
  /** True when the mapping exists and has is_enabled=false. Caller should skip send. */
  disabled: boolean
}

const VAR_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

/** Replace `{{var}}` placeholders. Missing keys render as empty string (matches existing behavior). */
export function renderTemplate(tpl: string | null | undefined, data: Record<string, unknown>): string {
  if (!tpl) return ''
  return tpl.replace(VAR_REGEX, (_m, key) => {
    const v = (data as Record<string, unknown>)[key]
    return v === undefined || v === null ? '' : String(v)
  })
}

/** Return list of `{{var}}` keys still present after rendering — used by E2E to flag missing vars. */
export function extractMissingVariables(rendered: string): string[] {
  const out = new Set<string>()
  let m: RegExpExecArray | null
  const re = new RegExp(VAR_REGEX)
  while ((m = re.exec(rendered)) !== null) out.add(m[1])
  return Array.from(out)
}

/** Lookup mapping with audience fallback (matches send-email + send-telegram behavior). */
async function lookupMapping(
  supabase: SupabaseClient,
  eventKey: string,
  audience: string,
): Promise<MappingRow | null> {
  const { data: exact } = await supabase
    .from('email_event_mappings')
    .select('use_db_template, is_enabled, template_id, admin_channel_override, audience')
    .eq('event_key', eventKey)
    .eq('audience', audience)
    .maybeSingle()

  if (exact) return exact as MappingRow

  const { data: fallback } = await supabase
    .from('email_event_mappings')
    .select('use_db_template, is_enabled, template_id, admin_channel_override, audience')
    .eq('event_key', eventKey)
    .order('audience', { ascending: true })
    .limit(1)
    .maybeSingle()

  return (fallback as MappingRow | null) ?? null
}

/**
 * Resolve a template for a given event/audience using the unified 4-step lookup.
 * Returns the raw template row + mapping. Caller decides which fields to render
 * (email vs telegram, EN vs AR, etc).
 *
 * Pass `selectFields` to limit the columns fetched per template (e.g. telegram-only
 * callers don't need the full email body).
 */
export async function resolveTemplate(
  supabase: SupabaseClient,
  eventKey: string,
  audience: string,
  selectFields = 'id, subject_en, subject_ar, body_html_en, body_html_ar, subject_telegram_en, subject_telegram_ar, body_telegram_md_en, body_telegram_md_ar, is_active',
): Promise<ResolveResult> {
  const mapping = await lookupMapping(supabase, eventKey, audience)

  if (mapping?.is_enabled === false) {
    return { template: null, mapping, source: 'none', disabled: true }
  }

  // 2. DB override path
  if (mapping?.use_db_template && mapping.template_id) {
    const { data: tplRaw } = await supabase
      .from('email_templates')
      .select(selectFields)
      .eq('id', mapping.template_id)
      .maybeSingle()
    const tpl = tplRaw as unknown as TemplateRow | null
    if (tpl && tpl.is_active) {
      return { template: tpl, mapping, source: 'mapping', disabled: false }
    }
  }

  // 3. Direct name lookup (used by "Send Test" from the templates UI)
  const { data: directRaw } = await supabase
    .from('email_templates')
    .select(selectFields)
    .eq('name', eventKey)
    .eq('is_active', true)
    .maybeSingle()
  const directTpl = directRaw as unknown as TemplateRow | null
  if (directTpl) {
    return { template: directTpl, mapping, source: 'direct', disabled: false }
  }

  // 4. Convention fallback: default-{eventKey}
  if (!eventKey.startsWith('default-')) {
    const { data: convRaw } = await supabase
      .from('email_templates')
      .select(selectFields)
      .eq('name', `default-${eventKey}`)
      .eq('is_active', true)
      .maybeSingle()
    const conventionTpl = convRaw as unknown as TemplateRow | null
    if (conventionTpl) {
      return { template: conventionTpl, mapping, source: 'convention', disabled: false }
    }
  }

  return { template: null, mapping, source: 'none', disabled: false }
}

/** Pick subject preferring EN, falling back to AR. Matches existing send-email behavior. */
export function pickSubjectEnFirst(tpl: TemplateRow | null | undefined): string {
  if (!tpl) return ''
  return tpl.subject_en && tpl.subject_en.trim() ? tpl.subject_en : (tpl.subject_ar ?? '')
}

/** Pick HTML body preferring EN, falling back to AR. Matches existing send-email behavior. */
export function pickHtmlEnFirst(tpl: TemplateRow | null | undefined): string {
  if (!tpl) return ''
  return tpl.body_html_en && tpl.body_html_en.trim() ? tpl.body_html_en : (tpl.body_html_ar ?? '')
}
