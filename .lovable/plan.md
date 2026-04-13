

# خطة: استبيانات الرضا (Testimonials) على اللاندينج بيدج

## الفكرة
إنشاء نظام لعرض آراء أولياء الأمور الإيجابية فقط (المعتمدة من الأدمن) على اللاندينج بيدج بشكل احترافي — سكشن بين الباقات والأسئلة الشائعة.

## التنفيذ

### 1. Database Migration — جدول `testimonials`

```sql
CREATE TABLE public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid,
  parent_name text NOT NULL,
  parent_name_ar text,
  content_en text,
  content_ar text,
  rating int NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  is_approved boolean DEFAULT false,
  show_on_landing boolean DEFAULT false,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```
- RLS: قراءة عامة للمعتمدة فقط (`is_approved = true AND show_on_landing = true`)
- الأدمن: CRUD كامل

### 2. تحديث `get_landing_content` RPC
- إضافة `testimonials` (المعتمدة والمعروضة) ضمن البيانات المرجعة

### 3. عرض على اللاندينج (`Index.tsx`)
- سكشن جديد بين Plans و FAQ
- تصميم كروت احترافية متحركة (carousel أو grid) بنفس ستايل اللاندينج الداكن
- كل كارت يعرض: الاسم، التقييم (نجوم)، والنص
- عنوان السكشن: "ماذا يقول أولياء الأمور" / "What Parents Say"

### 4. إدارة الاستبيانات (Settings أو صفحة مستقلة)
- تاب أو قسم في صفحة Settings للأدمن لإضافة/تعديل/حذف الاستبيانات
- Toggle لـ `show_on_landing` و `is_approved`

## الملفات المتأثرة

| ملف | تغيير |
|---|---|
| Migration جديد | جدول `testimonials` + RLS |
| Migration جديد | تحديث `get_landing_content` |
| `src/pages/Index.tsx` | سكشن testimonials + interface + data |
| `src/pages/Settings.tsx` | قسم إدارة الاستبيانات |

