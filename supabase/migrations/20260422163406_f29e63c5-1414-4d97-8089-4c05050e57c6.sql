-- Enrich email_event_catalog.available_variables with type/sample/required fields.
-- This is an in-place JSON update on each variable entry. Existing key/label_ar/label_en preserved.
-- Heuristics:
--   * date keys (Date, date, deadline, paidAt, expires*, expired*, startDate) -> type='date'
--   * numeric keys (amount, score, rating, *Count, *Rate, *Minutes, *Hours) -> type='number'
--   * url keys (*Link) -> type='url'
--   * default -> type='text'
-- 'sample' generated from label_en when not present. 'required' defaults to false.

CREATE OR REPLACE FUNCTION public._enrich_event_variable(v jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  k text := v->>'key';
  inferred_type text;
  inferred_sample text;
  label_en text := COALESCE(v->>'label_en', k);
BEGIN
  -- type inference
  IF k ~* '(date|deadline|paidAt|expiresOn|expiredOn|startDate|fromDate|toDate|originalDate)$'
     OR k IN ('date','deadline','paidAt','expiresOn','expiredOn','startDate','dueDate','sessionDate','newDate','oldDate','newDateTime','oldDateTime','newDeadline','oldDeadline','makeupDate','originalDate','fromDate','toDate') THEN
    inferred_type := 'date';
    inferred_sample := '2026-04-25';
  ELSIF k ~* '(Count|Rate|Minutes|Hours|amount|score|rating|paymentsTotal|breachHours|delayMinutes|hoursLeft|daysOverdue|sessionsCount|studentsCount|pendingCount|ungradedCount|absenceRate|attendanceRate|avgRating|cached|computed|diff|difference)' THEN
    inferred_type := 'number';
    inferred_sample := CASE
      WHEN k ILIKE '%amount%' OR k ILIKE '%total%' THEN '500'
      WHEN k ILIKE '%rate%' THEN '85'
      WHEN k ILIKE '%hours%' OR k ILIKE '%minutes%' THEN '15'
      ELSE '10'
    END;
  ELSIF k ILIKE '%link%' THEN
    inferred_type := 'url';
    inferred_sample := 'https://kojobot.com/' || k;
  ELSE
    inferred_type := 'text';
    inferred_sample := '[' || label_en || ']';
  END IF;

  RETURN v
    || jsonb_build_object(
         'type', COALESCE(v->>'type', inferred_type),
         'sample', COALESCE(v->>'sample', inferred_sample),
         'required', COALESCE((v->>'required')::boolean, false)
       );
END;
$$;

UPDATE public.email_event_catalog
SET available_variables = (
  SELECT COALESCE(jsonb_agg(public._enrich_event_variable(v)), '[]'::jsonb)
  FROM jsonb_array_elements(available_variables) v
)
WHERE jsonb_typeof(available_variables) = 'array'
  AND jsonb_array_length(available_variables) > 0;

DROP FUNCTION public._enrich_event_variable(jsonb);
