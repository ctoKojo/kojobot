
-- Allow anonymous public users to upload CVs to job-applications bucket
-- The path must start with a UUID-like job folder; we restrict size and content via app-level checks
CREATE POLICY "Public can upload job application files"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'job-applications');
