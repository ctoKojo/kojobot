
-- Create materials table
CREATE TABLE public.materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description TEXT,
  description_ar TEXT,
  material_type TEXT NOT NULL DEFAULT 'file',
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'other',
  original_filename TEXT,
  age_group_id UUID REFERENCES public.age_groups(id) ON DELETE SET NULL,
  level_id UUID REFERENCES public.levels(id) ON DELETE SET NULL,
  subscription_type TEXT,
  attendance_mode TEXT,
  uploaded_by UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can manage materials"
ON public.materials FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Students can view matching materials
CREATE POLICY "Students can view their materials"
ON public.materials FOR SELECT
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND is_active = true
  AND (
    age_group_id IS NULL
    OR age_group_id = (SELECT age_group_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  )
  AND (
    level_id IS NULL
    OR level_id = (SELECT level_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  )
  AND (
    subscription_type IS NULL
    OR subscription_type = (SELECT subscription_type::text FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  )
  AND (
    attendance_mode IS NULL
    OR attendance_mode = (SELECT attendance_mode FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  )
);

-- Instructors can view materials
CREATE POLICY "Instructors can view materials"
ON public.materials FOR SELECT
USING (has_role(auth.uid(), 'instructor'::app_role));

-- Updated_at trigger
CREATE TRIGGER update_materials_updated_at
BEFORE UPDATE ON public.materials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('materials', 'materials', true);

-- Storage policies
CREATE POLICY "Anyone can view materials files"
ON storage.objects FOR SELECT
USING (bucket_id = 'materials');

CREATE POLICY "Admins can upload materials"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'materials' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update materials files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'materials' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete materials files"
ON storage.objects FOR DELETE
USING (bucket_id = 'materials' AND has_role(auth.uid(), 'admin'::app_role));
