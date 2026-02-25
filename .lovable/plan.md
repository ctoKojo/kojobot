

# Auto-populate Full-Mark Evaluations for Existing Groups

## Problem

When starting a group with `starting_session_number > 1`, the `populate-completed-sessions` edge function creates attendance, quizzes (with submissions), and assignments (with submissions) -- all with perfect scores. However, it does NOT create `session_evaluations` records, which means:

- The evaluation grid shows empty for old sessions
- Level grade computation (`compute_level_grades_batch`) calculates `evaluation_avg` from `session_evaluations` -- missing records means lower/zero averages
- The student's performance charts and monthly reports show incomplete data

## Solution

Update the `populate-completed-sessions` edge function to also create **session evaluations with full marks** for each student in each completed session.

### Technical Challenges

The `session_evaluations` table has several database triggers that validate inserts:

1. **`trg_eval_require_attendance`** -- Requires attendance record exists AND all group students have attendance. This is satisfied because we create attendance first.
2. **`trg_eval_validate_compute`** -- Validates that `scores` keys match `criteria_snapshot` keys, and that each score value exists in the criterion's `rubric_levels`. We must provide valid `criteria_snapshot` and `scores`.
3. **`trg_eval_check_evaluator`** -- Checks that `evaluated_by` is the group instructor or an admin. We set `evaluated_by = instructor_id`, which passes.
4. **`trg_eval_lock_24h`** -- Only applies to UPDATE, not INSERT. No issue.

### Implementation

Update `supabase/functions/populate-completed-sessions/index.ts`:

1. **Fetch the group's `age_group_id`** (already fetching group, just add `age_group_id` to the select).

2. **Fetch active `evaluation_criteria`** for this age group, ordered by `display_order`.

3. **Build `criteria_snapshot` and `scores`** with max values:
   - `criteria_snapshot`: array of criteria objects (key, name, name_ar, max_score, rubric_levels, etc.)
   - `scores`: object mapping each criterion key to its `max_score` value (full marks)

4. **For each completed session and each student**, insert a `session_evaluations` record with:
   - `session_id`, `student_id`, `evaluated_by: instructor_id`
   - `criteria_snapshot` and `scores` (full marks)
   - `quiz_score: 10`, `quiz_max_score: 10` (matching the quiz submission)
   - `assignment_score: 100`, `assignment_max_score: 100` (matching the assignment submission)
   - `student_feedback_tags: ['Excellent']`
   - `notes: 'Auto-generated for existing group'`

5. **Check for existing evaluation** before insert (idempotent -- `session_evaluations` has `UNIQUE(session_id, student_id)`).

6. **Add `evaluations` counter** to the results object.

### Data Flow

```text
For each completed session:
  1. Create attendance (present) for each student       -- already done
  2. Create quiz + assignment with full scores           -- already done
  3. NEW: Create session_evaluation with full marks      -- to be added
       - Fetch evaluation_criteria for age_group
       - Build criteria_snapshot + max scores
       - Insert with quiz_score=10, assignment_score=100
```

### Edge Cases

- If the group has no `age_group_id`, skip evaluations (log warning)
- If no `evaluation_criteria` exist for the age group, skip evaluations (log warning)
- Existing evaluations are skipped (idempotent via check before insert)
- The `UNIQUE(session_id, student_id)` constraint provides a safety net

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/populate-completed-sessions/index.ts` | Add evaluation creation section after assignments |

