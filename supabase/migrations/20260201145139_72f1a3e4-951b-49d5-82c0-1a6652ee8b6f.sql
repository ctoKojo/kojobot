-- Add image_url column to quiz_questions table
ALTER TABLE public.quiz_questions 
ADD COLUMN IF NOT EXISTS image_url text DEFAULT NULL;

-- Create storage bucket for quiz images
INSERT INTO storage.buckets (id, name, public)
VALUES ('quiz-images', 'quiz-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policy for admins to upload quiz images
CREATE POLICY "Admins can upload quiz images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'quiz-images' 
  AND has_role(auth.uid(), 'admin')
);

-- Policy for admins to update quiz images
CREATE POLICY "Admins can update quiz images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'quiz-images' 
  AND has_role(auth.uid(), 'admin')
);

-- Policy for admins to delete quiz images
CREATE POLICY "Admins can delete quiz images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'quiz-images' 
  AND has_role(auth.uid(), 'admin')
);

-- Policy for public read access to quiz images
CREATE POLICY "Public can view quiz images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'quiz-images');