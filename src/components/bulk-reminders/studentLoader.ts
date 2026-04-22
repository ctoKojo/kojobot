import { supabase } from '@/integrations/supabase/client';
import type { StudentRow } from './types';

/**
 * Fetch all students enriched with: profile info, active group + level, age group,
 * latest subscription status, and linked parents.
 */
export async function fetchEnrichedStudents(isRTL: boolean): Promise<StudentRow[]> {
  // 1. Get student user_ids
  const { data: roleRows, error: roleErr } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'student');
  if (roleErr) throw roleErr;
  const ids = (roleRows ?? []).map((r) => r.user_id);
  if (ids.length === 0) return [];

  // 2. Profiles + age groups (joined)
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('user_id, full_name, email, phone, age_group_id, age_groups(name, name_ar)')
    .in('user_id', ids);
  if (profErr) throw profErr;

  // 3. Active group enrollments
  const { data: groupLinks } = await supabase
    .from('group_students')
    .select('student_id, group_id, groups(id, name, name_ar, level_id, levels(name, name_ar))')
    .in('student_id', ids)
    .eq('is_active', true);

  const groupMap = new Map<
    string,
    { group_id: string; group_name: string; level_id: string | null; level_name: string | null }
  >();
  (groupLinks ?? []).forEach((l: any) => {
    const g = l.groups;
    if (!g) return;
    groupMap.set(l.student_id, {
      group_id: g.id,
      group_name: isRTL ? g.name_ar || g.name : g.name || g.name_ar,
      level_id: g.level_id ?? null,
      level_name: g.levels ? (isRTL ? g.levels.name_ar || g.levels.name : g.levels.name || g.levels.name_ar) : null,
    });
  });

  // 4. Latest active subscription per student
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('student_id, status, end_date')
    .in('student_id', ids);

  const subMap = new Map<string, { status: string; end_date: string | null }>();
  (subs ?? []).forEach((s: any) => {
    const existing = subMap.get(s.student_id);
    // Prefer active, then most-recent end_date
    if (!existing) {
      subMap.set(s.student_id, { status: s.status, end_date: s.end_date });
    } else if (s.status === 'active' && existing.status !== 'active') {
      subMap.set(s.student_id, { status: s.status, end_date: s.end_date });
    } else if (
      s.status === existing.status &&
      s.end_date &&
      (!existing.end_date || new Date(s.end_date) > new Date(existing.end_date))
    ) {
      subMap.set(s.student_id, { status: s.status, end_date: s.end_date });
    }
  });

  // 5. Linked parents
  const { data: parentLinks } = await supabase
    .from('parent_students')
    .select('student_id, parent_id')
    .in('student_id', ids);

  const parentIds = Array.from(new Set((parentLinks ?? []).map((l) => l.parent_id)));
  const parentInfo = new Map<string, { full_name: string; email: string | null }>();
  if (parentIds.length > 0) {
    const { data: parentProfiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, email')
      .in('user_id', parentIds);
    (parentProfiles ?? []).forEach((p) => {
      parentInfo.set(p.user_id, { full_name: p.full_name || '—', email: p.email });
    });
  }

  const parentsByStudent = new Map<
    string,
    Array<{ parent_id: string; full_name: string; email: string | null }>
  >();
  (parentLinks ?? []).forEach((l) => {
    const info = parentInfo.get(l.parent_id);
    if (!info) return;
    const list = parentsByStudent.get(l.student_id) ?? [];
    list.push({ parent_id: l.parent_id, full_name: info.full_name, email: info.email });
    parentsByStudent.set(l.student_id, list);
  });

  const rows: StudentRow[] = (profiles ?? []).map((p: any) => {
    const grp = groupMap.get(p.user_id);
    const sub = subMap.get(p.user_id);
    const ageGroupName = p.age_groups
      ? (isRTL ? p.age_groups.name_ar || p.age_groups.name : p.age_groups.name || p.age_groups.name_ar)
      : null;
    return {
      user_id: p.user_id,
      full_name: p.full_name || '—',
      email: p.email,
      phone: p.phone,
      age_group_id: p.age_group_id ?? null,
      age_group_name: ageGroupName,
      group_id: grp?.group_id ?? null,
      group_name: grp?.group_name ?? null,
      level_id: grp?.level_id ?? null,
      level_name: grp?.level_name ?? null,
      subscription_status: (sub?.status as any) ?? 'none',
      subscription_end_date: sub?.end_date ?? null,
      parents: parentsByStudent.get(p.user_id) ?? [],
    };
  });

  rows.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  return rows;
}
