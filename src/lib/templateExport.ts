/**
 * JSON export/import helpers for email templates.
 *
 * Export format (schema_version 1):
 * {
 *   schema_version: 1,
 *   exported_at: ISO string,
 *   exported_by: user id (optional),
 *   templates: [ { id, name, ..., updated_at } ]
 * }
 */

import type { EmailTemplateRow } from '@/components/email/TemplateEditorDialog';

export const TEMPLATE_EXPORT_SCHEMA_VERSION = 1;

export interface ExportedFile {
  schema_version: number;
  exported_at: string;
  exported_by?: string | null;
  templates: ExportedTemplate[];
}

export interface ExportedTemplate {
  id?: string;
  name: string;
  description: string | null;
  audience: string;
  subject_en: string;
  subject_ar: string;
  body_html_en: string;
  body_html_ar: string;
  subject_telegram_en: string | null;
  subject_telegram_ar: string | null;
  body_telegram_md_en: string | null;
  body_telegram_md_ar: string | null;
  is_active: boolean;
  updated_at?: string;
}

export interface DiffEntry {
  status: 'new' | 'modified' | 'unchanged' | 'conflict';
  incoming: ExportedTemplate;
  existing?: EmailTemplateRow;
  changedFields: string[];
}

export function buildExport(
  templates: EmailTemplateRow[],
  exportedBy?: string | null,
): ExportedFile {
  return {
    schema_version: TEMPLATE_EXPORT_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    exported_by: exportedBy ?? null,
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      audience: t.audience ?? 'student',
      subject_en: t.subject_en,
      subject_ar: t.subject_ar,
      body_html_en: t.body_html_en,
      body_html_ar: t.body_html_ar,
      subject_telegram_en: t.subject_telegram_en ?? null,
      subject_telegram_ar: t.subject_telegram_ar ?? null,
      body_telegram_md_en: t.body_telegram_md_en ?? null,
      body_telegram_md_ar: t.body_telegram_md_ar ?? null,
      is_active: t.is_active,
      updated_at: t.updated_at,
    })),
  };
}

export function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const COMPARE_FIELDS: (keyof ExportedTemplate)[] = [
  'name',
  'description',
  'audience',
  'subject_en',
  'subject_ar',
  'body_html_en',
  'body_html_ar',
  'subject_telegram_en',
  'subject_telegram_ar',
  'body_telegram_md_en',
  'body_telegram_md_ar',
  'is_active',
];

export function parseImport(text: string): ExportedFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON file');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('JSON must be an object');
  }
  const file = parsed as ExportedFile;
  if (file.schema_version !== TEMPLATE_EXPORT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schema_version ${file.schema_version}. Expected ${TEMPLATE_EXPORT_SCHEMA_VERSION}.`,
    );
  }
  if (!Array.isArray(file.templates)) {
    throw new Error('"templates" must be an array');
  }
  // basic per-record validation
  file.templates.forEach((t, i) => {
    if (!t.name || typeof t.name !== 'string') {
      throw new Error(`Template at index ${i} is missing "name"`);
    }
    if (!t.subject_en || !t.subject_ar) {
      throw new Error(`Template "${t.name}" missing subjects`);
    }
    if (!t.body_html_en || !t.body_html_ar) {
      throw new Error(`Template "${t.name}" missing email bodies`);
    }
  });
  return file;
}

export function diffTemplates(
  incoming: ExportedFile,
  existing: EmailTemplateRow[],
): DiffEntry[] {
  return incoming.templates.map((inc) => {
    const match =
      (inc.id && existing.find((e) => e.id === inc.id)) ||
      existing.find((e) => e.name === inc.name);

    if (!match) {
      return { status: 'new', incoming: inc, changedFields: [] };
    }

    const changed: string[] = [];
    COMPARE_FIELDS.forEach((f) => {
      const a = (inc as any)[f] ?? null;
      const b = (match as any)[f] ?? null;
      if (a !== b) changed.push(f);
    });

    if (changed.length === 0) {
      return { status: 'unchanged', incoming: inc, existing: match, changedFields: [] };
    }

    // conflict: incoming.updated_at older than DB's updated_at
    const isConflict =
      inc.updated_at &&
      match.updated_at &&
      new Date(inc.updated_at).getTime() < new Date(match.updated_at).getTime();

    return {
      status: isConflict ? 'conflict' : 'modified',
      incoming: inc,
      existing: match,
      changedFields: changed,
    };
  });
}

export interface DiffSummary {
  total: number;
  new: number;
  modified: number;
  conflict: number;
  unchanged: number;
}

export function summarizeDiff(diffs: DiffEntry[]): DiffSummary {
  return diffs.reduce<DiffSummary>(
    (acc, d) => {
      acc.total += 1;
      acc[d.status] = (acc[d.status] ?? 0) + 1;
      return acc;
    },
    { total: 0, new: 0, modified: 0, conflict: 0, unchanged: 0 },
  );
}
