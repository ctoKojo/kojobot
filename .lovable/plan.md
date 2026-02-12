

# Separating Group Creation from Session Generation

## Current Behavior
When an admin creates a new group, a database trigger (`create_group_sessions`) automatically generates all 12 sessions immediately upon insert. This means sessions exist before any students are added.

## New Behavior
1. Groups are created **without** sessions initially
2. Admin adds students to the group at their own pace
3. When ready, admin clicks a **"Start Group"** button to generate the sessions
4. Only after starting, the group's sessions are created based on the schedule

## Implementation Steps

### 1. Database Migration
- Modify the `create_group_sessions` trigger to **not fire automatically** on insert
- Instead, convert it to a callable function that can be invoked manually
- Add a `has_started` boolean column to the `groups` table (default `false`) to track whether sessions have been generated

### 2. New Edge Function: `start-group`
- Create a new edge function that:
  - Validates the admin role
  - Checks the group exists and `has_started = false`
  - Accepts a `start_date` parameter (the date of the first session)
  - Generates the 12 sessions (same logic as the current trigger)
  - Sets `has_started = true` on the group

### 3. UI Changes in `src/pages/Groups.tsx`
- Add a **"Start Group"** button in the group actions dropdown (only visible when `has_started = false`)
- Clicking it opens a small dialog to confirm and optionally pick the start date
- Remove the "existing group" flow from the create dialog since it's no longer needed (sessions aren't auto-created)
- Show a badge like "Pending Start" for groups that haven't started yet

### 4. Form Simplification
- Remove `is_existing_group`, `next_session_number`, and `next_session_date` from the create form since sessions are no longer created at group creation time
- These options move to the "Start Group" dialog instead

## Technical Details

### Database Migration SQL
```sql
-- Add has_started column
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS has_started boolean DEFAULT false;

-- Update existing groups to mark them as started (they already have sessions)
UPDATE public.groups SET has_started = true;

-- Drop the auto-trigger so sessions are NOT created on insert
DROP TRIGGER IF EXISTS trigger_create_group_sessions ON public.groups;
```

### Edge Function: `supabase/functions/start-group/index.ts`
- Accepts: `group_id`, `start_date` (optional, defaults to next occurrence of schedule_day), `starting_session_number` (optional, for existing groups)
- Reuses the same session generation logic from the trigger
- Updates `groups.has_started = true`
- Admin-only access

### Groups Page Changes
- New state: `startGroupDialog` with `selectedGroupForStart`
- "Start Group" button with a calendar picker for start date
- Option to set starting session number (for existing groups being onboarded)
- Badge showing "Not Started" / "Awaiting Students" for `has_started = false` groups
- The `update_future_sessions` trigger remains unchanged (it only affects scheduled sessions)

### Group Status Flow
```text
Create Group --> [Not Started] --> Add Students --> Start Group --> [Active with Sessions]
```

