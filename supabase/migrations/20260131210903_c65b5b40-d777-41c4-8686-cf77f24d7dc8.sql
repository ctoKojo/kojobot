-- Add public SELECT policy for assignments bucket (since bucket is public)
CREATE POLICY "Public can view assignment files"
ON storage.objects FOR SELECT
USING (bucket_id = 'assignments');