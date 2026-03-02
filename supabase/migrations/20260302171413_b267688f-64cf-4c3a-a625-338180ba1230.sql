
-- ============================================
-- Landing Page CMS Tables
-- ============================================

-- 1. landing_settings (single row, fixed UUID)
CREATE TABLE public.landing_settings (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  hero_title_ar TEXT NOT NULL DEFAULT '',
  hero_title_en TEXT NOT NULL DEFAULT '',
  hero_subtitle_ar TEXT NOT NULL DEFAULT '',
  hero_subtitle_en TEXT NOT NULL DEFAULT '',
  cta_text_ar TEXT NOT NULL DEFAULT 'تسجيل الدخول',
  cta_text_en TEXT NOT NULL DEFAULT 'Login',
  cta_url TEXT NOT NULL DEFAULT '/auth',
  footer_text_ar TEXT NOT NULL DEFAULT '',
  footer_text_en TEXT NOT NULL DEFAULT '',
  whatsapp TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address_ar TEXT DEFAULT '',
  address_en TEXT DEFAULT '',
  social_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  logo_url TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read landing_settings"
  ON public.landing_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can update landing_settings"
  ON public.landing_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert landing_settings"
  ON public.landing_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. landing_features
CREATE TABLE public.landing_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  icon_name TEXT NOT NULL DEFAULT 'Star',
  title_ar TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  desc_ar TEXT NOT NULL DEFAULT '',
  desc_en TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read landing_features"
  ON public.landing_features FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can manage landing_features"
  ON public.landing_features FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. landing_plans
CREATE TABLE public.landing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  mode TEXT NOT NULL DEFAULT 'offline' CHECK (mode IN ('online', 'offline')),
  name_ar TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  description_ar TEXT DEFAULT '',
  description_en TEXT DEFAULT '',
  price_number NUMERIC NOT NULL DEFAULT 0 CHECK (price_number >= 0),
  price_currency TEXT NOT NULL DEFAULT 'EGP',
  billing_period_ar TEXT NOT NULL DEFAULT '',
  billing_period_en TEXT NOT NULL DEFAULT '',
  max_students INTEGER DEFAULT NULL,
  session_duration_minutes INTEGER DEFAULT NULL,
  sessions_per_month INTEGER DEFAULT NULL,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read landing_plans"
  ON public.landing_plans FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can manage landing_plans"
  ON public.landing_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. landing_plan_benefits
CREATE TABLE public.landing_plan_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.landing_plans(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  text_ar TEXT NOT NULL DEFAULT '',
  text_en TEXT NOT NULL DEFAULT ''
);

ALTER TABLE public.landing_plan_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read landing_plan_benefits"
  ON public.landing_plan_benefits FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can manage landing_plan_benefits"
  ON public.landing_plan_benefits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. landing_track_groups
CREATE TABLE public.landing_track_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  age_group TEXT NOT NULL CHECK (age_group IN ('6_9', '10_13', '14_18')),
  title_ar TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  intro_ar TEXT NOT NULL DEFAULT '',
  intro_en TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.landing_track_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read landing_track_groups"
  ON public.landing_track_groups FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can manage landing_track_groups"
  ON public.landing_track_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 6. landing_track_steps
CREATE TABLE public.landing_track_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.landing_track_groups(id) ON DELETE CASCADE,
  path_type TEXT NOT NULL DEFAULT 'general' CHECK (path_type IN ('general', 'software', 'hardware')),
  step_number INTEGER NOT NULL CHECK (step_number > 0),
  title_ar TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  desc_ar TEXT NOT NULL DEFAULT '',
  desc_en TEXT NOT NULL DEFAULT '',
  specializations JSONB DEFAULT NULL
);

ALTER TABLE public.landing_track_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read landing_track_steps"
  ON public.landing_track_steps FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can manage landing_track_steps"
  ON public.landing_track_steps FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Indexes for performance
