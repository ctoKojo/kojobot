import { supabase } from '@/integrations/supabase/client';
import { fetchEnrichedStudents } from './studentLoader';
import type { StudentRow } from './types';

export type AudienceType = 'students' | 'parents' | 'instructors';

/**
 * Unified recipient row for the bulk reminders UI.
 * - For students: keeps full StudentRow (with parents) so smart routing still works.
 * - For parents/instructors: a single user receives directly.
 */
export interface RecipientRow {
  id: string;               // user_id of the direct recipient (or student for student audience)
  full_name: string;
  email: string | null;
  phone: string | null;
  has_telegram: boolean;
  // Optional context shown in the table
  group_name?: string | null;
  level_name?: string | null;
  meta?: string | null;     // e.g. linked students count for parents
  // Audience-specific extras
  studentRow?: StudentRow;  // present when audience === 'students'
}

/** Load students using existing enricher + adapt to RecipientRow */
export async function loadStudentRecipients(isRTL: boolean): Promise<RecipientRow[]> {
  const rows = await fetchEnrichedStudents(isRTL);
  return rows.map((s) => ({
    id: s.user_id,
    full_name: s.full_name,
    email: s.email,
    phone: s.phone,
    has_telegram: !!s.has_telegram,
    group_name: s.group_name ?? null,
    level_name: s.level_name ?? null,
    studentRow: s,
  }));
}

/** Load all parent users with their linked student count */
export async function loadParentRecipients(isRTL: boolean): Promise<RecipientRow[]> {
  const { data: roleRows, error } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'parent');
  if (error) throw error;
  const ids = (roleRows ?? []).map((r) => r.user_id);
  if (ids.length === 0) return [];

  const [{ data: profiles }, { data: links }, { data: tg }] = await Promise.all([
    supabase.from('profiles').select('user_id, full_name, email, phone').in('user_id', ids),
    supabase.from('parent_students').select('parent_id, student_id').in('parent_id', ids),
    supabase.from('telegram_links').select('user_id').in('user_id', ids).eq('is_active', true),
  ]);

  const tgSet = new Set((tg ?? []).map((t: any) => t.user_id));
  const childCount = new Map<string, number>();
  (links ?? []).forEach((l: any) => {
    childCount.set(l.parent_id, (childCount.get(l.parent_id) ?? 0) + 1);
  });

  const rows: RecipientRow[] = (profiles ?? []).map((p: any) => ({
    id: p.user_id,
    full_name: p.full_name || '—',
    email: p.email,
    phone: p.phone,
    has_telegram: tgSet.has(p.user_id),
    meta: (() => {
      const n = childCount.get(p.user_id) ?? 0;
      if (n === 0) return isRTL ? 'لا يوجد أبناء مرتبطين' : 'No linked children';
      return isRTL ? `${n} طالب مرتبط` : `${n} linked student${n === 1 ? '' : 's'}`;
    })(),
  }));
  rows.sort((a, b) => a.full_name.localeCompare(b.full_name));
  return rows;
}

/** Load all instructor users */
export async function loadInstructorRecipients(isRTL: boolean): Promise<RecipientRow[]> {
  const { data: roleRows, error } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'instructor');
  if (error) throw error;
  const ids = (roleRows ?? []).map((r) => r.user_id);
  if (ids.length === 0) return [];

  const [{ data: profiles }, { data: tg }, { data: groupLinks }] = await Promise.all([
    supabase.from('profiles').select('user_id, full_name, email, phone').in('user_id', ids),
    supabase.from('telegram_links').select('user_id').in('user_id', ids).eq('is_active', true),
    supabase
      .from('groups')
      .select('id, name, name_ar, instructor_id')
      .in('instructor_id', ids)
      .eq('status', 'active'),
  ]);

  const tgSet = new Set((tg ?? []).map((t: any) => t.user_id));
  const groupCount = new Map<string, number>();
  (groupLinks ?? []).forEach((g: any) => {
    if (!g.instructor_id) return;
    groupCount.set(g.instructor_id, (groupCount.get(g.instructor_id) ?? 0) + 1);
  });

  const rows: RecipientRow[] = (profiles ?? []).map((p: any) => ({
    id: p.user_id,
    full_name: p.full_name || '—',
    email: p.email,
    phone: p.phone,
    has_telegram: tgSet.has(p.user_id),
    meta: (() => {
      const n = groupCount.get(p.user_id) ?? 0;
      if (n === 0) return isRTL ? 'لا توجد مجموعات نشطة' : 'No active groups';
      return isRTL ? `${n} مجموعة نشطة` : `${n} active group${n === 1 ? '' : 's'}`;
    })(),
  }));
  rows.sort((a, b) => a.full_name.localeCompare(b.full_name));
  return rows;
}

export async function loadRecipients(audience: AudienceType, isRTL: boolean): Promise<RecipientRow[]> {
  if (audience === 'students') return loadStudentRecipients(isRTL);
  if (audience === 'parents') return loadParentRecipients(isRTL);
  return loadInstructorRecipients(isRTL);
}
