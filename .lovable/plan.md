

# Fix: Students Can't Download Curriculum PDF

## Root Cause

The `get-session-pdf-url` edge function receives a **sessions** table ID (the actual class session), but queries the **curriculum_sessions** table with that ID. These are completely different tables with different IDs, so the query always returns "Session not found" (404).

The callers:
- `MySessions.tsx` passes `s.id` (from the `sessions` table)
- `SessionDetails.tsx` passes `session?.id` (also from the `sessions` table)

## Fix

Rewrite the edge function to:
1. Look up the **session** from the `sessions` table to get `group_id` and `session_number`
2. Look up the **group** to get `age_group_id` and `level_id`
3. Find the matching **curriculum_session** using `age_group_id + level_id + session_number` (where `is_published = true` and `is_active = true`)
4. Get the PDF path from `curriculum_session_assets` using the curriculum session ID
5. Generate the signed URL

## Technical Changes

### 1. Update Edge Function: `supabase/functions/get-session-pdf-url/index.ts`

Replace the current logic with the correct lookup chain:

```text
sessions (by sessionId)
  -> groups (by group_id)       -> get age_group_id, level_id
  -> curriculum_sessions        -> match by age_group_id + level_id + session_number + is_published + is_active
  -> curriculum_session_assets  -> get student_pdf_path
  -> storage signed URL
```

Authorization check stays the same (admin bypasses, students must be enrolled in a group with matching age_group + level).

No UI changes needed -- the callers already pass the correct session ID format.
