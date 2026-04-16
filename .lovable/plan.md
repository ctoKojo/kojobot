

## Run `compute_level_grades_batch` for Group T10

### Current State
- **Rawan** (`status: graded`, `outcome: null`) — no `level_grades` record yet
- **Mohamed** has a `level_grades` record already (25%, failed) but `outcome` on progress is still null

### What Will Happen
Running `compute_level_grades_batch` for Group T10 will:
1. Create/update `level_grades` records for all students in the group
2. Calculate weighted score: (evaluation_avg * 60%) + (final_exam_score * 40%)
3. Set `outcome` to `passed` or `failed` based on 50% threshold
4. Update `group_student_progress.outcome` accordingly

### Implementation
One simple call via the Supabase client or edge function:

```typescript
await supabase.rpc('compute_level_grades_batch', { 
  p_group_id: 'a9714b0b-efac-47a7-975a-74f3ae3d42a5' 
});
```

This will be executed as a one-off database RPC call to complete Rawan's flow.

