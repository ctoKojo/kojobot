

# Fix: update_curriculum_session RPC Overwrites Missing Fields with NULL

## Problem
The `update_curriculum_session` database function sets every field from `p_data`, even when the key is absent. For example, saving URLs from the Materials card sends only `slides_url`, `summary_video_url`, `full_video_url` -- but the function also sets `description = p_data->>'description'` (which is NULL since it wasn't sent), wiping out existing data.

Lines 137-153 of the current RPC show the issue clearly: only `title` and `title_ar` use `COALESCE`, everything else is a direct assignment.

## Solution
Update the RPC to use `COALESCE(p_data->>'field', existing_column)` for ALL fields, so only the fields actually present in the JSON payload get updated.

## Changes

### 1. Database Migration -- Fix `update_curriculum_session` RPC
Update the function so every field uses the pattern:
```sql
column_name = COALESCE(p_data->>'column_name', column_name)
```

For nullable fields where explicitly sending `null` should clear the value, use a check on whether the key exists in `p_data`:
```sql
column_name = CASE WHEN p_data ? 'column_name' THEN p_data->>'column_name' ELSE column_name END
```

This ensures:
- Fields NOT in the JSON payload keep their current value
- Fields explicitly set to `null` in the payload get cleared
- Fields with a new value get updated

### Technical Detail
The `?` operator in PostgreSQL checks if a key exists in a JSONB object, which distinguishes between "key not sent" (keep existing) vs "key sent as null" (clear it).

