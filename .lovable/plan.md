

# Game UI Overhaul - Student Experience

Transform the entire student interface from a standard dashboard into an immersive game-like experience.

---

## Scope of Changes

### 1. Game-Themed Sidebar (Student Only)
Replace the standard sidebar navigation for students with a game-style menu:
- Dark gradient background with a subtle animated pattern
- Navigation items styled as "game menu buttons" with glowing hover effects
- Icons replaced with game-themed equivalents (e.g., Quizzes = "Scroll", Sessions = "Dungeon", Materials = "Spellbook")
- Section labels styled as chapter headers
- XP level badge displayed at the top of the sidebar
- Active item has a glowing border effect instead of plain highlight

### 2. Game Header Bar (Student Only)
Replace the standard header for students:
- Player HUD-style bar with avatar, level circle, XP bar, streak flame, and shield count all in one horizontal strip
- Dark/gradient background for the header instead of plain white
- Stats displayed as game-style counters with subtle glow effects
- Warnings shown as a pulsing red indicator

### 3. GameHub - Hero Section Redesign
- Full-width gradient hero card with the player's avatar, name, level title, and XP bar
- Animated level circle with a glow ring effect
- Streak counter with animated flame icon when active
- Shield count with a metallic shine effect

### 4. Level Map Visual Upgrade
- Replace plain circles with styled "dungeon nodes" - hexagonal or diamond shapes
- Add a winding SVG path instead of a straight vertical line
- Completed nodes get a green glow + checkmark animation
- Current node pulses with a golden glow + particle-like shimmer
- Locked nodes appear as dark silhouettes with a lock icon
- Add subtle entrance animations (stagger fade-in from bottom)

### 5. Quest Card Redesign
- Card styled as a "mission briefing" with a dark theme
- Glowing border based on quest type (gold for quiz, blue for session, green for assignment)
- "Go!" button styled as a prominent game CTA with gradient + hover scale
- Timer/countdown visual for quiz quests

### 6. Shields Gallery Upgrade
- Achievement cards styled as collectible badges/medals
- Earned shields have a golden frame with a subtle shine animation
- Unearned shields shown as dark silhouettes with a "?" overlay
- Hover effect reveals the achievement description
- XP reward shown as a small tag on each shield

### 7. CSS & Animations
Add new game-specific CSS utilities to `index.css`:
- `.game-glow` - subtle box-shadow glow effect
- `.game-card` - dark semi-transparent card with border glow
- `.animate-pulse-glow` - pulsing glow for active elements
- `.animate-float` - gentle floating animation for icons
- `.animate-stagger-in` - staggered entrance animation
- Hexagonal clip-path utility for map nodes

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/index.css` | Modify | Add game animation keyframes and utility classes |
| `src/components/student/GameHub.tsx` | Modify | Redesign hero bar, tabs styling, and overall layout |
| `src/components/student/LevelMap.tsx` | Modify | New node shapes, SVG path, glow effects, stagger animations |
| `src/components/student/CurrentQuest.tsx` | Modify | Mission briefing style, glowing borders, enhanced CTA |
| `src/components/student/XpBar.tsx` | Modify | Animated gradient progress bar with glow |
| `src/components/student/StreakCounter.tsx` | Modify | Animated flame with glow when active |
| `src/components/AppSidebar.tsx` | Modify | Game-themed sidebar for student role only (other roles unchanged) |
| `src/components/DashboardLayout.tsx` | Modify | Game-themed header for student role only |

---

## Technical Notes

- All changes are **student-role-only** - admin, instructor, and reception UIs remain unchanged
- The sidebar and header will conditionally apply game styling using `role === 'student'` checks
- Dark mode compatibility maintained throughout
- RTL support preserved for Arabic
- Mobile responsiveness maintained with the existing dual-view pattern
- No database changes needed - purely frontend visual overhaul
- Uses existing Tailwind + CSS custom properties pattern from the project

