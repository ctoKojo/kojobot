
# خطة إصلاح عيوب مشروع Kojobot

## المرحلة 1: إصلاحات أمنية حرجة (يوم واحد)

### 1.1 إصلاح ثغرة جدول profiles
```sql
-- إضافة سياسة تمنع الوصول غير المصادق
CREATE POLICY "Require authentication for profiles"
ON profiles FOR SELECT
USING (auth.uid() IS NOT NULL);
```

### 1.2 تفعيل Leaked Password Protection
- يتطلب تفعيل يدوي من Cloud View > Authentication > Settings
- تفعيل خيار "Leaked Password Protection"

---

## المرحلة 2: تحسينات الأداء (2-3 أيام)

### 2.1 إضافة Pagination للجداول الكبيرة

**الملفات المتأثرة:**
- `src/pages/Students.tsx`
- `src/pages/Groups.tsx`
- `src/pages/Instructors.tsx`
- `src/pages/Sessions.tsx`

**التغييرات:**
```typescript
// إضافة state للصفحات
const [page, setPage] = useState(1);
const [pageSize] = useState(20);
const [totalCount, setTotalCount] = useState(0);

// تعديل الـ query
const { data, error, count } = await supabase
  .from('profiles')
  .select('*', { count: 'exact' })
  .range((page - 1) * pageSize, page * pageSize - 1);

// إضافة مكون Pagination
<Pagination
  currentPage={page}
  totalPages={Math.ceil(totalCount / pageSize)}
  onPageChange={setPage}
/>
```

### 2.2 إضافة Rate Limiting للـ Edge Functions

**الملفات المتأثرة:**
- `supabase/functions/create-user/index.ts`
- `supabase/functions/grade-quiz/index.ts`
- جميع Edge Functions الأخرى

**التغييرات:**
```typescript
// إضافة rate limiting بسيط
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT = 10; // 10 requests per minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const lastRequest = rateLimitMap.get(ip) || 0;
  if (now - lastRequest < 60000 / RATE_LIMIT) {
    return false; // Rate limited
  }
  rateLimitMap.set(ip, now);
  return true;
}
```

---

## المرحلة 3: تحسينات جودة الكود (3-5 أيام)

### 3.1 إضافة Error Boundary

**ملف جديد:** `src/components/ErrorBoundary.tsx`
```typescript
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  
  componentDidCatch(error, info) {
    console.error('Error caught:', error, info);
    // في المستقبل: إرسال للـ Sentry
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={() => window.location.reload()} />;
    }
    return this.props.children;
  }
}
```

### 3.2 إنشاء Custom Hooks لتقليل التكرار

**ملفات جديدة:**
- `src/hooks/usePaginatedQuery.ts` - للـ pagination
- `src/hooks/useFormValidation.ts` - للـ validation
- `src/hooks/useStudents.ts` - لجلب الطلاب
- `src/hooks/useGroups.ts` - لجلب المجموعات

### 3.3 إضافة Unit Tests

**ملفات جديدة:**
- `src/lib/validationUtils.test.ts`
- `src/hooks/useAuth.test.ts`
- `src/components/ProtectedRoute.test.tsx`

**مثال:**
```typescript
describe('validateMobileNumber', () => {
  it('should accept valid Egyptian numbers', () => {
    expect(validateMobileNumber('01012345678').isValid).toBe(true);
  });
  
  it('should reject invalid numbers', () => {
    expect(validateMobileNumber('123456').isValid).toBe(false);
  });
});
```

---

## المرحلة 4: تحسينات تجربة المستخدم (2-3 أيام)

### 4.1 إضافة Skeleton Loading

**بدلاً من:**
```typescript
{loading ? <p>Loading...</p> : <Table>...</Table>}
```

**استخدام:**
```typescript
{loading ? <TableSkeleton rows={5} /> : <Table>...</Table>}
```

### 4.2 تحسين Error Messages

**إنشاء:** `src/lib/errorHandler.ts`
```typescript
export function handleSupabaseError(error: any, isRTL: boolean) {
  const errorMap = {
    'duplicate key': isRTL ? 'هذا العنصر موجود بالفعل' : 'This item already exists',
    'foreign key': isRTL ? 'لا يمكن الحذف لوجود بيانات مرتبطة' : 'Cannot delete due to related data',
    // ... more errors
  };
  
  for (const [key, message] of Object.entries(errorMap)) {
    if (error.message?.includes(key)) return message;
  }
  return isRTL ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred';
}
```

### 4.3 إضافة Confirmation Dialogs للعمليات الحساسة

- حذف طالب/مدرب
- إلغاء تفعيل مجموعة
- حذف كويز

---

## المرحلة 5: ميزات إضافية (مستقبلية)

### 5.1 Offline Support (PWA)
- إضافة Service Worker
- تخزين البيانات محلياً

### 5.2 Real-time Updates
- تفعيل Supabase Realtime للإشعارات
- تحديث الحضور مباشرة

### 5.3 Export/Import
- تصدير التقارير إلى PDF/Excel
- استيراد الطلاب من Excel

---

## ملخص الأولويات

| الأولوية | المهمة | الوقت المقدر |
|---------|--------|-------------|
| 🔴 حرج | إصلاح ثغرة profiles | 30 دقيقة |
| 🔴 حرج | تفعيل Leaked Password Protection | 5 دقائق |
| 🟠 متوسط | إضافة Pagination | 4 ساعات |
| 🟠 متوسط | Rate Limiting | 2 ساعة |
| 🟡 منخفض | Error Boundaries | 1 ساعة |
| 🟡 منخفض | Custom Hooks | 3 ساعات |
| 🟡 منخفض | Unit Tests | 4 ساعات |

---

## الخطوة التالية

هل تريد أن أبدأ بإصلاح الثغرة الأمنية الحرجة في جدول profiles أولاً؟