CREATE INDEX idx_landing_features_sort ON public.landing_features(sort_order) WHERE is_active = true;
CREATE INDEX idx_landing_plans_sort ON public.landing_plans(sort_order) WHERE is_active = true;
CREATE INDEX idx_landing_plans_mode ON public.landing_plans(mode) WHERE is_active = true;
CREATE INDEX idx_landing_plan_benefits_plan ON public.landing_plan_benefits(plan_id, sort_order);
CREATE INDEX idx_landing_track_groups_age ON public.landing_track_groups(age_group, sort_order);
CREATE INDEX idx_landing_track_steps_group ON public.landing_track_steps(group_id, path_type, step_number);

-- ============================================
-- RPC: get_landing_content (single query)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_landing_content()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_settings JSONB;
  v_features JSONB;
  v_plans JSONB;
  v_tracks JSONB;
BEGIN
  -- Settings
  SELECT to_jsonb(s) INTO v_settings
  FROM landing_settings s
  WHERE s.id = '00000000-0000-0000-0000-000000000001'::uuid;

  -- Features
  SELECT COALESCE(jsonb_agg(f ORDER BY f.sort_order), '[]'::jsonb) INTO v_features
  FROM landing_features f WHERE f.is_active = true;

  -- Plans with benefits
  SELECT COALESCE(jsonb_agg(
    p_row ORDER BY p_row.sort_order
  ), '[]'::jsonb) INTO v_plans
  FROM (
    SELECT p.*,
      COALESCE((
        SELECT jsonb_agg(b ORDER BY b.sort_order)
        FROM landing_plan_benefits b WHERE b.plan_id = p.id
      ), '[]'::jsonb) AS benefits
    FROM landing_plans p WHERE p.is_active = true
  ) p_row;

  -- Track groups with steps
  SELECT COALESCE(jsonb_agg(
    g_row ORDER BY g_row.sort_order
  ), '[]'::jsonb) INTO v_tracks
  FROM (
    SELECT g.*,
      COALESCE((
        SELECT jsonb_agg(s ORDER BY s.path_type, s.step_number)
        FROM landing_track_steps s WHERE s.group_id = g.id
      ), '[]'::jsonb) AS steps
    FROM landing_track_groups g
  ) g_row;

  RETURN jsonb_build_object(
    'settings', COALESCE(v_settings, '{}'::jsonb),
    'features', v_features,
    'plans', v_plans,
    'tracks', v_tracks
  );
END;
$$;

-- ============================================
-- Seed Data
-- ============================================

-- Settings
INSERT INTO public.landing_settings (
  id, hero_title_ar, hero_title_en, hero_subtitle_ar, hero_subtitle_en,
  cta_text_ar, cta_text_en, cta_url,
  footer_text_ar, footer_text_en, whatsapp, email,
  address_ar, address_en, social_links
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ابدأ رحلتك في عالم البرمجة',
  'Start Your Coding Journey',
  'تعلم البرمجة والتكنولوجيا بطريقة تفاعلية وممتعة مع كوجوبوت',
  'Learn coding and technology interactively and fun with Kojobot',
  'تسجيل الدخول',
  'Login',
  '/auth',
  '© 2025 Kojobot. جميع الحقوق محفوظة.',
  '© 2025 Kojobot. All rights reserved.',
  '',
  '',
  '',
  '',
  '[]'::jsonb
);

-- Features
INSERT INTO public.landing_features (sort_order, icon_name, title_ar, title_en, desc_ar, desc_en) VALUES
(1, 'Monitor', 'تعلم تفاعلي', 'Interactive Learning', 'بيئة تعليمية تفاعلية تجمع بين المرح والتعلم العملي', 'An interactive learning environment combining fun with hands-on practice'),
(2, 'BookOpen', 'منهج متكامل', 'Rich Curriculum', 'مناهج مصممة بعناية لكل فئة عمرية من الأساسيات للاحتراف', 'Carefully designed curricula for each age group from basics to mastery'),
(3, 'BarChart3', 'متابعة التقدم', 'Progress Tracking', 'تقارير تفصيلية وتقييمات مستمرة لمتابعة تطور الطالب', 'Detailed reports and continuous assessments to track student progress'),
(4, 'Award', 'شهادات معتمدة', 'Certificates', 'شهادات إتمام لكل مرحلة تعزز مسيرة الطالب', 'Completion certificates for each level to boost student achievement');

