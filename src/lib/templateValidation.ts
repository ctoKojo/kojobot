/**
 * Email template validation utilities.
 * - Extracts {{variable}} placeholders from any template field
 * - Validates against the available_variables schema from email_event_catalog
 * - Returns errors (missing required vars) and warnings (unknown vars)
 */

export interface EventVariable {
  key: string;
  label_en: string;
  label_ar: string;
  required?: boolean;
  type?: 'string' | 'number' | 'date' | 'url';
  sample?: string;
}

export interface CatalogEvent {
  event_key: string;
  display_name_en: string;
  display_name_ar: string;
  available_variables: EventVariable[];
  preview_data?: Record<string, string | number>;
  supported_audiences?: string[];
}

export interface TemplateContent {
  subject_en: string;
  subject_ar: string;
  body_html_en: string;
  body_html_ar: string;
  subject_telegram_en?: string | null;
  subject_telegram_ar?: string | null;
  body_telegram_md_en?: string | null;
  body_telegram_md_ar?: string | null;
}

export interface ValidationIssue {
  level: 'error' | 'warning';
  field:
    | 'subject_en' | 'subject_ar' | 'body_html_en' | 'body_html_ar'
    | 'subject_telegram_en' | 'subject_telegram_ar'
    | 'body_telegram_md_en' | 'body_telegram_md_ar';
  variable?: string;
  message_en: string;
  message_ar: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  usedVariables: string[];
  unknownVariables: string[];
  emailReady: boolean;     // email channel has content + no errors
  telegramReady: boolean;  // telegram channel has content + no errors
}

const VAR_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function extractVariables(text: string | null | undefined): string[] {
  if (!text) return [];
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(VAR_REGEX);
  while ((m = re.exec(text)) !== null) out.add(m[1]);
  return Array.from(out);
}

export function renderTemplate(
  text: string | null | undefined,
  data: Record<string, string | number>,
): string {
  if (!text) return '';
  return text.replace(VAR_REGEX, (_m, key) => {
    if (key in data) return String(data[key]);
    return `{{${key}}}`;
  });
}

/**
 * Render with explicit "missing" markers — used for the live preview so editors can
 * spot vars that won't be filled at send time.
 */
export function renderTemplateWithMissingMarkers(
  text: string | null | undefined,
  data: Record<string, string | number>,
): string {
  if (!text) return '';
  return text.replace(VAR_REGEX, (_m, key) => {
    if (key in data) return String(data[key]);
    return `<span style="color:#dc2626;background:#fef2f2;padding:0 4px;border-radius:3px;font-family:monospace;font-size:0.85em;">[missing: ${key}]</span>`;
  });
}

/**
 * Validate template content against a list of candidate events. We accept the union
 * of variables from all events the template could be triggered by — a variable is
 * "known" if it exists in ANY of those events.
 */
