
-- RPC: Search parents by name or phone
CREATE OR REPLACE FUNCTION public.search_parents(p_query text)
RETURNS TABLE (
  id uuid,
  full_name text,
  full_name_ar text,
  phone text,
  email text,
  children_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id AS id,
    p.full_name,
    p.full_name_ar,
    p.phone,
    p.email,
    (SELECT count(*) FROM parent_students ps WHERE ps.parent_id = p.user_id) AS children_count
  FROM profiles p
  INNER JOIN user_roles ur ON ur.user_id = p.user_id AND ur.role = 'parent'
  WHERE
    p.full_name ILIKE '%' || p_query || '%'
    OR p.full_name_ar ILIKE '%' || p_query || '%'
    OR p.phone ILIKE '%' || p_query || '%'
    OR p.email ILIKE '%' || p_query || '%'
  ORDER BY p.full_name
  LIMIT 20;
$$;

-- RPC: Check sibling discount for a student
CREATE OR REPLACE FUNCTION public.check_sibling_discount(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id uuid;
  v_sibling_names text[];
  v_discount_pct numeric;
  v_enabled boolean;
BEGIN
  -- Find parent of this student
  SELECT ps.parent_id INTO v_parent_id
  FROM parent_students ps
  WHERE ps.student_id = p_student_id
  LIMIT 1;

  IF v_parent_id IS NULL THEN
    RETURN jsonb_build_object('has_siblings', false, 'discount_percentage', 0, 'sibling_names', '[]'::jsonb);
  END IF;

  -- Get sibling discount settings
  SELECT
    COALESCE((value->>'enabled')::boolean, false),
    COALESCE((value->>'percentage')::numeric, 10)
  INTO v_enabled, v_discount_pct
  FROM system_settings
  WHERE key = 'sibling_discount';

  IF NOT FOUND OR NOT v_enabled THEN
    RETURN jsonb_build_object('has_siblings', false, 'discount_percentage', 0, 'sibling_names', '[]'::jsonb);
  END IF;

  -- Find siblings with active subscriptions
  SELECT array_agg(pr.full_name)
  INTO v_sibling_names
  FROM parent_students sib
  INNER JOIN profiles pr ON pr.user_id = sib.student_id
  INNER JOIN subscriptions sub ON sub.student_id = sib.student_id AND sub.status = 'active'
  WHERE sib.parent_id = v_parent_id
    AND sib.student_id != p_student_id;

  IF v_sibling_names IS NULL OR array_length(v_sibling_names, 1) IS NULL THEN
    RETURN jsonb_build_object('has_siblings', false, 'discount_percentage', 0, 'sibling_names', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'has_siblings', true,
    'discount_percentage', v_discount_pct,
    'sibling_names', to_jsonb(v_sibling_names)
  );
END;
$$;

-- Add sibling_discount setting
INSERT INTO system_settings (key, value, updated_by)
VALUES (
  'sibling_discount',
  '{"enabled": false, "percentage": 10}'::jsonb,
  (SELECT user_id FROM user_roles WHERE role = 'admin' LIMIT 1)
)
ON CONFLICT (key) DO NOTHING;
