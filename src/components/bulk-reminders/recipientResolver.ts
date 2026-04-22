import type { ParentInfo, RecipientMode, StudentRow } from './types';

export interface ResolvedRecipient {
  studentId: string;
  studentName: string;
  recipientType: 'parent' | 'student';
  recipientName: string;
  email: string;
  parentId?: string;
}

export interface SkippedRecipient {
  studentId: string;
  studentName: string;
  reason: string;
}

/**
 * Resolve recipients for a single student based on the recipient mode.
 * Returns at least one recipient (or a skip reason).
 *
 * - parent: only parents with email
 * - student: only the student's own email
 * - both: parents (if any with email) + student (if has email)
 * - smart: parents preferred; fall back to student if no parent has email
 */
export function resolveRecipients(
  s: StudentRow,
  mode: RecipientMode,
  isRTL: boolean,
): { recipients: ResolvedRecipient[]; skipped: SkippedRecipient[] } {
  const recipients: ResolvedRecipient[] = [];
  const skipped: SkippedRecipient[] = [];
  const parentsWithEmail = s.parents.filter((p) => p.email);

  const addParents = (list: ParentInfo[]) => {
    for (const p of list) {
      if (p.email) {
        recipients.push({
          studentId: s.user_id,
          studentName: s.full_name,
          recipientType: 'parent',
          recipientName: p.full_name,
          email: p.email,
          parentId: p.parent_id,
        });
      }
    }
  };

  const addStudent = () => {
    if (s.email) {
      recipients.push({
        studentId: s.user_id,
        studentName: s.full_name,
        recipientType: 'student',
        recipientName: s.full_name,
        email: s.email,
      });
    }
  };

  if (mode === 'parent') {
    if (parentsWithEmail.length === 0) {
      skipped.push({
        studentId: s.user_id,
        studentName: s.full_name,
        reason: isRTL ? 'لا يوجد ولي أمر بإيميل' : 'No parent with email',
      });
    } else {
      addParents(parentsWithEmail);
    }
  } else if (mode === 'student') {
    if (!s.email) {
      skipped.push({
        studentId: s.user_id,
        studentName: s.full_name,
        reason: isRTL ? 'الطالب ليس له إيميل' : 'Student has no email',
      });
    } else {
      addStudent();
    }
  } else if (mode === 'both') {
    addParents(parentsWithEmail);
    addStudent();
    if (recipients.length === 0) {
      skipped.push({
        studentId: s.user_id,
        studentName: s.full_name,
        reason: isRTL ? 'لا توجد إيميلات متاحة' : 'No emails available',
      });
    }
  } else {
    // smart
    if (parentsWithEmail.length > 0) {
      addParents(parentsWithEmail);
    } else if (s.email) {
      addStudent();
    } else {
      skipped.push({
        studentId: s.user_id,
        studentName: s.full_name,
        reason: isRTL ? 'لا ولي أمر ولا بريد طالب' : 'No parent and no student email',
      });
    }
  }

  return { recipients, skipped };
}

/**
 * Build the auto template variables for a given recipient.
 */
export function buildAutoTemplateData(
  recipient: ResolvedRecipient,
  student: StudentRow,
  userOverrides: Record<string, string>,
): Record<string, unknown> {
  const auto: Record<string, unknown> = {
    recipientName: recipient.recipientName,
    studentName: student.full_name,
    parentName: recipient.recipientType === 'parent' ? recipient.recipientName : '',
    groupName: student.group_name ?? '',
    levelName: student.level_name ?? '',
    recipientType: recipient.recipientType,
  };

  // User overrides win for keys they've explicitly filled in.
  for (const [k, v] of Object.entries(userOverrides)) {
    if (v && v.trim().length > 0) auto[k] = v;
  }
  return auto;
}

/**
 * Convert a list of send results to a CSV blob.
 */
export function resultsToCsv(rows: Array<{
  studentName: string;
  recipientType: string;
  recipientName: string;
  email: string;
  status: string;
  message?: string;
}>): string {
  const header = ['student', 'recipient_type', 'recipient_name', 'email', 'status', 'message'];
  const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      escape(r.studentName),
      escape(r.recipientType),
      escape(r.recipientName),
      escape(r.email),
      escape(r.status),
      escape(r.message ?? ''),
    ].join(','));
  }
  return lines.join('\n');
}
