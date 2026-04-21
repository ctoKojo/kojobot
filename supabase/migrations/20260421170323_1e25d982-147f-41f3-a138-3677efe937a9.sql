-- Update existing no_attendance warnings to new simplified phrasing
-- For makeup sessions: include student name + date
-- For regular sessions: keep "Session N (group_name)" simplified phrasing

WITH warning_data AS (
  SELECT
    iw.id AS warning_id,
    s.is_makeup,
    s.session_number,
    s.session_date,
    g.name AS group_name,
    g.name_ar AS group_name_ar,
    p.full_name AS student_name,
    COALESCE(p.full_name_ar, p.full_name) AS student_name_ar
  FROM public.instructor_warnings iw
  JOIN public.sessions s ON s.id = iw.session_id
  JOIN public.groups g ON g.id = s.group_id
  LEFT JOIN public.makeup_sessions ms ON ms.id = s.makeup_session_id
  LEFT JOIN public.profiles p ON p.user_id = ms.student_id
  WHERE iw.warning_type = 'no_attendance'
    AND iw.session_id IS NOT NULL
)
UPDATE public.instructor_warnings iw
SET
  reason = CASE
    WHEN wd.is_makeup AND wd.student_name IS NOT NULL THEN
      'Attendance not recorded for ' || wd.student_name || ' (makeup session on ' || wd.session_date::text || ')'
    ELSE
      'Attendance not recorded for Session ' || wd.session_number::text || ' (' || wd.group_name || ')'
  END,
  reason_ar = CASE
    WHEN wd.is_makeup AND wd.student_name_ar IS NOT NULL THEN
      'لم يتم تسجيل حضور الطالب ' || wd.student_name_ar || ' (سيشن تعويضية يوم ' || wd.session_date::text || ')'
    ELSE
      'لم يتم تسجيل الحضور للسيشن ' || wd.session_number::text || ' (' || wd.group_name_ar || ')'
  END,
  updated_at = now()
FROM warning_data wd
WHERE iw.id = wd.warning_id;