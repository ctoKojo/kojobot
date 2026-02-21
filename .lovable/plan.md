

# تحقيق Single Source of Truth في المشروع

---

## ملخص المراجعة

بعد فحص شامل للمشروع، تم رصد **6 فئات رئيسية** من انتهاكات مبدأ "مصدر واحد للحقيقة":

---

## 1. `formatDate` - مكرر في 19 ملف

نفس الفانكشن بالظبط (مع اختلافات طفيفة) مكررة في:
- `Notifications.tsx`, `InstructorWarnings.tsx`, `StudentWarnings.tsx`, `GradeAssignment.tsx`, `Finance.tsx`, `SubmitAssignment.tsx`, `ActivityLog.tsx`, `GroupDetails.tsx`, `MyInstructorWarnings.tsx`, `Assignments.tsx`, `AssignmentSubmissions.tsx`, `InstructorProfile.tsx`, `StudentProfile.tsx`, `MyQuizzes.tsx`, `ExpensesTab.tsx`, `StudentDashboard.tsx`, `StudentQuizPreviewDialog.tsx`, `TakeQuiz.tsx`, `MyInstructorQuizzes.tsx`

### الحل:
انشاء `formatDate` و `formatDateTime` مركزية في `src/lib/timeUtils.ts` (الملف موجود بالفعل ويحتوي `formatTime12Hour`). كل الملفات تستورد منه.

---

## 2. Group Type Labels و Max Students - مكرر في 7+ ملفات

نفس البيانات مكررة:
```text
kojo_squad -> "Kojo Squad" / "كوجو سكواد" / maxStudents: 8
kojo_core  -> "Kojo Core"  / "كوجو كور"  / maxStudents: 3
kojo_x     -> "Kojo X"     / "كوجو اكس"  / maxStudents: 1
```

مكرر في: `Groups.tsx`, `GroupDetails.tsx`, `Students.tsx`, `Settings.tsx`, `PricingPlans.tsx`, `Materials.tsx`, `AdminAnalytics.tsx`

ملاحظة: الحد الاقصى موجود ايضا كدالة في قاعدة البيانات (`get_group_max_students`) لكن الفرونت يعرفها بشكل مستقل.

### الحل:
انشاء `src/lib/constants.ts` يحتوي:
- `GROUP_TYPES` مع labels (en/ar) و maxStudents
- `SUBSCRIPTION_TYPES` مع labels
- `ATTENDANCE_MODES`
- فانكشنز مساعدة: `getGroupTypeLabel(type, lang)`, `getMaxStudents(type)`

---

## 3. `getStatusBadge` - مكرر بانماط مختلفة في 7 ملفات

كل ملف يعيد تعريف session/quiz/assignment/salary status badges بشكل مستقل:
- `Sessions.tsx` (session status)
- `MakeupSessions.tsx` (makeup status)
- `Groups.tsx` (group status)
- `QuizReports.tsx` (quiz submission status)
- `MyInstructorQuizzes.tsx` (quiz submission status)
- `SalariesTab.tsx` (salary month status)
- `AssignmentSubmissionsDialog.tsx` (assignment submission status)

### الحل:
انشاء `src/lib/statusBadges.tsx` يحتوي فانكشنز مركزية:
- `getSessionStatusBadge(status, isRTL)`
- `getMakeupStatusBadge(status, isRTL)`
- `getQuizSubmissionStatusBadge(status, percentage, passingScore, isRTL)`
- `getAssignmentSubmissionStatusBadge(status, score, isRTL)`

---

## 4. Role Labels - مكرر في 3+ ملفات

```text
isRTL ? 'مدرب' : 'Instructor'
isRTL ? 'ريسيبشن' : 'Reception'
```
مكرر في: `Instructors.tsx`, `InstructorProfile.tsx`, `SalariesTab.tsx`

### الحل:
اضافة role labels في `src/lib/constants.ts`:
```text
ROLE_LABELS = { admin: { en, ar }, instructor: { en, ar }, ... }
```

---

## 5. Session Auto-Completion - منطق مكرر

تحديث حالة السيشن لـ "completed" يحصل في:
1. `SessionDetails.tsx` - `checkAndUpdateSessionStatus` (فرونت، كل دقيقة)
2. `auto-complete-sessions/index.ts` (Edge Function - باك اند)
3. `save_attendance` RPC (داخل قاعدة البيانات)
4. `auto_generate_next_session` trigger (عند التحويل لـ completed)

هذا ليس انتهاك حقيقي لانهم يعملون في طبقات مختلفة (defense in depth) لكن يجب توثيقها. الفرونت يكرر المنطق كـ "optimistic update" - وده مقبول.

### الحل:
لا تغيير مطلوب - هذا تصميم متعمد (layers of defense). لكن يمكن اضافة تعليق توثيقي يوضح ان الـ SSOT الحقيقي هو الـ RPC والـ trigger.

---

## 6. Subscription Type Options - مكرر في 4 ملفات

قوائم `kojo_squad/kojo_core/kojo_x` كخيارات Select مكررة في:
- `Students.tsx`, `Settings.tsx`, `PricingPlans.tsx`, `Materials.tsx`

### الحل:
يُستهلك من `src/lib/constants.ts` المقترح في النقطة 2.

---

## خطة التنفيذ

### الملفات الجديدة:

| الملف | المحتوى |
|---|---|
| `src/lib/constants.ts` | GROUP_TYPES, SUBSCRIPTION_TYPES, ROLE_LABELS, ATTENDANCE_MODES مع labels ثنائية اللغة وفانكشنز مساعدة |
| `src/lib/statusBadges.tsx` | فانكشنز getSessionStatusBadge, getMakeupStatusBadge, getQuizSubmissionStatusBadge, getAssignmentSubmissionStatusBadge |

### الملفات المعدلة:

| الملف | التعديل |
|---|---|
| `src/lib/timeUtils.ts` | اضافة `formatDate(date, lang)` و `formatDateTime(date, lang)` |
| 19 ملف يحتوي `formatDate` | استبدال التعريف المحلي باستيراد من `timeUtils` |
| 7 ملفات تحتوي group type labels | استبدال بـ import من `constants.ts` |
| 4 ملفات تحتوي subscription type options | استبدال بـ import من `constants.ts` |
| 7 ملفات تحتوي `getStatusBadge` | استبدال بـ import من `statusBadges.tsx` |
| 3 ملفات تحتوي role labels | استبدال بـ import من `constants.ts` |

---

## ملخص التأثير

- **~30 ملف** سيتم تعديلهم
- **3 ملفات جديدة** (constants, statusBadges, توسيع timeUtils)
- **صفر تغيير في قاعدة البيانات** - كل التغييرات فرونت فقط
- **صفر تغيير في السلوك** - refactoring بحت

---

## ما هو سليم بالفعل (SSOT محقق):

- **Authentication & Roles**: `AuthContext` + `user_roles` table + `has_role()` RPC - مصدر واحد
- **Attendance Logic**: `save_attendance` RPC - مصدر واحد للمنطق الذري
- **Curriculum Access**: `get_curriculum_with_access` RPC - مصدر واحد
- **Makeup Credits**: `create_makeup_session` RPC - مصدر واحد (ledger pattern)
- **Notifications**: `notificationService.ts` - مصدر واحد
- **Activity Logging**: `activityLogger.ts` - مصدر واحد
- **Salary Events**: database triggers + RPCs - مصدر واحد
- **Time Formatting**: `formatTime12Hour` في `timeUtils.ts` - مصدر واحد (لكن formatDate مش موجود)

