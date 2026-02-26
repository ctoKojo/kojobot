

# اصلاح فلاتر الـ Leaderboard - Labels + Reset ذكي + Layout منظم

## التعديلات

### 1. `src/pages/Leaderboard.tsx` - Reset ذكي عند تغيير Scope

تغيير `onScopeChange` من `setScope` مباشرة الى handler يعمل reset للقيم غير المطلوبة:

```text
handleScopeChange(newScope):
  setScope(newScope)
  
  لو newScope مش محتاج group (يعني مش group ولا session):
    setGroupId('') + setSessionId('')
  لو newScope محتاج group بس مش session:
    setSessionId('')  
  لو newScope مش محتاج level:
    setLevelId('')
  لو newScope مش محتاج ageGroup:
    setAgeGroupId('')
```

تمرير الـ handler الجديد بدل `setScope` مباشرة.

---

### 2. `src/components/leaderboard/LeaderboardFilters.tsx` - 3 تحسينات

#### أ. Labels فوق كل Select
كل Select يتلف في `div` فيه label صغير (`text-xs font-medium text-muted-foreground`):
- النطاق / Scope
- المجموعة / Group  
- السيشن / Session
- الليفل / Level
- الفئة العمرية / Age Group
- الفترة / Period

#### ب. Layout بصفين
- **الصف الاول**: النطاق (Scope) + الفترة (Period) - دايما ظاهرين
- **الصف الثاني**: الفلاتر الفرعية حسب الـ scope المختار - يختفي لو scope = "all"

#### ج. Auto-select ذكي بعد تحميل البيانات
اضافة `useEffect` يراقب تغييرات الـ scope والـ dropdown data:
- لما `needsLevel` يبقى true و `levelId` فاضي و `levels.length > 0`: اختار اول level
- لما `needsAgeGroup` يبقى true و `ageGroupId` فاضي و `ageGroups.length > 0`: اختار اول age_group
- لما `needsGroup` يبقى true و `groupId` فاضي و `groups.length > 0`: اختار اول group
- Session auto-select مرتبط بتغير groupId (موجود بالفعل في `loadSessions`)

---

## الملفات المتأثرة
- `src/pages/Leaderboard.tsx` - handleScopeChange جديد
- `src/components/leaderboard/LeaderboardFilters.tsx` - labels + layout + auto-select