export function validateTemplate(
  content: TemplateContent,
  events: CatalogEvent[],
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const knownVars = new Set<string>();
  events.forEach((e) => {
    (e.available_variables || []).forEach((v) => knownVars.add(v.key));
  });

  const fields: { key: ValidationIssue['field']; value: string | null | undefined }[] = [
    { key: 'subject_en', value: content.subject_en },
    { key: 'subject_ar', value: content.subject_ar },
    { key: 'body_html_en', value: content.body_html_en },
    { key: 'body_html_ar', value: content.body_html_ar },
    { key: 'subject_telegram_en', value: content.subject_telegram_en },
    { key: 'subject_telegram_ar', value: content.subject_telegram_ar },
    { key: 'body_telegram_md_en', value: content.body_telegram_md_en },
    { key: 'body_telegram_md_ar', value: content.body_telegram_md_ar },
  ];

  const allUsed = new Set<string>();
  const unknownVars = new Set<string>();

  fields.forEach(({ key, value }) => {
    const used = extractVariables(value);
    used.forEach((v) => {
      allUsed.add(v);
      if (events.length > 0 && !knownVars.has(v)) {
        unknownVars.add(v);
        warnings.push({
          level: 'warning',
          field: key,
          variable: v,
          message_en: `Unknown variable {{${v}}} — not in any linked event`,
          message_ar: `متغير غير معروف {{${v}}} — مش موجود في أي حدث مربوط`,
        });
      }
    });
  });

  // required-field checks
  if (!content.subject_en?.trim()) {
    errors.push({
      level: 'error',
      field: 'subject_en',
      message_en: 'English subject is required',
      message_ar: 'موضوع الإيميل بالإنجليزي مطلوب',
    });
  }
  if (!content.subject_ar?.trim()) {
    errors.push({
      level: 'error',
      field: 'subject_ar',
      message_en: 'Arabic subject is required',
      message_ar: 'موضوع الإيميل بالعربي مطلوب',
    });
  }
  if (!content.body_html_en?.trim()) {
    errors.push({
      level: 'error',
      field: 'body_html_en',
      message_en: 'English body is required',
      message_ar: 'محتوى الإيميل بالإنجليزي مطلوب',
    });
  }
  if (!content.body_html_ar?.trim()) {
    errors.push({
      level: 'error',
      field: 'body_html_ar',
      message_en: 'Arabic body is required',
      message_ar: 'محتوى الإيميل بالعربي مطلوب',
    });
  }

  const emailHasContent = !!(content.body_html_en?.trim() && content.body_html_ar?.trim());
  const telegramHasContent = !!(content.body_telegram_md_en?.trim() || content.body_telegram_md_ar?.trim());

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    usedVariables: Array.from(allUsed),
    unknownVariables: Array.from(unknownVars),
    emailReady: emailHasContent && errors.filter(e => e.field.includes('html') || e.field.includes('subject_e') || e.field.includes('subject_a')).length === 0,
    telegramReady: telegramHasContent && warnings.filter(w => w.field.startsWith('body_telegram')).length === 0,
  };
}

/**
 * Compute a 3-state channel status for display in the templates list.
 * - 'working': content present, no errors, last test (if any) succeeded
 * - 'incomplete': content present but missing data or no test yet
 * - 'error': last validation/test failed
 * - 'empty': no content for this channel
 */
export type ChannelStatus = 'working' | 'incomplete' | 'error' | 'empty';

export function computeChannelStatus(
  hasContent: boolean,
  validation: ValidationResult | null,
  channel: 'email' | 'telegram',
  lastTestStatus: string | null,
): ChannelStatus {
  if (!hasContent) return 'empty';
  if (!validation) return 'incomplete';

  const channelErrors = validation.errors.filter((e) =>
    channel === 'email'
      ? !e.field.startsWith('body_telegram') && !e.field.startsWith('subject_telegram')
      : e.field.startsWith('body_telegram') || e.field.startsWith('subject_telegram'),
  );
  const channelWarnings = validation.warnings.filter((w) =>
    channel === 'email'
      ? !w.field.startsWith('body_telegram') && !w.field.startsWith('subject_telegram')
      : w.field.startsWith('body_telegram') || w.field.startsWith('subject_telegram'),
  );

  if (channelErrors.length > 0) return 'error';
  if (lastTestStatus === 'failed') return 'error';
  if (channelWarnings.length > 0) return 'incomplete';
  if (lastTestStatus === 'success') return 'working';
  return 'incomplete'; // has content + no errors but never tested
}

/**
 * Build deterministic preview data from event's preview_data + variable defaults.
 */
export function buildPreviewData(
  event: CatalogEvent | null | undefined,
  isRTL: boolean,
): Record<string, string | number> {
  const data: Record<string, string | number> = {};
  if (!event) return data;

  (event.available_variables || []).forEach((v) => {
    data[v.key] = isRTL ? `[${v.label_ar}]` : `[${v.label_en}]`;
  });

  // override with stored preview_data (deterministic)
  if (event.preview_data && typeof event.preview_data === 'object') {
    Object.entries(event.preview_data).forEach(([k, val]) => {
      data[k] = val as string | number;
    });
  }

  return data;
}
