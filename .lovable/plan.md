

# تصحيح نهائي قبل التنفيذ

---

## 1. تصحيح عدد الملفات

Commit 4 يحتوي **13 ملف** وهم:
- MyQuizzes, MyInstructorQuizzes, StudentQuizPreviewDialog (ازالة Cairo يدوي)
- MyMakeupSessions, Profile, QuizReports, Materials, MyMaterials, InstructorProfile, InstructorPerformanceDashboard, EmployeeFinanceSection, SalariesTab, AssignmentSubmissionsDialog (استبدال toLocaleDateString)

PR Description يتعدل من "15 ملف" الى "13 ملف".

Commit 5 يحتوي **2 ملف** (StudentDashboard + SessionDetails).

**المجموع الفعلي**: 2 جديد + 4 edge functions + 2 core frontend + 13 cleanup + 2 hint/docs = **23 ملف**.

---

## 2. تصحيح grep commands في Checklist

```text
grep -rn "toLocaleDateString" src/
grep -rn "'Africa/Cairo'" src/
```

بدون flags اضافية - `-rn` يكفي (recursive + line number).

---

## 3. خطة التنفيذ بدون تغيير

نفس الترتيب المتفق عليه:
1. Commit 1: `_shared/cairoTime.ts` + `cairoTime_test.ts`
2. Commit 2: 4 Edge Functions
3. Commit 3: `constants.ts` + `timeUtils.ts`
4. Commit 4: 13 ملف frontend cleanup
5. Commit 5: StudentDashboard hint + SessionDetails docs

هبدأ التنفيذ بالترتيب ده.