-- Track Groups (3 age groups)
INSERT INTO public.landing_track_groups (id, age_group, title_ar, title_en, intro_ar, intro_en, sort_order) VALUES
('a0000000-0000-0000-0000-000000000001', '6_9', 'الفئة العمرية 6-9 سنوات', 'Ages 6-9', 'رحلة ممتعة لاكتشاف عالم الكمبيوتر والبرمجة من خلال أدوات بصرية وألعاب تعليمية', 'A fun journey to discover the world of computers and coding through visual tools and educational games', 1),
('a0000000-0000-0000-0000-000000000002', '10_13', 'الفئة العمرية 10-13 سنة', 'Ages 10-13', 'بناء أساس قوي في البرمجة ثم اختيار مسار التخصص في Software أو Hardware', 'Building a strong coding foundation then choosing a specialization path in Software or Hardware', 2),
('a0000000-0000-0000-0000-000000000003', '14_18', 'الفئة العمرية 14-18 سنة', 'Ages 14-18', 'تعلم لغات برمجة حقيقية والتخصص في مجالات التكنولوجيا المتقدمة', 'Learn real programming languages and specialize in advanced technology fields', 3);

-- Track Steps: Ages 6-9 (all general)
INSERT INTO public.landing_track_steps (group_id, path_type, step_number, title_ar, title_en, desc_ar, desc_en) VALUES
('a0000000-0000-0000-0000-000000000001', 'general', 1, 'أساسيات الكمبيوتر', 'Computer Basics', 'يعني إيه كمبيوتر وبرمجة، الكتابة على الكيبورد، التصفح', 'What is a computer and programming, keyboard typing, browsing'),
('a0000000-0000-0000-0000-000000000001', 'general', 2, 'البرمجة البصرية', 'Visual Programming', 'Scratch Jr, Blockly, Minecraft مع مفاهيم Sequence, Loops, If', 'Scratch Jr, Blockly, Minecraft with Sequence, Loops, If concepts'),
('a0000000-0000-0000-0000-000000000001', 'general', 3, 'حل المشكلات', 'Problem Solving', 'ألعاب تحديات وأنشطة Unplugged وتصحيح أخطاء', 'Challenge games, Unplugged activities, and debugging'),
('a0000000-0000-0000-0000-000000000001', 'general', 4, 'الروبوتات', 'Robotics', 'LEGO Education - تركيب روبوت وتوصيل حساسات وأوامر blocks', 'LEGO Education - robot assembly, sensors, and block commands'),
('a0000000-0000-0000-0000-000000000001', 'general', 5, 'البرمجة النصية', 'Text-based Coding', 'مقدمة في Python مع حل مشكلات على Reeborg''s', 'Introduction to Python with problem solving on Reeborg''s');

-- Track Steps: Ages 10-13 (general + software + hardware)
INSERT INTO public.landing_track_steps (group_id, path_type, step_number, title_ar, title_en, desc_ar, desc_en, specializations) VALUES
('a0000000-0000-0000-0000-000000000002', 'general', 1, 'أساسيات الكمبيوتر', 'Computer Basics', 'تأسيس وفهم أساسيات الكمبيوتر والبرمجة', 'Foundation and understanding of computer and programming basics', NULL),
('a0000000-0000-0000-0000-000000000002', 'general', 2, 'أساسيات البرمجة', 'Programming Basics', 'Block Code مع Scratch 3 ثم Python - Variables, Conditions, Loops', 'Block Code with Scratch 3 then Python - Variables, Conditions, Loops', NULL),
('a0000000-0000-0000-0000-000000000002', 'software', 3, 'حل المشكلات', 'Problem Solving', 'تدريب مكثف على التفكير النقدي وحل المشكلات البرمجية', 'Intensive training on critical thinking and programming problem solving', NULL),
('a0000000-0000-0000-0000-000000000002', 'software', 4, 'برمجة متقدمة', 'Advanced Programming', 'OOP, Data Structures, Database, Network', 'OOP, Data Structures, Database, Network', '["Web Development", "Mobile Apps", "Game Development", "AI", "Cyber Security", "VR/AR"]'::jsonb),
('a0000000-0000-0000-0000-000000000002', 'hardware', 3, 'إلكترونيات', 'Electronics', 'أساسيات الإلكترونيات ومكونات وحساسات ومشاريع عملية', 'Electronics basics, components, sensors, and practical projects', NULL),
('a0000000-0000-0000-0000-000000000002', 'hardware', 4, 'Arduino', 'Arduino & Microcontrollers', 'حساسات أعقد وتحكم بالإلكترونيات ومشاريع مدمجة', 'Advanced sensors, electronics control, and integrated projects', NULL),
('a0000000-0000-0000-0000-000000000002', 'hardware', 5, 'تصميم ثلاثي الأبعاد', '3D & Mechanical Design', 'تصميم واقعي ومشاريع شاملة إلكترونيات وبرمجة و3D', 'Realistic design and comprehensive electronics, coding & 3D projects', '["PCB", "IoT", "Smart Home", "RTOS", "Raspberry Pi"]'::jsonb);

