
# إخفاء الموظفين المنتهي تعاقدهم من الواجهات التشغيلية

## المبدأ
- الدروب داونز واختيار مدرب جديد: فلتر `terminated` دائما
- عرض بيانات مرتبطة بسجل قديم (اسم مدرب جروب مثلا): بدون فلتر - يتجاب بالـ ID
- العدادات: تعد الـ active فقط

---

## التعديلات (8 ملفات)

### 1. `src/pages/Groups.tsx` (سطر 286-289)
اضافة `.neq('employment_status', 'terminated')` عند جلب بروفايلات المدربين للدروب داون:
```typescript
.from('profiles')
.select('user_id, full_name, full_name_ar')
.in('user_id', instructorIds)
.neq('employment_status', 'terminated')
```
ملاحظة: الجروبات اللي عندها `instructor_id` لمدرب terminated هتفضل تعرض اسمه عادي لان بيانات الجروب بتتجاب من `groups` مباشرة وبعدين بتعمل lookup بالـ ID - لو المدرب مش في القائمة الجديدة هيظهر كـ "—" وده سلوك صحيح لان الجروب المفروض يتعين له مدرب جديد.

### 2. `src/pages/MakeupSessions.tsx` (سطر 90-93)
نفس الفلتر عند جلب المدربين لدروب داون الجدولة:
```typescript
.from('profiles')
.select('user_id, full_name, full_name_ar')
.in('user_id', ids)
.neq('employment_status', 'terminated')
```

### 3. `src/pages/MonthlyReports.tsx` (سطر 81-84)
فلترة المدربين من دروب داون فلتر التقارير (تقارير تشغيلية حالية):
```typescript
.from('profiles')
.select('user_id, full_name, full_name_ar')
.in('user_id', instructorIds)
.neq('employment_status', 'terminated')
```

### 4. `src/components/finance/SalariesTab.tsx` (سطر 103)
فلترة الموظفين المنتهي تعاقدهم من قائمة المحافظ:
```typescript
.from('profiles').select('*')
.in('user_id', userIds.length > 0 ? userIds : ['none'])
.neq('employment_status', 'terminated')
```
سجلات المدفوعات التاريخية في `salary_payments` مش هتتأثر لانها بتتجاب بشكل منفصل.

### 5. `src/components/GlobalSearch.tsx` (سطر 89-93)
اضافة فلتر عند البحث عن المدربين:
```typescript
.from('profiles')
.select('user_id, full_name, full_name_ar, email')
.or(`full_name.ilike.${searchTerm},full_name_ar.ilike.${searchTerm},email.ilike.${searchTerm}`)
.neq('employment_status', 'terminated')
.limit(5)
```

### 6. `src/components/dashboard/AdminDashboard.tsx` (سطر 47)
تعديل عداد المدربين ليعد الـ active فقط:
- جلب `user_id` من `user_roles` بـ `role = instructor`
- ثم عمل count على `profiles` بـ `.in('user_id', ids).neq('employment_status', 'terminated')`
- او الاسهل: ابقاء الكويري الحالي وتعديله لخطوتين (جلب IDs ثم count مع فلتر)

### 7. `src/components/messages/NewConversationDialog.tsx` (سطر 48-53)
اضافة فلتر عند البحث عن مستخدمين لبدء محادثة جديدة:
```typescript
.from('profiles')
.select('user_id, full_name, full_name_ar, avatar_url')
.or(`full_name.ilike.%${userSearch}%,full_name_ar.ilike.%${userSearch}%`)
.neq('user_id', userId || '')
.neq('employment_status', 'terminated')
.limit(10)
```

### 8. `src/pages/InstructorPerformanceDashboard.tsx` (سطر 88-89)
فلترة المدربين المنتهي تعاقدهم من داشبورد الاداء:
```typescript
supabase.from('profiles')
  .select('user_id, full_name, full_name_ar, avatar_url, email')
  .in('user_id', ids)
  .neq('employment_status', 'terminated')
```

---

## ما لن يتأثر (بيانات تاريخية سليمة)
- صفحة الموظفين `/instructors` - بالفعل فيها تاب منفصل للـ terminated
- بروفايل الموظف `/instructor/:id` - بيعرض badge الحالة
- سجلات المدفوعات والجلسات المكتملة القديمة
- اسم المدرب المعروض في تفاصيل الجروب (بيتجاب بالـ ID مباشرة)
