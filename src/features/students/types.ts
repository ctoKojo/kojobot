/**
 * Students — Data Contracts (Layer 1.5: Types)
 *
 * Stable shapes returned by the 6 RPCs in `supabase/migrations/...students_rpc_layer.sql`.
 * Three canonical shapes ONLY. Any new shape must be reviewed against ARCHITECTURE.md.
 *
 *   StudentListItem    — table rows (get_students_list)
 *   StudentSummary     — cards / widgets (get_student_summary)
 *   StudentFullProfile — profile page (get_student_full_profile)
 */

// ---------------------------------------------------------------------------
// Enums (stable string unions — never `string`)
// ---------------------------------------------------------------------------

/** Mirrors the DB enum (`group_type`). Single source of truth: `@/lib/constants`. */
export type SubscriptionType = 'kojo_squad' | 'kojo_core' | 'kojo_x';

export type AttendanceMode = 'online' | 'offline';

export type SubscriptionStatusFilter = 'active' | 'none' | 'needs_renewal';

export type RenewalReason =
  | 'no_subscription'
  | 'subscription_inactive'
  | 'no_active_group'
  | 'level_completed'
  | 'level_in_progress'
  | 'unknown';

export type GroupStatus = 'pending' | 'active' | 'completed' | 'frozen' | 'cancelled';

// ---------------------------------------------------------------------------
// Sub-shapes (composed into the 3 canonical contracts)
// ---------------------------------------------------------------------------

export interface AgeGroupRef {
  id: string;
  name: string;
  name_ar: string;
}

export interface LevelRef {
  id: string;
  name: string;
  name_ar: string;
}

export interface GroupRef {
  id: string;
  name: string;
  name_ar: string;
  status: GroupStatus;
  group_type: string;
}

export interface AttendanceStats {
  total_sessions: number;
  attended: number;
  absent: number;
  late: number;
  attendance_rate: number; // 0-100
}

export interface SubscriptionStatusPayload {
  has_subscription: boolean;
  subscription_id: string | null;
  status: 'active' | 'expired' | 'cancelled' | null;
  is_suspended: boolean;
  paid_amount: number;
  total_amount: number;
  remaining_amount: number;
  next_payment_date: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface RenewalStatus {
  needs_renewal: boolean;
  reason: RenewalReason;
  current_level_id: string | null;
  next_level_id: string | null;
}

export interface ParentRef {
  user_id: string;
  full_name: string;
  full_name_ar: string | null;
  phone: string | null;
  email: string | null;
}

export interface RecentPayment {
  id: string;
  subscription_id: string | null;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  payment_type: string | null;
  notes: string | null;
  created_at: string;
}

export interface RecentAttendance {
  id: string;
  session_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  recorded_at: string;
  notes: string | null;
}

export interface LifecycleSnapshot {
  id: string;
  group_id: string;
  current_level_id: string;
  next_level_id: string | null;
  status: string;
  outcome: string | null;
  level_started_at: string | null;
  level_completed_at: string | null;
  exam_scheduled_at: string | null;
  exam_submitted_at: string | null;
  graded_at: string | null;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// CONTRACT 1: StudentListItem (rows in tables)
// Source: get_students_list → items[]
// ---------------------------------------------------------------------------

export interface StudentListItem {
  user_id: string;
  profile_id: string;
  full_name: string;
  full_name_ar: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  subscription_type: SubscriptionType | null;
  attendance_mode: AttendanceMode | null;
  is_approved: boolean;
  needs_renewal: boolean;
  created_at: string;

  age_group_id: string | null;
  age_group_name: string | null;
  age_group_name_ar: string | null;

  level_id: string | null;
  level_name: string | null;
  level_name_ar: string | null;

  group_id: string | null;
  group_name: string | null;
  group_name_ar: string | null;
  group_status: GroupStatus | null;

  subscription_status: 'active' | 'expired' | 'cancelled' | null;
  subscription_end_date: string | null;
}

export interface StudentsListPayload {
  total: number;
  limit: number;
  offset: number;
  items: StudentListItem[];
}

export interface StudentsListFilters {
  search?: string;
  age_group_id?: string;
  level_id?: string;
  group_id?: string;
  subscription_status?: SubscriptionStatusFilter;
}

export interface StudentsListParams {
  filters?: StudentsListFilters;
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'full_name' | 'full_name_ar' | 'email';
  sort_dir?: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// CONTRACT 2: StudentSummary (cards, widgets, dashboards)
// Source: get_student_summary
// ---------------------------------------------------------------------------

export interface StudentSummary {
  found: true;
  user_id: string;
  profile_id: string;
  full_name: string;
  full_name_ar: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  subscription_type: SubscriptionType | null;
  attendance_mode: AttendanceMode | null;
  is_approved: boolean;

  age_group: AgeGroupRef | null;
  current_level: LevelRef | null;
  current_group: GroupRef | null;

  attendance: AttendanceStats;
  subscription: SubscriptionStatusPayload;
  renewal: RenewalStatus;
}

export interface StudentNotFound {
  found: false;
}

export type StudentSummaryResult = StudentSummary | StudentNotFound;

// ---------------------------------------------------------------------------
// CONTRACT 3: StudentFullProfile (profile page)
// Source: get_student_full_profile
// ---------------------------------------------------------------------------

export interface StudentFullProfile extends StudentSummary {
  parents: ParentRef[];
  recent_payments: RecentPayment[];
  recent_attendance: RecentAttendance[];
  lifecycle: LifecycleSnapshot | null;
}

export type StudentFullProfileResult = StudentFullProfile | StudentNotFound;

// ---------------------------------------------------------------------------
// Mutation payloads (for useUpdateStudent)
// ---------------------------------------------------------------------------

export interface UpdateStudentInput {
  user_id: string;
  full_name?: string;
  full_name_ar?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  age_group_id?: string | null;
  level_id?: string | null;
  subscription_type?: SubscriptionType | null;
  attendance_mode?: AttendanceMode;
  avatar_url?: string | null;
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isStudentFound<T extends { found: boolean }>(
  result: T,
): result is T & { found: true } {
  return result.found === true;
}
