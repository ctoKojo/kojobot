# Gamification System — Student Game Hub

## Overview
Replace the current `StudentDashboard` with a fully gamified **Game Hub** featuring Level Map, Current Quest, Shields/Achievements, XP system, and Streaks. Kojo NPC is already built via `KojoSheet.tsx`.

---

## Phase 1: Game Hub UI + Level Map + Current Quest (No new DB tables)
Uses existing data: `curriculum_sessions`, `attendance`, `sessions`, `quiz_assignments`, `assignments`, `group_level_progress`, `group_student_progress`

### 1.1 Game Hub Layout (`StudentDashboard.tsx` → rewrite)
- **Top Bar**: XP bar (derived), streak counter (derived), shield count
- **Main Area** (tabs or sections):
  - 🗺️ Level Map (default view)
  - ⚔️ Current Quest
  - 🛡️ Shields Gallery
  - 🏆 Leaderboard (link to existing page)

### 1.2 Level Map Component (`src/components/student/LevelMap.tsx`)
- Visual node-based map showing curriculum sessions as nodes
- Data source: `curriculum_sessions` filtered by student's `level_id` + `age_group_id`
- Node states: completed (attended) / current (first unattended) / locked (future)
- Completion based on `attendance` records (present/late/compensated)
- Kojo NPC on current node (opens `KojoSheet` with `contextType: 'map'`)
- Click completed nodes → navigate to session content

### 1.3 Current Quest Component (`src/components/student/CurrentQuest.tsx`)
- Shows the **next actionable task** for the student:
  1. Pending quiz (from `quiz_assignments` not in `quiz_submissions`)
  2. Pending assignment (from `assignments` not in `assignment_submissions`)
  3. Next upcoming session (from `sessions` where `status = 'scheduled'`)
  4. If nothing: "All clear! 🎉" state
- "Go" button → navigates to the relevant page
- "Ask Kojo" button → opens `KojoSheet` with `contextType: 'quest'`

---

## Phase 2: XP & Streaks Database
New tables (no changes to existing tables):

### 2.1 `student_xp_events` table
```sql
- id uuid PK
- student_id uuid NOT NULL
- event_type text NOT NULL (attendance, quiz_score, assignment_score, streak_bonus, achievement)
- xp_amount integer NOT NULL
- reference_id uuid (session_id, quiz_id, etc.)
- created_at timestamptz DEFAULT now()
```

### 2.2 `student_streaks` table
```sql
- id uuid PK
- student_id uuid UNIQUE NOT NULL
- current_streak integer DEFAULT 0
- longest_streak integer DEFAULT 0
- last_activity_date date
- updated_at timestamptz DEFAULT now()
```

### 2.3 XP Calculation Rules
- Attend session: +50 XP
- Complete quiz: +20 XP base + (score% × 30) bonus
- Submit assignment: +20 XP base + (score% × 30) bonus
- Daily streak bonus: +10 XP per day
- Achievement unlocked: +100 XP

---

## Phase 3: Achievements/Shields
New tables:

### 3.1 `achievements` table (definitions)
```sql
- id uuid PK
- key text UNIQUE NOT NULL
- title text, title_ar text
- description text, description_ar text
- icon_name text (lucide icon name)
- xp_reward integer DEFAULT 100
- condition_type text (attendance_count, quiz_score, streak, level_complete)
- condition_value jsonb
- is_active boolean DEFAULT true
```

### 3.2 `student_achievements` table
```sql
- id uuid PK
- student_id uuid NOT NULL
- achievement_id uuid NOT NULL → achievements
- earned_at timestamptz DEFAULT now()
- UNIQUE(student_id, achievement_id)
```

### 3.3 Seed Achievements
- 🛡️ First Steps: Attend 1 session
- ⚡ Quick Learner: Score 90%+ on quiz
- 🔥 On Fire: 7-day streak
- 🏆 Level Complete: Finish all sessions in a level
- 💯 Perfect Score: 100% on any quiz
- 📚 Bookworm: Attend 10 sessions
- 🌟 Rising Star: Top 3 in leaderboard

---

## Phase 4: Connect Everything
- Trigger XP events from existing actions (attendance insert, quiz grade, assignment grade)
- DB triggers or edge function to auto-calculate streaks
- Check achievement conditions on XP events
- Update Game Hub UI to show real XP/streaks/shields

---

## File Structure
```
src/components/student/
  GameHub.tsx          — Main hub layout (replaces StudentDashboard content)
  LevelMap.tsx         — Visual progression map
  CurrentQuest.tsx     — Next task card
  ShieldsGallery.tsx   — Achievement display
  XpBar.tsx            — XP progress bar
  StreakCounter.tsx     — Daily streak display
  KojoSheet.tsx        — ✅ Already built
```

## Current Status
- [x] KojoSheet.tsx created
- [x] chat-with-kojo backend updated with meta + age tuning
- [x] KojoChatWidget removed for students
- [ ] Phase 1: Game Hub UI + Level Map + Current Quest
- [ ] Phase 2: XP & Streaks DB
- [ ] Phase 3: Achievements DB + seed data
- [ ] Phase 4: Connect triggers + real data
