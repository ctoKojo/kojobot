✅ curriculum_session_assets table created — PDF side effects isolated from curriculum_sessions.

## What was done
1. **New table `curriculum_session_assets`** — stores PDF path, filename, size, extracted text, processing_status (idle/extracting/done/error), last_error_text
2. **RLS** — admin full access, students read via group membership (level_id + age_group_id match)
3. **Backfill** — existing PDF data migrated from curriculum_sessions
4. **`upsert_session_asset` RPC** — admin-only, saves PDF metadata and sets status to 'extracting'
5. **`update_curriculum_session` RPC** — PDF fields removed, only content fields updated
6. **`get_curriculum_with_access` RPC** — LEFT JOINs assets table, returns same columns as before
7. **`clone_curriculum` RPC** — also clones asset rows
8. **Storage RLS `student_read_pdf`** — updated to use assets table
9. **Edge functions updated**: extract-pdf-text, chat-with-kojo, generate-quiz-questions, get-session-pdf-url
10. **Frontend updated**: SessionEditDialog PDF flow uses upsert_session_asset, CurriculumManagement merges assets data, QuizEditor queries assets table

## Result
- Editing session content (title, description, etc.) will NEVER conflict with PDF uploads or text extraction
- PDF operations write to `curriculum_session_assets` only
- Old PDF columns on `curriculum_sessions` are deprecated (can be dropped later)