-- Track Steps: Ages 14-18 (general + software + hardware, same structure)
INSERT INTO public.landing_track_steps (group_id, path_type, step_number, title_ar, title_en, desc_ar, desc_en, specializations) VALUES
('a0000000-0000-0000-0000-000000000003', 'general', 1, 'أساسيات الكمبيوتر', 'Computer Basics', 'تأسيس وفهم أساسيات الكمبيوتر والبرمجة', 'Foundation and understanding of computer and programming basics', NULL),
('a0000000-0000-0000-0000-000000000003', 'general', 2, 'أساسيات البرمجة', 'Programming Basics', 'C, Python, أو C# مع Variables, Conditions, Loops وتطبيق عملي', 'C, Python, or C# with Variables, Conditions, Loops and practical application', NULL),
('a0000000-0000-0000-0000-000000000003', 'software', 3, 'حل المشكلات', 'Problem Solving', 'تدريب مكثف على التفكير النقدي وحل المشكلات البرمجية', 'Intensive training on critical thinking and programming problem solving', NULL),
('a0000000-0000-0000-0000-000000000003', 'software', 4, 'برمجة متقدمة', 'Advanced Programming', 'OOP, Data Structures, Database, Network', 'OOP, Data Structures, Database, Network', '["Web Development", "Mobile Apps", "Game Development", "AI", "Cyber Security", "VR/AR"]'::jsonb),
('a0000000-0000-0000-0000-000000000003', 'hardware', 3, 'إلكترونيات', 'Electronics', 'أساسيات الإلكترونيات ومكونات وحساسات ومشاريع عملية', 'Electronics basics, components, sensors, and practical projects', NULL),
('a0000000-0000-0000-0000-000000000003', 'hardware', 4, 'Arduino', 'Arduino & Microcontrollers', 'حساسات أعقد وتحكم بالإلكترونيات ومشاريع مدمجة', 'Advanced sensors, electronics control, and integrated projects', NULL),
('a0000000-0000-0000-0000-000000000003', 'hardware', 5, 'تصميم ثلاثي الأبعاد', '3D & Mechanical Design', 'تصميم واقعي ومشاريع شاملة إلكترونيات وبرمجة و3D', 'Realistic design and comprehensive electronics, coding & 3D projects', '["PCB", "IoT", "Smart Home", "RTOS", "Raspberry Pi"]'::jsonb);

-- Plans seed data
INSERT INTO public.landing_plans (sort_order, mode, name_ar, name_en, price_number, price_currency, billing_period_ar, billing_period_en, sessions_per_month, session_duration_minutes, is_featured) VALUES
(1, 'offline', 'الباقة الأساسية', 'Basic Plan', 0, 'EGP', 'شهرياً', 'Monthly', 4, 60, false),
(2, 'offline', 'الباقة المتقدمة', 'Advanced Plan', 0, 'EGP', 'شهرياً', 'Monthly', 4, 90, true),
(3, 'online', 'الباقة الأونلاين', 'Online Plan', 0, 'EGP', 'شهرياً', 'Monthly', 4, 60, false);
