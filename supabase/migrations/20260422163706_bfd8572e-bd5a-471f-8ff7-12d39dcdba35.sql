-- Backfill email_event_catalog.preview_data from available_variables[].sample
-- Only fills MISSING keys; existing preview_data values are preserved.

UPDATE public.email_event_catalog AS c
SET preview_data = COALESCE(c.preview_data, '{}'::jsonb) || (
  SELECT COALESCE(
    jsonb_object_agg(v->>'key', v->>'sample')
      FILTER (
        WHERE v->>'sample' IS NOT NULL
          AND NOT COALESCE(c.preview_data, '{}'::jsonb) ? (v->>'key')
      ),
    '{}'::jsonb
  )
  FROM jsonb_array_elements(c.available_variables) v
)
WHERE jsonb_typeof(c.available_variables) = 'array'
  AND jsonb_array_length(c.available_variables) > 0;
