import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCairoNow, getCairoCurrentMonth, getCairoDatePlusDays } from "../_shared/cairoTime.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// V3 Constants — Compliance Monitor Rules (settings-driven + makeup-aware)
// ============================================================
const MONITORING_START_DATE = '2026-04-17';
const RACE_BUFFER_MINUTES = 5;
const RESCAN_COOLDOWN_HOURS = 6;

// Default grace periods (overridden by system_settings.compliance_grace_periods)
const DEFAULT_GRACE = {
  attendance_minutes: 60,
  quiz_hours: 24,
  assignment_hours: 24,
  evaluation_hours: 24,
  makeup_multiplier: 1.5,
};

const BATCH_SIZE = 500;
const RECENT_WINDOW_DAYS = 3;
const RECENT_BATCH_RATIO = 0.3;

interface CompletedSession {
  id: string;
  session_date: string;
  session_time: string;
  session_number: number;
  content_number: number | null;
  level_id: string | null;
  duration_minutes?: number;
  end_at: string | null;
  is_makeup: boolean;
  makeup_session_id: string | null;
  group_id: string;
  status: string;
  cancellation_reason: string | null;
  last_compliance_scan_at: string | null;
  groups: {
    instructor_id: string;
    name: string;
    name_ar: string;
    starting_session_number: number | null;
    is_active: boolean;
    status: string;
  };
  makeup_sessions?: {
    assigned_instructor_id: string | null;
    original_session_id: string | null;
    original_session?: { session_number: number; session_date: string } | null;
  } | null;
}

// Cache curriculum lookups within a single run
const curriculumCache = new Map<string, { expectsQuiz: boolean; expectsAssignment: boolean } | null>();

async function getCurriculumExpectations(
  supabase: any,
  levelId: string | null,
  contentNumber: number | null
): Promise<{ expectsQuiz: boolean; expectsAssignment: boolean } | null> {
  if (!levelId || !contentNumber) return null;
  const key = `${levelId}::${contentNumber}`;
  if (curriculumCache.has(key)) return curriculumCache.get(key)!;

  // Use latest active version per (level_id, session_number)
  const { data } = await supabase
    .from('curriculum_sessions')
    .select('quiz_id, assignment_attachment_url, version')
    .eq('level_id', levelId)
    .eq('session_number', contentNumber)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    curriculumCache.set(key, null); // No curriculum requirements at all → caller should skip
    return null;
  }
  const result = {
    expectsQuiz: !!data.quiz_id,
    expectsAssignment: !!(data.assignment_attachment_url && data.assignment_attachment_url.trim().length > 0),
  };
  curriculumCache.set(key, result);
  return result;
}

// ============================================================
// Grace period check — uses end_at from DB (UTC) + makeup multiplier
// ============================================================
type GraceType = 'attendance' | 'quiz' | 'assignment' | 'evaluation';

interface GraceConfig {
  attendance_minutes: number;
  quiz_hours: number;
  assignment_hours: number;
  evaluation_hours: number;
  makeup_multiplier: number;
}

function baseGraceSeconds(cfg: GraceConfig, type: GraceType): number {
  switch (type) {
    case 'attendance': return Math.ceil(cfg.attendance_minutes * 60);
    case 'quiz':       return Math.ceil(cfg.quiz_hours * 3600);
    case 'assignment': return Math.ceil(cfg.assignment_hours * 3600);
    case 'evaluation': return Math.ceil(cfg.evaluation_hours * 3600);
  }
}

function effectiveGraceSeconds(cfg: GraceConfig, type: GraceType, isMakeup: boolean): number {
  const base = baseGraceSeconds(cfg, type);
  return isMakeup ? Math.ceil(base * cfg.makeup_multiplier) : base;
}

function isPastGrace(session: CompletedSession, cfg: GraceConfig, type: GraceType): boolean {
  // Prefer DB-supplied end_at (UTC). Fallback to computed value if missing.
  let endMs: number;
  if (session.end_at) {
    endMs = new Date(session.end_at).getTime();
  } else {
    const sessionEnd = new Date(`${session.session_date}T${session.session_time}+03:00`);
    sessionEnd.setMinutes(sessionEnd.getMinutes() + (session.duration_minutes ?? 60));
    endMs = sessionEnd.getTime();
  }
  const graceSec = effectiveGraceSeconds(cfg, type, !!session.is_makeup);
  const raceBufferSec = RACE_BUFFER_MINUTES * 60;
  return (Date.now() - endMs) / 1000 >= graceSec + raceBufferSec;
}

// Resolve the responsible instructor (makeup-aware with mandatory fallback)
function getResponsibleInstructor(s: CompletedSession): string | null {
  if (s.is_makeup && s.makeup_sessions?.assigned_instructor_id) {
    return s.makeup_sessions.assigned_instructor_id;
  }
  return s.groups?.instructor_id ?? null;
}

// Build makeup context suffix for warning messages
function makeupCtx(s: CompletedSession, isAr: boolean): string {
  if (!s.is_makeup) return '';
  const d = s.makeup_sessions?.original_session?.session_date ?? '?';
  return isAr ? ` (تعويضية لسيشن ${d})` : ` (Makeup for ${d})`;
}

// Eligible groups cache (per run): groupId → has any active student
const groupHasStudentsCache = new Map<string, boolean>();
async function groupHasActiveStudents(supabase: any, groupId: string): Promise<boolean> {
  if (groupHasStudentsCache.has(groupId)) return groupHasStudentsCache.get(groupId)!;
  const { count } = await supabase
    .from('group_students')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('is_active', true);
  const has = (count || 0) > 0;
  groupHasStudentsCache.set(groupId, has);
  return has;
}

// ============================================================
// Eligibility filter (unified) — all checks share these rules
// ============================================================
function isCanceled(s: CompletedSession): boolean {
  return s.status === 'canceled' || (s.cancellation_reason !== null && s.cancellation_reason !== '');
}

