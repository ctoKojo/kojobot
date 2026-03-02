

# Restructure Curriculum Session Editing: From Dialog to Full Page

## Current Problem
All session editing is crammed into a single dialog with 4 tabs (Basic, Materials, Quiz, Assignment). This makes it hard to work with, especially when uploading PDFs triggers assignment previews and text extraction -- all inside a small dialog.

## Proposed Solution
Replace the dialog with a dedicated full page at `/curriculum/session/:sessionId` that shows each section as a separate collapsible card. Each section saves independently, so you only save what you changed.

## Page Layout

```text
+--------------------------------------------------+
| <- Back to Curriculum    Session 7 - Level Name   |
|              [Draft/Published badge]              |
+--------------------------------------------------+
|                                                    |
| [Card: Basic Info]                         [Save] |
|   Title EN / Title AR / Description EN/AR          |
|                                                    |
| [Card: Materials (PDF + Videos)]           [Save] |
|   Student PDF upload + extraction status           |
|   Slides URL / Summary Video / Full Video          |
|                                                    |
| [Card: Quiz]                                       |
|   Create / View / Edit Questions / Unlink          |
|                                                    |
| [Card: Assignment]                         [Save] |
|   Title / Description / Attachment / Max Score     |
|                                                    |
+--------------------------------------------------+
```

## Key Changes

### 1. New Route + Page
- Add route `/curriculum/session/:sessionId` in `App.tsx`
- Create `src/pages/CurriculumSessionEdit.tsx` -- a full page with 4 collapsible `Card` sections
- Each section has its own "Save" button that calls `update_curriculum_session` with only the relevant fields

### 2. Update CurriculumManagement Table
- Change the "Edit" button in the sessions table to navigate to `/curriculum/session/${session.id}` instead of opening the dialog
- Pass age group + level info via URL query params or route state
- Remove `SessionEditDialog` import and state from `CurriculumManagement.tsx`

### 3. Section-by-Section Saving
- **Basic Info card**: Title, Title AR, Description, Description AR -- saves via `update_curriculum_session`
- **Materials card**: PDF upload (with assignment preview flow), Slides URL, Videos -- PDF saves immediately on upload via `upsert_session_asset`; URLs save via `update_curriculum_session`
- **Quiz card**: Create/Edit/Unlink -- no "Save" button needed, actions are immediate (RPC calls)
- **Assignment card**: Title, Description, Attachment, Max Score -- saves via `update_curriculum_session`

### 4. Preserve All Existing Logic
- Optimistic locking (`updated_at` check) stays
- Assignment auto-extraction from last PDF page stays
- AI quiz creation flow stays
- All RPC calls remain the same

### Technical Details
- The new page fetches session data by ID from `curriculum_sessions` + `curriculum_session_assets`
- Each card section is a self-contained component with its own local state and save handler
- The `AssignmentPreviewDialog` component is reused as-is
- `SessionEditDialog.tsx` will be deleted after migration

