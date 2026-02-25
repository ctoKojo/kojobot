

# تنفيذ نظام Leaderboard المتكامل

## ترتيب التنفيذ

### 1. Database Migration: RPC `get_leaderboard`

انشاء function بـ `SECURITY DEFINER` تعمل كل الحسابات server-side:

**Parameters:**
- `p_scope text` -- 'session' | 'group' | 'level_age_group' | 'level' | 'age_group' | 'all'
- `p_session_id uuid` (optional)
- `p_group_id uuid` (optional)
- `p_level_id uuid` (optional)
- `p_age_group_id uuid` (optional)
- `p_period text` -- 'all_time' | 'monthly' | 'weekly'
- `p_limit int` (default 50)
- `p_offset int` (default 0)

**المنطق الداخلي:**

1. **Parameter Validation**: يرفض ويرجع empty لو scope محتاج ID مش موجود (session بدون p_session_id، group بدون p_group_id، الخ)

2. **Role-based Access**:
   - Admin: كل النطاقات
   - Instructor: group scope فقط لمجموعاته (groups.instructor_id = auth.uid())
   - Student: group scope فقط لمجموعاته (group_students.student_id = auth.uid() AND is_active = true) - الطالب يختار من مجموعاته في الـ UI
   - غير ذلك: يرجع empty

3. **CTE**: join بين session_evaluations و sessions و groups

4. **Scope Filtering**:
   - `session`: WHERE se.session_id = p_session_id
   - `group`: WHERE s.group_id = p_group_id
   - `level_age_group`: WHERE g.level_id = p_level_id AND g.age_group_id = p_age_group_id
   - `level`: WHERE g.level_id = p_level_id
   - `age_group`: WHERE g.age_group_id = p_age_group_id
   - `all`: بدون فلتر

5. **Period Filter** (على sessions.session_date):
   - `monthly`: session_date >= date_trunc('month', CURRENT_DATE)
   - `weekly`: session_date >= date_trunc('week', CURRENT_DATE)
   - `all_time`: بدون فلتر

6. **Aggregation**: GROUP BY student_id مع SUM(total_score), SUM(max_total_score), COUNT(DISTINCT session_id)

7. **Weighted Average**: ROUND(SUM(total_score) / NULLIF(SUM(max_total_score), 0) * 100, 1)

8. **Ranking**: DENSE_RANK() OVER (ORDER BY percentage DESC, sessions_count DESC, sum_total_score DESC, student_name ASC)

9. **Joins**: profiles (اسم + avatar مع COALESCE fallback)، groups/levels (اسم المجموعة والليفل)

10. **total_count**: COUNT(*) OVER() محسوب بعد التجميع والفلترة وقبل LIMIT/OFFSET

---

### 2. ملف جديد: `src/lib/leaderboardService.ts`

Thin wrapper حول الـ RPC:
- Types: LeaderboardScope, LeaderboardPeriod, LeaderboardFilter, LeaderboardEntry
- Function: `getLeaderboard(filter)` يستدعي `supabase.rpc('get_leaderboard', params)`

---

### 3. تحديث: `src/lib/i18n.ts`

اضافة مفاتيح جديدة في interface `evaluation` وفي قيم `en` و `ar`:

```text
scope, session, group, levelInAgeGroup, levelGlobal, ageGroupGlobal, allStudents,
period, allTime, thisMonth, thisWeek, selectSession, selectGroup,
selectAgeGroup, selectLevel, sessionsCount, topPerformers, student
```

---

### 4. اعادة كتابة: `src/pages/Leaderboard.tsx`

**الفلاتر:**
- Select النطاق: Admin يشوف الـ 6 نطاقات، Instructor/Student يشوف group فقط (مجموعاته)
- Selects فرعية ديناميكية حسب النطاق المختار
- Select الفترة: كل الوقت / الشهر / الاسبوع

**البوديوم (Top 3):**
- يظهر فقط لما يكون فيه 3+ طلاب
- كروت بصرية مع Trophy/Medal icons واسم الطالب والنسبة والـ avatar

**الجدول:**
- اعمدة: الرتبة، الطالب (مع avatar وfallback عربي/انجليزي)، النقاط، النسبة، عدد السيشنات، الفجوة، التقدير
- اعمدة اضافية في النطاقات العامة: المجموعة، الليفل
- تلوين الصفوف الثلاثة الاولى
- Pagination باستخدام DataTablePagination

**حالات فارغة:** Loading spinner، لا توجد تقييمات

---

## لا تعديل على ملفات اخرى
- `App.tsx`: الراوت موجود
- `AppSidebar.tsx`: الرابط موجود

