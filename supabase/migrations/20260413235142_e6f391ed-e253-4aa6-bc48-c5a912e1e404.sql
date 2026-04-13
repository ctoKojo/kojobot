
-- Create testimonials table
CREATE TABLE public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid,
  parent_name text NOT NULL,
  parent_name_ar text,
  content_en text,
  content_ar text,
  rating int NOT NULL DEFAULT 5,
  is_approved boolean DEFAULT false,
  show_on_landing boolean DEFAULT false,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add constraint via trigger instead of CHECK for rating
CREATE OR REPLACE FUNCTION public.validate_testimonial_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_testimonial_rating
BEFORE INSERT OR UPDATE ON public.testimonials
FOR EACH ROW EXECUTE FUNCTION public.validate_testimonial_rating();

-- Enable RLS
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- Public can read approved testimonials shown on landing
CREATE POLICY "Public can view approved landing testimonials"
ON public.testimonials FOR SELECT
USING (is_approved = true AND show_on_landing = true);

-- Admins full CRUD
CREATE POLICY "Admins can manage testimonials"
ON public.testimonials FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update get_landing_content to include testimonials
CREATE OR REPLACE FUNCTION public.get_landing_content()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_settings jsonb;
  v_features jsonb;
  v_plans jsonb;
  v_track_groups jsonb;
  v_testimonials jsonb;
BEGIN
  SELECT to_jsonb(s.*) INTO v_settings FROM landing_settings s LIMIT 1;

  SELECT COALESCE(jsonb_agg(to_jsonb(f.*) ORDER BY f.sort_order), '[]'::jsonb)
  INTO v_features
  FROM landing_features f WHERE f.is_active = true;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id, 'name_en', p.name_en, 'name_ar', p.name_ar,
      'description_en', p.description_en, 'description_ar', p.description_ar,
      'price_number', p.price_number, 'price_currency', p.price_currency,
      'price_before_discount', p.price_before_discount,
      'price_online', p.price_online,
      'price_online_before_discount', p.price_online_before_discount,
      'billing_period_en', p.billing_period_en, 'billing_period_ar', p.billing_period_ar,
      'is_featured', p.is_featured, 'sort_order', p.sort_order,
      'mode', p.mode, 'slug', p.slug,
      'sessions_per_month', p.sessions_per_month,
      'session_duration_minutes', p.session_duration_minutes,
      'max_students', p.max_students,
      'benefits', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', b.id, 'text_en', b.text_en, 'text_ar', b.text_ar, 'sort_order', b.sort_order
        ) ORDER BY b.sort_order)
        FROM landing_plan_benefits b WHERE b.plan_id = p.id
      ), '[]'::jsonb)
    ) ORDER BY p.sort_order
  ), '[]'::jsonb)
  INTO v_plans
  FROM landing_plans p WHERE p.is_active = true;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', g.id, 'title_en', g.title_en, 'title_ar', g.title_ar,
      'intro_en', g.intro_en, 'intro_ar', g.intro_ar,
      'age_group', g.age_group, 'sort_order', g.sort_order,
      'steps', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', s.id, 'step_number', s.step_number,
          'title_en', s.title_en, 'title_ar', s.title_ar,
          'desc_en', s.desc_en, 'desc_ar', s.desc_ar,
          'path_type', s.path_type,
          'specializations', s.specializations
        ) ORDER BY s.step_number)
        FROM landing_track_steps s WHERE s.group_id = g.id
      ), '[]'::jsonb)
    ) ORDER BY g.sort_order
  ), '[]'::jsonb)
  INTO v_track_groups
  FROM landing_track_groups g;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', t.id, 'parent_name', t.parent_name, 'parent_name_ar', t.parent_name_ar,
      'content_en', t.content_en, 'content_ar', t.content_ar,
      'rating', t.rating, 'sort_order', t.sort_order
    ) ORDER BY t.sort_order
  ), '[]'::jsonb)
  INTO v_testimonials
  FROM testimonials t WHERE t.is_approved = true AND t.show_on_landing = true;

  result := jsonb_build_object(
    'settings', v_settings,
    'features', v_features,
    'plans', v_plans,
    'track_groups', v_track_groups,
    'testimonials', v_testimonials
  );

  RETURN result;
END;
$$;
