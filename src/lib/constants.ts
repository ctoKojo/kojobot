// ============================================================
// SINGLE SOURCE OF TRUTH - Constants & Labels
// All group types, subscription types, role labels, and 
// attendance modes are defined here. Import from this file
// instead of defining locally.
// ============================================================

// --- App Timezone (Cairo SSOT) ---
export const APP_TIMEZONE = 'Africa/Cairo';

export type GroupType = 'kojo_squad' | 'kojo_core' | 'kojo_x';
export type AttendanceMode = 'online' | 'offline';
export type GroupStatus = 'active' | 'frozen';
export type SubscriptionType = 'kojo_squad' | 'kojo_core' | 'kojo_x';
export type AppRole = 'admin' | 'instructor' | 'student' | 'reception';

// --- Group Types ---
export const GROUP_TYPES: Record<GroupType, { en: string; ar: string; maxStudents: number }> = {
  kojo_squad: { en: 'Kojo Squad', ar: 'كوجو سكواد', maxStudents: 8 },
  kojo_core:  { en: 'Kojo Core',  ar: 'كوجو كور',  maxStudents: 3 },
  kojo_x:     { en: 'Kojo X',     ar: 'كوجو اكس',  maxStudents: 1 },
};

/** Get the list of group types as array (useful for Select components) */
export const GROUP_TYPES_LIST = Object.entries(GROUP_TYPES).map(([value, data]) => ({
  value: value as GroupType,
  label: data.en,
  labelAr: data.ar,
  maxStudents: data.maxStudents,
}));

/** Get localized group type label */
export function getGroupTypeLabel(type: string, isRTL: boolean): string {
  const gt = GROUP_TYPES[type as GroupType];
  return gt ? (isRTL ? gt.ar : gt.en) : type;
}

/** Get max students for a group type */
export function getMaxStudents(type: string): number {
  return GROUP_TYPES[type as GroupType]?.maxStudents ?? 8;
}

// --- Subscription Types (same values as group types for now) ---
export const SUBSCRIPTION_TYPES = GROUP_TYPES;

export function getSubscriptionTypeLabel(type: string, isRTL: boolean): string {
  return getGroupTypeLabel(type, isRTL);
}

// --- Attendance Modes ---
export const ATTENDANCE_MODES: Record<AttendanceMode, { en: string; ar: string }> = {
  online:  { en: 'Online',  ar: 'أونلاين' },
  offline: { en: 'Offline', ar: 'حضوري' },
};

export function getAttendanceModeLabel(mode: string, isRTL: boolean): string {
  const am = ATTENDANCE_MODES[mode as AttendanceMode];
  return am ? (isRTL ? am.ar : am.en) : mode;
}

// --- Role Labels ---
export const ROLE_LABELS: Record<AppRole, { en: string; ar: string }> = {
  admin:      { en: 'Admin',      ar: 'مدير' },
  instructor: { en: 'Instructor', ar: 'مدرب' },
  student:    { en: 'Student',    ar: 'طالب' },
  reception:  { en: 'Reception',  ar: 'ريسيبشن' },
};

export function getRoleLabel(role: string, isRTL: boolean): string {
  const r = ROLE_LABELS[role as AppRole];
  return r ? (isRTL ? r.ar : r.en) : role;
}

// --- Days of Week ---
export const DAYS_OF_WEEK = [
  { en: 'Sunday',    ar: 'الأحد' },
  { en: 'Monday',    ar: 'الاثنين' },
  { en: 'Tuesday',   ar: 'الثلاثاء' },
  { en: 'Wednesday', ar: 'الأربعاء' },
  { en: 'Thursday',  ar: 'الخميس' },
  { en: 'Friday',    ar: 'الجمعة' },
  { en: 'Saturday',  ar: 'السبت' },
];

const DAYS_MAP: Record<string, { en: string; ar: string }> = {
  Sunday:    { en: 'Sunday',    ar: 'الأحد' },
  Monday:    { en: 'Monday',    ar: 'الاثنين' },
  Tuesday:   { en: 'Tuesday',   ar: 'الثلاثاء' },
  Wednesday: { en: 'Wednesday', ar: 'الأربعاء' },
  Thursday:  { en: 'Thursday',  ar: 'الخميس' },
  Friday:    { en: 'Friday',    ar: 'الجمعة' },
  Saturday:  { en: 'Saturday',  ar: 'السبت' },
};

/** Get localized day name from English day name */
export function getDayName(day: string, isRTL: boolean): string {
  const d = DAYS_MAP[day];
  return d ? (isRTL ? d.ar : d.en) : day;
}

// --- Student Progress Status ---
export type StudentProgressStatus = 'in_progress' | 'awaiting_exam' | 'exam_scheduled' | 'graded' | 'paused';
export type StudentOutcome = 'passed' | 'failed' | 'repeat';
export type GroupLevelStatus = 'in_progress' | 'sessions_completed' | 'exam_scheduled' | 'exam_done' | 'grades_computed';

export const STUDENT_PROGRESS_STATUSES: Record<StudentProgressStatus, { en: string; ar: string }> = {
  in_progress:    { en: 'In Progress',     ar: 'جاري' },
  awaiting_exam:  { en: 'Awaiting Exam',   ar: 'في انتظار الامتحان' },
  exam_scheduled: { en: 'Exam Scheduled',  ar: 'امتحان مجدول' },
  graded:         { en: 'Graded',          ar: 'تم التقييم' },
  paused:         { en: 'Paused',          ar: 'متوقف' },
};

export function getStudentProgressStatusLabel(status: string, isRTL: boolean): string {
  const s = STUDENT_PROGRESS_STATUSES[status as StudentProgressStatus];
  return s ? (isRTL ? s.ar : s.en) : status;
}

export const STUDENT_OUTCOMES: Record<StudentOutcome, { en: string; ar: string }> = {
  passed: { en: 'Passed', ar: 'ناجح' },
  failed: { en: 'Failed', ar: 'راسب' },
  repeat: { en: 'Repeat', ar: 'إعادة' },
};

export function getStudentOutcomeLabel(outcome: string, isRTL: boolean): string {
  const o = STUDENT_OUTCOMES[outcome as StudentOutcome];
  return o ? (isRTL ? o.ar : o.en) : outcome;
}

export const GROUP_LEVEL_STATUSES: Record<GroupLevelStatus, { en: string; ar: string }> = {
  in_progress:         { en: 'In Progress',         ar: 'جاري' },
  sessions_completed:  { en: 'Sessions Completed',  ar: 'السيشنات اكتملت' },
  exam_scheduled:      { en: 'Exam Scheduled',      ar: 'امتحان مجدول' },
  exam_done:           { en: 'Exam Done',            ar: 'الامتحان انتهى' },
  grades_computed:     { en: 'Grades Computed',      ar: 'الدرجات محسوبة' },
};

export function getGroupLevelStatusLabel(status: string, isRTL: boolean): string {
  const s = GROUP_LEVEL_STATUSES[status as GroupLevelStatus];
  return s ? (isRTL ? s.ar : s.en) : status;
}
