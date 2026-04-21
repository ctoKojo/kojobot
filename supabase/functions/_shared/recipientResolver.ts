/**
 * recipientResolver.ts — Centralized resolver for student notification recipients.
 *
 * RULE: For ANY student-targeted email (payment due, session reminder, etc.):
 *   1. Look up linked parents in `parent_students`.
 *   2. Use parent emails (preferred). One email per parent.
 *   3. If no parent has an email, fall back to the student's own email.
 *   4. If neither exists, return an empty list and a `skipReason`.
 *
 * Used by Edge Functions (session-reminders, check-payment-dues, etc.)
 * to keep recipient logic consistent across the system.
 */

// deno-lint-ignore-file no-explicit-any

export interface ResolvedRecipient {
  email: string;
  name: string;
  recipientType: 'parent' | 'student';
  parentId?: string;
  studentId: string;
}

export interface ResolveResult {
  recipients: ResolvedRecipient[];
  skipReason: string | null;
}

/**
 * Resolve email recipients for a student.
 * @param supabase A service-role Supabase client.
 * @param studentId The student's auth user_id.
 * @param studentFallback Pre-fetched student profile (optional, avoids extra query).
 */
export async function resolveStudentRecipients(
  supabase: any,
  studentId: string,
  studentFallback?: { email?: string | null; full_name?: string | null; full_name_ar?: string | null } | null,
): Promise<ResolveResult> {
  // 1) Look up linked parents
  const { data: links, error: linksError } = await supabase
    .from('parent_students')
    .select('parent_id')
    .eq('student_id', studentId);

  if (linksError) {
    console.error('[recipientResolver] Failed to fetch parent_students:', linksError);
  }

  const parentIds = (links || []).map((l: any) => l.parent_id).filter(Boolean);

  // 2) Fetch parent profiles in one round-trip
  let parentProfiles: any[] = [];
  if (parentIds.length > 0) {
    const { data: pp, error: ppErr } = await supabase
      .from('profiles')
      .select('user_id, full_name, full_name_ar, email')
      .in('user_id', parentIds);
    if (ppErr) {
      console.error('[recipientResolver] Failed to fetch parent profiles:', ppErr);
    }
    parentProfiles = pp || [];
  }

  const parentRecipients: ResolvedRecipient[] = parentProfiles
    .filter((p) => p.email && String(p.email).trim().length > 0)
    .map((p) => ({
      email: String(p.email).trim(),
      name: p.full_name_ar || p.full_name || 'Parent',
      recipientType: 'parent' as const,
      parentId: p.user_id,
      studentId,
    }));

  if (parentRecipients.length > 0) {
    return { recipients: parentRecipients, skipReason: null };
  }

  // 3) Fallback to student email
  let studentProfile = studentFallback ?? null;
  if (!studentProfile) {
    const { data: sp } = await supabase
      .from('profiles')
      .select('email, full_name, full_name_ar')
      .eq('user_id', studentId)
      .maybeSingle();
    studentProfile = sp;
  }

  if (studentProfile?.email) {
    return {
      recipients: [
        {
          email: String(studentProfile.email).trim(),
          name: studentProfile.full_name_ar || studentProfile.full_name || 'Student',
          recipientType: 'student',
          studentId,
        },
      ],
      skipReason: parentIds.length === 0
        ? 'no_parent_linked_using_student_email'
        : 'parent_has_no_email_using_student_email',
    };
  }

  // 4) Nothing usable
  return {
    recipients: [],
    skipReason: parentIds.length === 0
      ? 'no_parent_linked_and_student_has_no_email'
      : 'no_parent_email_and_no_student_email',
  };
}