function isLegacy(s: CompletedSession): boolean {
  const startingNum = s.groups.starting_session_number || 1;
  return startingNum > 1 && s.session_number < startingNum;
}

async function isEligible(supabase: any, s: CompletedSession): Promise<boolean> {
  if (s.session_date < MONITORING_START_DATE) return false;
  if (isCanceled(s)) return false;
  if (isLegacy(s)) return false;
  if (!s.groups.is_active) return false;
  if (['frozen', 'completed', 'canceled'].includes(s.groups.status)) return false;
  if (!(await groupHasActiveStudents(supabase, s.group_id))) return false;
  return true;
}

// ============================================================
// Anti-starvation batch: 70% oldest unscanned + 30% recent
// ============================================================
const SESSION_SELECT = `id, session_date, session_time, session_number, content_number, level_id, duration_minutes, end_at, is_makeup, makeup_session_id, group_id, status, cancellation_reason, last_compliance_scan_at, groups!inner(instructor_id, name, name_ar, starting_session_number, status, is_active), makeup_sessions:makeup_session_id(assigned_instructor_id, original_session_id, original_session:original_session_id(session_number, session_date))`;

async function fetchEligibleSessions(supabase: any, todayStr: string): Promise<CompletedSession[]> {
  const recentLimit = Math.floor(BATCH_SIZE * RECENT_BATCH_RATIO);
  const oldestLimit = BATCH_SIZE - recentLimit;
  const recentCutoff = getCairoDatePlusDays(-RECENT_WINDOW_DAYS);
  const cooldownCutoff = new Date(Date.now() - RESCAN_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();

  // Oldest unscanned (or scanned > cooldown ago)
  const { data: oldest } = await supabase
    .from('sessions')
    .select(SESSION_SELECT)
    .in('status', ['completed', 'scheduled'])
    .gte('session_date', MONITORING_START_DATE)
    .lte('session_date', todayStr)
    .or(`last_compliance_scan_at.is.null,last_compliance_scan_at.lt.${cooldownCutoff}`)
    .order('session_date', { ascending: true })
    .order('session_time', { ascending: true })
    .limit(oldestLimit);

  // Recent window (last 3 days) — fresh sessions get priority too
  const { data: recent } = await supabase
    .from('sessions')
    .select(SESSION_SELECT)
    .in('status', ['completed', 'scheduled'])
    .gte('session_date', recentCutoff)
    .lte('session_date', todayStr)
    .or(`last_compliance_scan_at.is.null,last_compliance_scan_at.lt.${cooldownCutoff}`)
    .order('session_date', { ascending: false })
    .limit(recentLimit);

  // Merge and dedupe
  const merged = new Map<string, CompletedSession>();
  for (const s of (oldest || []) as unknown as CompletedSession[]) merged.set(s.id, s);
  for (const s of (recent || []) as unknown as CompletedSession[]) merged.set(s.id, s);
  return Array.from(merged.values());
}

// Touch last_compliance_scan_at for a batch of session ids
async function markScanned(supabase: any, sessionIds: string[]): Promise<void> {
  if (sessionIds.length === 0) return;
  // Process in chunks of 200 to keep request small
  for (let i = 0; i < sessionIds.length; i += 200) {
    const chunk = sessionIds.slice(i, i + 200);
    await supabase
      .from('sessions')
      .update({ last_compliance_scan_at: new Date().toISOString() })
      .in('id', chunk);
  }
}

// ============================================================
// Insert warning with race re-check (gap #3) + scan-lag tracking
// ============================================================
interface InsertWarningParams {
  supabase: any;
  session: CompletedSession;
  warningType: 'no_quiz' | 'no_assignment' | 'no_attendance' | 'no_evaluation';
  reason: string;
  reasonAr: string;
  notifTitle: string;
  notifTitleAr: string;
  notifMessage: string;
  notifMessageAr: string;
  // Re-check function: returns true if warning is STILL warranted (condition still missing)
  recheckCondition: () => Promise<boolean>;
}

async function insertWarningWithRecheck(
  p: InsertWarningParams,
  ctx: { traceId: string; settingsVersion: number }
): Promise<'inserted' | 'duplicate' | 'race_resolved' | 'error'> {
  const instructorId = getResponsibleInstructor(p.session);
  if (!instructorId) {
    console.warn(`[${p.warningType}] no responsible instructor for session ${p.session.id}`);
    return 'error';
  }

  // 1) Race re-check first (cheap signal)
  const stillMissing = await p.recheckCondition();
  if (!stillMissing) return 'race_resolved';

  // 2) Deterministic dedup via fingerprint RPC
  const { data: dedupRows, error: dedupErr } = await p.supabase.rpc('insert_warning_deduped', {
    p_session_id: p.session.id,
    p_instructor_id: instructorId,
    p_warning_type: p.warningType,
    p_reason: p.reason,
    p_reason_ar: p.reasonAr,
    p_severity: 'warning',
    p_issued_by: instructorId,
    p_settings_version: ctx.settingsVersion,
    p_trace_id: ctx.traceId,
    p_level_id: p.session.level_id ?? null,
    p_content_number: (p.session as { content_number?: number | null }).content_number ?? null,
    p_reference_id: null,
    p_reference_type: null,
  });

  if (dedupErr) {
    console.error(`[${p.warningType} insert_warning_deduped]`, dedupErr);
    return 'error';
  }

  const result = Array.isArray(dedupRows) ? dedupRows[0] : dedupRows;
  if (!result?.inserted) {
    return 'duplicate';
  }

  // 3) Notification (best-effort)
  await p.supabase.from('notifications').insert({
    user_id: instructorId,
    title: p.notifTitle, title_ar: p.notifTitleAr,
    message: p.notifMessage, message_ar: p.notifMessageAr,
    type: 'warning', category: 'compliance',
  });

  return 'inserted';
}

// Compute scan lag in seconds (now - session end time)
function computeScanLagSeconds(session: CompletedSession): number {
  const sessionEnd = new Date(`${session.session_date}T${session.session_time}+03:00`);
  sessionEnd.setMinutes(sessionEnd.getMinutes() + (session.duration_minutes ?? 60));
  return Math.max(0, Math.floor((Date.now() - sessionEnd.getTime()) / 1000));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Auth: service role, CRON_SECRET env, OR vault cron_secret (via RPC)
  const authHeader = req.headers.get('Authorization');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const cronSecret = Deno.env.get('CRON_SECRET');
  const token = authHeader?.replace('Bearer ', '') ?? '';
  const isServiceRole = token === supabaseKey;
  const isCronEnvAuth = !!cronSecret && token === cronSecret;

  let isVaultCronAuth = false;
  if (!isServiceRole && !isCronEnvAuth && token) {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const tmpClient = createClient(supabaseUrl, supabaseKey);
      const { data } = await tmpClient.rpc('verify_cron_token', { p_token: token });
      isVaultCronAuth = data === true;
    } catch (_) {
      isVaultCronAuth = false;
    }
  }

  if (!isServiceRole && !isCronEnvAuth && !isVaultCronAuth) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const startTime = Date.now();
  const TIMEOUT_MS = 30000;
  const CIRCUIT_BREAKER_THRESHOLD = 0.8;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // ===== V3: trace_id + settings snapshot (consistent throughout run) =====
  const RUN_TRACE_ID = crypto.randomUUID();
  const RUN_STARTED_AT = new Date().toISOString();

  const { data: settingsRow } = await supabase
    .from('system_settings')
    .select('value, version')
    .eq('key', 'compliance_grace_periods')
    .maybeSingle();

  const GRACE_CFG: GraceConfig = {
    ...DEFAULT_GRACE,
    ...((settingsRow?.value as Partial<GraceConfig>) ?? {}),
  };
  const SETTINGS_VERSION = (settingsRow as any)?.version ?? 0;

  console.log(JSON.stringify({
    event: 'compliance_run_started',
    trace_id: RUN_TRACE_ID,
    settings_version: SETTINGS_VERSION,
    settings: GRACE_CFG,
    started_at: RUN_STARTED_AT,
  }));

  // Create scan run record at the start
  const { data: scanRun } = await supabase
    .from('compliance_scan_runs')
    .insert({
      scan_type: 'compliance-monitor',
      metadata: { trace_id: RUN_TRACE_ID, settings_version: SETTINGS_VERSION, settings: GRACE_CFG },
    })
    .select('id')
    .single();
  const scanRunId = scanRun?.id;

  try {
    const results = {
      instructorWarnings: 0,
      studentWarnings: 0,
      skippedLegacySessions: 0,
      slaReminders: 0,
      slaWarnings: 0,
      metricsUpdated: 0,
      bonusRecommendations: 0,
      autoResolved: 0,
      sessionsScanned: 0,
      warningsSkipped: 0,
      raceResolved: 0,
      avgScanLagSeconds: 0,
      errors: [] as string[],
      circuitBreakerTriggered: false,
    };

    const now = new Date();
    const cairo = getCairoNow();
    const todayStr = cairo.today;
    const currentTime = cairo.timeHHMMSS;
    const currentMonth = getCairoCurrentMonth();

    console.log(`[Compliance Monitor V2] Running at ${todayStr} ${currentTime} Cairo time`);

    const checkCircuitBreaker = (): boolean => {
      const elapsed = Date.now() - startTime;
      if (elapsed > TIMEOUT_MS * CIRCUIT_BREAKER_THRESHOLD) {
        console.warn(`[Circuit Breaker] Triggered at ${elapsed}ms`);
        results.circuitBreakerTriggered = true;
        return true;
      }
      return false;
    };

    // ========================================
    // Fetch eligible sessions ONCE (anti-starvation 70/30)
    // ========================================
    const allSessions = await fetchEligibleSessions(supabase, todayStr);
    results.sessionsScanned = allSessions.length;
    console.log(`[Compliance Monitor V2] Fetched ${allSessions.length} sessions for scanning`);

    // Compute average scan lag for telemetry
    if (allSessions.length > 0) {
      const totalLag = allSessions.reduce((sum, s) => sum + computeScanLagSeconds(s), 0);
      results.avgScanLagSeconds = Math.floor(totalLag / allSessions.length);
    }

    // Pre-filter eligible sessions
    const eligibleSessions: CompletedSession[] = [];
    for (const s of allSessions) {
      if (isLegacy(s)) results.skippedLegacySessions++;
      if (await isEligible(supabase, s)) {
        eligibleSessions.push(s);
      }
    }
    console.log(`[Compliance Monitor V2] ${eligibleSessions.length} eligible after filter`);

    // ========================================
    // Section 1: no_quiz (curriculum-aware, 24h grace)
    // ========================================
    try {
      for (const session of eligibleSessions) {
        if (checkCircuitBreaker()) break;
        if (!isPastGrace(session, GRACE_CFG, 'quiz')) continue;

        const expect = await getCurriculumExpectations(supabase, session.level_id, session.content_number);
        if (!expect || !expect.expectsQuiz) { results.warningsSkipped++; continue; }

        const recheck = async () => {
          const { data } = await supabase
            .from('quiz_assignments').select('id').eq('session_id', session.id).limit(1).maybeSingle();
          return !data;
        };

        const ctxEn = makeupCtx(session, false);
        const ctxAr = makeupCtx(session, true);
        const result = await insertWarningWithRecheck({
          supabase, session, warningType: 'no_quiz',
          reason: `No quiz assigned for Session ${session.session_number} (${session.groups.name})${ctxEn}`,
          reasonAr: `لم يتم تعيين كويز للسيشن ${session.session_number} (${session.groups.name_ar})${ctxAr}`,
          notifTitle: 'Warning: Missing Quiz', notifTitleAr: 'تحذير: كويز مفقود',
          notifMessage: `You didn't add a quiz for Session ${session.session_number} (${session.groups.name})${ctxEn}`,
          notifMessageAr: `لم تقم بإضافة كويز للسيشن ${session.session_number} (${session.groups.name_ar})${ctxAr}`,
          recheckCondition: recheck,
        }, { traceId: RUN_TRACE_ID, settingsVersion: SETTINGS_VERSION });

        if (result === 'inserted') results.instructorWarnings++;
        else if (result === 'race_resolved') results.raceResolved++;
        else if (result === 'duplicate') results.warningsSkipped++;
      }
    } catch (e: any) {
      results.errors.push(`Section 1 (no_quiz) error: ${e.message}`);
    }

    // ========================================
    // Section 2: no_attendance (60min grace)
    // Trigger when (present + absent) = 0 (gap #4)
    // ========================================
    try {
      if (!checkCircuitBreaker()) {
        for (const session of eligibleSessions) {
          if (checkCircuitBreaker()) break;
          if (!isPastGrace(session, GRACE_CFG, 'attendance')) continue;

          const { count: attendanceCount } = await supabase
            .from('attendance').select('*', { count: 'exact', head: true })
            .eq('session_id', session.id)
            .in('status', ['present', 'absent']);

          if ((attendanceCount || 0) > 0) continue;

          const recheck = async () => {
            const { count } = await supabase
              .from('attendance').select('*', { count: 'exact', head: true })
              .eq('session_id', session.id)
              .in('status', ['present', 'absent']);
            return (count || 0) === 0;
          };

          const ctxEn = makeupCtx(session, false);
          const ctxAr = makeupCtx(session, true);
          const result = await insertWarningWithRecheck({
            supabase, session, warningType: 'no_attendance',
            reason: `Attendance not recorded for Session ${session.session_number} (${session.groups.name})${ctxEn}`,
            reasonAr: `لم يتم تسجيل الحضور للسيشن ${session.session_number} (${session.groups.name_ar})${ctxAr}`,
            notifTitle: 'Warning: Missing Attendance', notifTitleAr: 'تحذير: حضور مفقود',
            notifMessage: `You didn't record attendance for Session ${session.session_number} (${session.groups.name})${ctxEn}`,
            notifMessageAr: `لم تقم بتسجيل الحضور للسيشن ${session.session_number} (${session.groups.name_ar})${ctxAr}`,
            recheckCondition: recheck,
          }, { traceId: RUN_TRACE_ID, settingsVersion: SETTINGS_VERSION });

          if (result === 'inserted') results.instructorWarnings++;
          else if (result === 'race_resolved') results.raceResolved++;
          else if (result === 'duplicate') results.warningsSkipped++;
        }
      }
    } catch (e: any) {
      results.errors.push(`Section 2 (no_attendance) error: ${e.message}`);
    }

    // ========================================
    // Section 3: no_assignment (curriculum-aware, 24h grace)
    // ========================================
    try {
      if (!checkCircuitBreaker()) {
        for (const session of eligibleSessions) {
          if (checkCircuitBreaker()) break;
          if (!isPastGrace(session, GRACE_CFG, 'assignment')) continue;

          const expect = await getCurriculumExpectations(supabase, session.level_id, session.content_number);
          if (!expect || !expect.expectsAssignment) { results.warningsSkipped++; continue; }

          const recheck = async () => {
            const { data } = await supabase
              .from('assignments').select('id').eq('session_id', session.id).limit(1).maybeSingle();
            return !data;
          };

          const ctxEn = makeupCtx(session, false);
          const ctxAr = makeupCtx(session, true);
          const result = await insertWarningWithRecheck({
            supabase, session, warningType: 'no_assignment',
            reason: `No assignment uploaded for Session ${session.session_number} within 24 hours (${session.groups.name})${ctxEn}`,
            reasonAr: `لم يتم رفع واجب للسيشن ${session.session_number} خلال 24 ساعة (${session.groups.name_ar})${ctxAr}`,
            notifTitle: 'Warning: Missing Assignment', notifTitleAr: 'تحذير: واجب مفقود',
            notifMessage: `You didn't upload an assignment for Session ${session.session_number} within 24 hours (${session.groups.name})${ctxEn}`,
            notifMessageAr: `لم تقم برفع واجب للسيشن ${session.session_number} خلال 24 ساعة (${session.groups.name_ar})${ctxAr}`,
            recheckCondition: recheck,
          }, { traceId: RUN_TRACE_ID, settingsVersion: SETTINGS_VERSION });

          if (result === 'inserted') results.instructorWarnings++;
          else if (result === 'race_resolved') results.raceResolved++;
          else if (result === 'duplicate') results.warningsSkipped++;
        }
      }
    } catch (e: any) {
      results.errors.push(`Section 3 (no_assignment) error: ${e.message}`);
    }

    // ========================================
    // Section 3b: no_evaluation (24h grace)
    // ========================================
    try {
      if (!checkCircuitBreaker()) {
        for (const session of eligibleSessions) {
          if (checkCircuitBreaker()) break;
          if (!isPastGrace(session, GRACE_CFG, 'evaluation')) continue;

          const { data: presentStudents } = await supabase
            .from('attendance').select('student_id').eq('session_id', session.id).eq('status', 'present');
          const presentSet = new Set((presentStudents || []).map((s: any) => s.student_id));
          if (presentSet.size === 0) continue;

          // Anomaly: makeup session with > 1 present student (idempotent via RPC)
          if (session.is_makeup && presentSet.size > 1) {
            try {
              await supabase.rpc('log_dq_issue', {
                p_issue_type: 'makeup_multi_student_anomaly',
                p_entity_table: 'sessions',
                p_entity_id: session.id,
                p_details: { count: presentSet.size, trace_id: RUN_TRACE_ID },
              });
            } catch (_) { /* non-fatal */ }
          }

          const { data: evaluatedStudents } = await supabase
            .from('session_evaluations').select('student_id').eq('session_id', session.id);
          const evalSet = new Set((evaluatedStudents || []).map((s: any) => s.student_id));
          const missing = [...presentSet].filter((id) => !evalSet.has(id));
          if (missing.length === 0) continue;

          const recheck = async () => {
            const { data: present2 } = await supabase
              .from('attendance').select('student_id').eq('session_id', session.id).eq('status', 'present');
            const p2 = new Set((present2 || []).map((s: any) => s.student_id));
            const { data: ev2 } = await supabase
              .from('session_evaluations').select('student_id').eq('session_id', session.id);
            const e2 = new Set((ev2 || []).map((s: any) => s.student_id));
            return [...p2].some((id) => !e2.has(id));
          };

          const missingCount = missing.length;
          const ctxEn = makeupCtx(session, false);
          const ctxAr = makeupCtx(session, true);
          const result = await insertWarningWithRecheck({
            supabase, session, warningType: 'no_evaluation',
            reason: `Missing evaluations for ${missingCount} student(s) in Session ${session.session_number} (${session.groups.name})${ctxEn}`,
            reasonAr: `تقييمات ناقصة لـ ${missingCount} طالب في السيشن ${session.session_number} (${session.groups.name_ar})${ctxAr}`,
            notifTitle: 'Warning: Missing Evaluations', notifTitleAr: 'تحذير: تقييمات ناقصة',
            notifMessage: `You didn't evaluate ${missingCount} student(s) for Session ${session.session_number} (${session.groups.name})${ctxEn}`,
            notifMessageAr: `لم تقم بتقييم ${missingCount} طالب للسيشن ${session.session_number} (${session.groups.name_ar})${ctxAr}`,
            recheckCondition: recheck,
          }, { traceId: RUN_TRACE_ID, settingsVersion: SETTINGS_VERSION });

          if (result === 'inserted') results.instructorWarnings++;
          else if (result === 'race_resolved') results.raceResolved++;
          else if (result === 'duplicate') results.warningsSkipped++;
        }
      }
    } catch (e: any) {
      results.errors.push(`Section 3b (no_evaluation) error: ${e.message}`);
    }

    // Mark all scanned sessions to enforce cooldown
    try {
      await markScanned(supabase, eligibleSessions.map(s => s.id));
    } catch (e: any) {
      results.errors.push(`markScanned error: ${e.message}`);
    }

    // ========================================
    // Section 4: Student deadline warnings (unchanged behavior)
    // ========================================
    try {
      if (!checkCircuitBreaker()) {
        const { data: expiredAssignments, error: deadlineError } = await supabase
          .from('assignments').select(`id, title, title_ar, due_date, group_id, student_id, session_id, attachment_url`)
          .lt('due_date', now.toISOString()).eq('is_active', true)
          .not('attachment_url', 'is', null);

        if (deadlineError) {
          results.errors.push(`Deadline check error: ${deadlineError.message}`);
        } else if (expiredAssignments) {
          for (const assignment of expiredAssignments) {
            if (checkCircuitBreaker()) break;

            if (assignment.session_id) {
              const { data: sessionData } = await supabase
                .from('sessions').select(`session_number, groups!inner(starting_session_number)`)
                .eq('id', assignment.session_id).maybeSingle();
              if (sessionData) {
                const startingNum = (sessionData.groups as any)?.starting_session_number || 1;
                if (startingNum > 1 && sessionData.session_number < startingNum) continue;
              }
            }

            let studentIds: string[] = [];
            if (assignment.student_id) {
              studentIds = [assignment.student_id];
            } else if (assignment.group_id) {
              const { data: groupStudents } = await supabase
                .from('group_students').select('student_id').eq('group_id', assignment.group_id).eq('is_active', true);
              studentIds = (groupStudents || []).map(gs => gs.student_id);
            }

            for (const studentId of studentIds) {
              if (checkCircuitBreaker()) break;
              const { data: submission } = await supabase
                .from('assignment_submissions').select('id').eq('assignment_id', assignment.id).eq('student_id', studentId).maybeSingle();

              if (!submission) {
                const { data: existingWarning } = await supabase
                  .from('warnings').select('id').eq('student_id', studentId).eq('assignment_id', assignment.id)
                  .eq('warning_type', 'deadline').eq('is_active', true).maybeSingle();

                if (!existingWarning) {
                  let issuedBy: string | null = null;
                  if (assignment.group_id) {
                    const { data: group } = await supabase.from('groups').select('instructor_id').eq('id', assignment.group_id).maybeSingle();
                    issuedBy = group?.instructor_id;
                  }
                  const { error: insertError } = await supabase.from('warnings').insert({
                    student_id: studentId, assignment_id: assignment.id,
                    issued_by: issuedBy || studentId, warning_type: 'deadline',
                    reason: `Assignment deadline missed: ${assignment.title}`,
                    reason_ar: `فات موعد تسليم الواجب: ${assignment.title_ar}`,
                  });
                  if (!insertError) {
                    results.studentWarnings++;
                    await supabase.from('notifications').insert({
                      user_id: studentId,
                      title: 'Warning: Missed Deadline', title_ar: 'تحذير: فات موعد التسليم',
                      message: `You missed the deadline for assignment: ${assignment.title}`,
                      message_ar: `فاتك موعد تسليم الواجب: ${assignment.title_ar}`,
                      type: 'warning', category: 'compliance', action_url: `/assignments`,
                    });
                  }
                }
              }
            }
          }
        }
      }
    } catch (e: any) {
      results.errors.push(`Section 4 error: ${e.message}`);
    }

    // ========================================
    // MODULE A: SLA workload precompute (unchanged)
    // ========================================
    const instructorWorkloadMap = new Map<string, number>();
    const instructorSLAMap = new Map<string, number>();

    try {
      if (!checkCircuitBreaker()) {
        const { data: instructorGroups } = await supabase
          .from('groups').select('instructor_id').eq('is_active', true).not('instructor_id', 'is', null);

        const instructorIds = [...new Set((instructorGroups || []).map(g => g.instructor_id).filter(Boolean))];

        for (const instructorId of instructorIds) {
          const { data: instrGroups } = await supabase
            .from('groups').select('id').eq('instructor_id', instructorId).eq('is_active', true);
          const groupIds = (instrGroups || []).map(g => g.id);

          let studentCount = 0;
          if (groupIds.length > 0) {
            const { count: sc } = await supabase
              .from('group_students').select('*', { count: 'exact', head: true })
              .in('group_id', groupIds).eq('is_active', true);
            studentCount = sc || 0;
          }

          instructorWorkloadMap.set(instructorId, studentCount);

          let slaHours = 48;
          if (studentCount > 30) slaHours = 96;
          else if (studentCount >= 20) slaHours = 72;
          instructorSLAMap.set(instructorId, slaHours);
        }
      }
    } catch (e: any) {
      results.errors.push(`Workload precompute error: ${e.message}`);
    }

    // ========================================
    // Section 5: Message SLA Monitoring (unchanged)
    // ========================================
    try {
      if (!checkCircuitBreaker()) {
        const { data: instructorRoles } = await supabase
          .from('user_roles').select('user_id').eq('role', 'instructor');
        const instructorUserIds = (instructorRoles || []).map(r => r.user_id);

        const { data: studentRoles } = await supabase
          .from('user_roles').select('user_id').eq('role', 'student');
        const studentUserIds = new Set((studentRoles || []).map(r => r.user_id));

        if (instructorUserIds.length > 0) {
          const { data: instructorParticipations } = await supabase
            .from('conversation_participants').select('conversation_id, user_id')
            .in('user_id', instructorUserIds);

          const convInstructorMap = new Map<string, string>();
          for (const p of (instructorParticipations || [])) {
            convInstructorMap.set(p.conversation_id, p.user_id);
          }

          for (const [convId, instructorId] of convInstructorMap) {
            if (checkCircuitBreaker()) break;

            const slaHours = instructorSLAMap.get(instructorId) || 48;

            const { data: latestMessages } = await supabase
              .from('messages').select('sender_id, created_at')
              .eq('conversation_id', convId).is('deleted_at', null)
              .order('created_at', { ascending: false }).limit(1);

            if (!latestMessages || latestMessages.length === 0) continue;

            const lastMsg = latestMessages[0];
            if (lastMsg.sender_id === instructorId) continue;
            if (!studentUserIds.has(lastMsg.sender_id)) continue;

            const msgTime = new Date(lastMsg.created_at).getTime();
            const hoursSince = (now.getTime() - msgTime) / (1000 * 60 * 60);

            if (hoursSince < slaHours / 2) continue;

            const { data: recentReminder } = await supabase
              .from('performance_events').select('id')
              .eq('instructor_id', instructorId).eq('event_type', 'reminder_sent')
              .eq('reference_id', convId).gte('created_at', new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString())
              .limit(1).maybeSingle();

            if (hoursSince >= slaHours) {
              const overHours = hoursSince - slaHours;
              let severity = 'minor';
              if (overHours > 72) severity = 'critical';
              else if (overHours > 24) severity = 'major';

              if (severity === 'critical') {
                const { data: existingCritical } = await supabase
                  .from('instructor_warnings').select('id')
                  .eq('instructor_id', instructorId).eq('warning_type', 'no_reply')
                  .eq('severity', 'critical').eq('is_active', true)
                  .gte('created_at', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())
                  .limit(1).maybeSingle();

                if (existingCritical) {
                  await supabase.from('performance_events').insert({
                    instructor_id: instructorId, event_type: 'escalation_event',
                    reference_id: convId, reference_type: 'conversation',
                    details: { warning_type: 'no_reply', severity: 'critical', hours_overdue: Math.round(hoursSince) },
                  });
                  continue;
                }
              }

              const { data: existingWarning } = await supabase
                .from('instructor_warnings').select('id')
                .eq('instructor_id', instructorId).eq('warning_type', 'no_reply')
                .eq('reference_id', convId).eq('is_active', true).limit(1).maybeSingle();

              if (!existingWarning) {
                await supabase.from('instructor_warnings').insert({
                  instructor_id: instructorId, warning_type: 'no_reply', severity,
                  reference_id: convId, reference_type: 'conversation',
                  reason: `No reply to student message for ${Math.round(hoursSince)} hours`,
                  reason_ar: `لم يتم الرد على رسالة الطالب منذ ${Math.round(hoursSince)} ساعة`,
                });
                results.slaWarnings++;
              }
            } else if (!recentReminder) {
              await supabase.from('notifications').insert({
                user_id: instructorId, type: 'info', category: 'compliance',
                title: 'Reminder: Pending Student Message', title_ar: 'تذكير: رسالة طالب بانتظار الرد',
                message: `You have an unanswered student message for ${Math.round(hoursSince)} hours. SLA: ${slaHours}h`,
                message_ar: `لديك رسالة طالب بدون رد منذ ${Math.round(hoursSince)} ساعة. المهلة: ${slaHours} ساعة`,
                action_url: '/messages',
              });
              await supabase.from('performance_events').insert({
                instructor_id: instructorId, event_type: 'reminder_sent',
                reference_id: convId, reference_type: 'conversation',
                details: { hours_since: Math.round(hoursSince), sla_hours: slaHours },
              });
              results.slaReminders++;
            }
          }
        }
      }
    } catch (e: any) {
      results.errors.push(`Section 5 (Message SLA) error: ${e.message}`);
    }

    // ========================================
    // Section 6: Grading SLA Monitoring (unchanged)
    // ========================================
    try {
      if (!checkCircuitBreaker()) {
        const { data: pendingSubmissions } = await supabase
          .from('assignment_submissions').select(`id, assignment_id, submitted_at, assignments!inner(assigned_by, group_id, groups(instructor_id))`)
          .eq('status', 'submitted');

        if (pendingSubmissions) {
          for (const sub of pendingSubmissions as any[]) {
            if (checkCircuitBreaker()) break;

            const instructorId = sub.assignments?.groups?.instructor_id || sub.assignments?.assigned_by;
            if (!instructorId) continue;

            const slaHours = instructorSLAMap.get(instructorId) || 48;
            const submittedTime = new Date(sub.submitted_at).getTime();
            const hoursSince = (now.getTime() - submittedTime) / (1000 * 60 * 60);

            if (hoursSince < slaHours / 2) continue;

            const { data: recentReminder } = await supabase
              .from('performance_events').select('id')
              .eq('instructor_id', instructorId).eq('event_type', 'reminder_sent')
              .eq('reference_id', sub.id).gte('created_at', new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString())
              .limit(1).maybeSingle();

            if (hoursSince >= slaHours) {
              const overHours = hoursSince - slaHours;
              let severity = 'minor';
              if (overHours > 72) severity = 'critical';
              else if (overHours > 24) severity = 'major';

              if (severity === 'critical') {
                const { data: existingCritical } = await supabase
                  .from('instructor_warnings').select('id')
                  .eq('instructor_id', instructorId).eq('warning_type', 'late_grading')
                  .eq('severity', 'critical').eq('is_active', true)
                  .gte('created_at', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())
                  .limit(1).maybeSingle();

                if (existingCritical) {
                  await supabase.from('performance_events').insert({
                    instructor_id: instructorId, event_type: 'escalation_event',
                    reference_id: sub.id, reference_type: 'submission',
                    details: { warning_type: 'late_grading', severity: 'critical', hours_overdue: Math.round(hoursSince) },
                  });
                  continue;
                }
              }

              const { data: existingWarning } = await supabase
                .from('instructor_warnings').select('id')
                .eq('instructor_id', instructorId).eq('warning_type', 'late_grading')
                .eq('reference_id', sub.id).eq('is_active', true).limit(1).maybeSingle();

              if (!existingWarning) {
                await supabase.from('instructor_warnings').insert({
                  instructor_id: instructorId, warning_type: 'late_grading', severity,
                  reference_id: sub.id, reference_type: 'submission',
                  reason: `Assignment submission not graded for ${Math.round(hoursSince)} hours`,
                  reason_ar: `لم يتم تقييم تسليم الواجب منذ ${Math.round(hoursSince)} ساعة`,
                });
                results.slaWarnings++;
              }
            } else if (!recentReminder) {
              await supabase.from('notifications').insert({
                user_id: instructorId, type: 'info', category: 'compliance',
                title: 'Reminder: Pending Grading', title_ar: 'تذكير: تقييم بانتظار المراجعة',
                message: `You have an ungraded submission for ${Math.round(hoursSince)} hours. SLA: ${slaHours}h`,
                message_ar: `لديك تسليم بدون تقييم منذ ${Math.round(hoursSince)} ساعة. المهلة: ${slaHours} ساعة`,
                action_url: '/assignments',
              });
              await supabase.from('performance_events').insert({
                instructor_id: instructorId, event_type: 'reminder_sent',
                reference_id: sub.id, reference_type: 'submission',
                details: { hours_since: Math.round(hoursSince), sla_hours: slaHours },
              });
              results.slaReminders++;
            }
          }
        }
      }
    } catch (e: any) {
      results.errors.push(`Section 6 (Grading SLA) error: ${e.message}`);
    }

    // ========================================
    // MODULE B: Metrics Engine (unchanged)
    // ========================================
    try {
      if (!checkCircuitBreaker()) {
        const { data: instructorRoles } = await supabase
          .from('user_roles').select('user_id').eq('role', 'instructor');

        for (const role of (instructorRoles || [])) {
          if (checkCircuitBreaker()) break;
          const instructorId = role.user_id;

          const { count: warningCount } = await supabase
            .from('instructor_warnings').select('*', { count: 'exact', head: true })
            .eq('instructor_id', instructorId).eq('is_active', true)
            .gte('created_at', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());

          const { count: reminderCount } = await supabase
            .from('performance_events').select('*', { count: 'exact', head: true })
            .eq('instructor_id', instructorId).eq('event_type', 'reminder_sent')
            .gte('created_at', currentMonth);

          const totalStudents = instructorWorkloadMap.get(instructorId) || 0;

          const { count: groupCount } = await supabase
            .from('groups').select('*', { count: 'exact', head: true })
            .eq('instructor_id', instructorId).eq('is_active', true);

          const avgReply = 0;
          const avgGrading = 0;

          const { data: scoreResult } = await supabase.rpc('compute_quality_score', {
            p_warnings: warningCount || 0,
            p_reminders: reminderCount || 0,
            p_avg_reply: avgReply,
            p_avg_grading: avgGrading,
            p_total_students: totalStudents,
          });

          let qualityScore = scoreResult || 100;

          const threeMonthsAgo = new Date(now);
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
          const { count: recentWarnings } = await supabase
            .from('instructor_warnings').select('*', { count: 'exact', head: true })
            .eq('instructor_id', instructorId).eq('is_active', true)
            .gte('created_at', threeMonthsAgo.toISOString());

          if ((recentWarnings || 0) === 0) {
            qualityScore = Math.min(100, qualityScore + 5);
          }

          await supabase.from('instructor_performance_metrics').upsert({
            instructor_id: instructorId,
            month: currentMonth,
            avg_reply_time_hours: avgReply,
            avg_grading_time_hours: avgGrading,
            total_warnings: warningCount || 0,
            total_reminders: reminderCount || 0,
            total_students: totalStudents,
            total_groups: groupCount || 0,
            quality_score: qualityScore,
            updated_at: now.toISOString(),
          }, { onConflict: 'instructor_id,month' });

          results.metricsUpdated++;
        }
      }
    } catch (e: any) {
      results.errors.push(`Section 7 (Metrics) error: ${e.message}`);
    }

    // ========================================
    // MODULE C: Incentive Engine (unchanged)
    // ========================================
    try {
      if (!checkCircuitBreaker()) {
        const tomorrowCairo = getCairoDatePlusDays(1);
        const isLastDayOfMonth = tomorrowCairo.endsWith('-01');

        if (isLastDayOfMonth) {
          const { data: instructorRoles } = await supabase
            .from('user_roles').select('user_id').eq('role', 'instructor');

          for (const role of (instructorRoles || [])) {
            if (checkCircuitBreaker()) break;
            const instructorId = role.user_id;

            const { count: noReplyCount } = await supabase
              .from('instructor_warnings').select('*', { count: 'exact', head: true })
              .eq('instructor_id', instructorId).eq('is_active', true)
              .in('warning_type', ['no_reply', 'late_grading'])
              .gte('created_at', currentMonth);

            if ((noReplyCount || 0) === 0) {
              const { data: existingRec } = await supabase
                .from('performance_events').select('id')
                .eq('instructor_id', instructorId).eq('event_type', 'bonus_recommended')
                .gte('created_at', currentMonth).limit(1).maybeSingle();

              if (!existingRec) {
                const { data: metrics } = await supabase
                  .from('instructor_performance_metrics').select('quality_score, total_students, total_groups')
                  .eq('instructor_id', instructorId).eq('month', currentMonth).maybeSingle();

                const { data: profile } = await supabase
                  .from('profiles').select('full_name, full_name_ar').eq('user_id', instructorId).maybeSingle();

                await supabase.from('performance_events').insert({
                  instructor_id: instructorId, event_type: 'bonus_recommended',
                  details: {
                    month: currentMonth,
                    quality_score: metrics?.quality_score || 100,
                    total_students: metrics?.total_students || 0,
                    instructor_name: profile?.full_name,
                    instructor_name_ar: profile?.full_name_ar,
                  },
                });

                const { data: admins } = await supabase
                  .from('user_roles').select('user_id').eq('role', 'admin');

                for (const admin of (admins || [])) {
                  await supabase.from('notifications').insert({
                    user_id: admin.user_id, type: 'info', category: 'compliance',
                    title: 'Bonus Recommendation', title_ar: 'توصية مكافأة',
                    message: `${profile?.full_name || 'Instructor'} achieved 0 SLA violations this month. Consider a bonus.`,
                    message_ar: `${profile?.full_name_ar || 'المدرب'} حقق 0 مخالفات SLA هذا الشهر. يُنصح بمكافأة.`,
                    action_url: '/instructor-performance',
                  });
                }

                results.bonusRecommendations++;
              }
            }
          }
        }
      }
    } catch (e: any) {
      results.errors.push(`Section 8 (Incentive) error: ${e.message}`);
    }

    // ========================================
    // Exam SLA Timeout (unchanged)
    // ========================================
    try {
      if (!checkCircuitBreaker()) {
        const { data: slaResult, error: slaError } = await supabase.rpc('check_exam_sla_timeouts');
        if (slaError) {
          results.errors.push(`Section 9a (Exam SLA) error: ${slaError.message}`);
        } else {
          console.log(`[Compliance Monitor V2] Exam SLA: ${JSON.stringify(slaResult)}`);
        }
      }
    } catch (e: any) {
      results.errors.push(`Section 9a (Exam SLA) error: ${e.message}`);
    }

    // ========================================
    // System Health (unchanged)
    // ========================================
    try {
      const executionTimeMs = Date.now() - startTime;
      await supabase.from('system_health_metrics').upsert({
        date: todayStr,
        total_reminders: results.slaReminders,
        total_warnings: results.instructorWarnings + results.slaWarnings,
        total_deductions: 0,
        avg_execution_time_ms: executionTimeMs,
        errors_count: results.errors.length,
      }, { onConflict: 'date' });
    } catch (e: any) {
      results.errors.push(`Section 9 (Health) error: ${e.message}`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Compliance Monitor V2] Complete in ${totalTime}ms. Scanned: ${results.sessionsScanned}, Warnings: ${results.instructorWarnings + results.slaWarnings}, Skipped: ${results.warningsSkipped}, RaceResolved: ${results.raceResolved}, AvgScanLag: ${results.avgScanLagSeconds}s, Errors: ${results.errors.length}`);

    console.log(JSON.stringify({
      event: 'compliance_run_finished',
      trace_id: RUN_TRACE_ID,
      settings_version: SETTINGS_VERSION,
      sessions_scanned: results.sessionsScanned,
      warnings_created: results.instructorWarnings + results.slaWarnings,
      duplicates: results.warningsSkipped,
      race_resolved: results.raceResolved,
      duration_ms: totalTime,
      errors_count: results.errors.length,
    }));

    // Finalize scan run record
    if (scanRunId) {
      await supabase.from('compliance_scan_runs').update({
        finished_at: new Date().toISOString(),
        execution_time_ms: totalTime,
        sessions_scanned: results.sessionsScanned,
        warnings_created: results.instructorWarnings + results.slaWarnings,
        warnings_skipped: results.warningsSkipped + results.raceResolved,
        warnings_auto_resolved: results.autoResolved,
        avg_scan_lag_seconds: results.avgScanLagSeconds,
        errors: results.errors,
        metadata: {
          trace_id: RUN_TRACE_ID,
          settings_version: SETTINGS_VERSION,
          studentWarnings: results.studentWarnings,
          slaReminders: results.slaReminders,
          metricsUpdated: results.metricsUpdated,
          bonusRecommendations: results.bonusRecommendations,
          circuitBreakerTriggered: results.circuitBreakerTriggered,
          skippedLegacySessions: results.skippedLegacySessions,
        },
      }).eq('id', scanRunId);
    }

    return new Response(
      JSON.stringify({ success: true, timestamp: now.toISOString(), execution_ms: totalTime, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    console.error('Compliance monitor error:', error);
    if (scanRunId) {
      await supabase.from('compliance_scan_runs').update({
        finished_at: new Date().toISOString(),
        execution_time_ms: Date.now() - startTime,
        errors: [{ message: (error as any)?.message ?? 'Internal error' }],
      }).eq('id', scanRunId);
    }
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
