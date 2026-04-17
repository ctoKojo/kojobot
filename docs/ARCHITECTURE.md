# Architecture Contract — Kojobot

> **هذا الملف هو الـ Source of Truth المعماري للنظام.**
> أي كود مخالف للقواعد دي = مرفوض في الـ review.
> أي rule يتغير لازم يتم توثيقه هنا الأول قبل التطبيق.

---

## 🎯 الفلسفة

النظام مبني على **3 مبادئ ثابتة**:

1. **Single Source of Truth**: كل entity له طبقة data وحيدة. مفيش query مكرر في مكانين.
2. **Layered Boundaries**: كل طبقة ليها مسؤولية واحدة بس. ممنوع تخطي طبقة.
3. **Business Logic in DB**: أي logic ليه أثر مالي أو تعليمي = Postgres RPC. الـ frontend بيقرأ ويعرض بس.

---

## 📚 الـ 4 Layers (مقفولة)

```
┌─────────────────────────────────────────┐
│  Layer 4: UI (React Components)         │  ← presentation فقط
│  • src/pages/, src/features/*/components │  ← مفيش fetch، مفيش logic
└─────────────────┬───────────────────────┘
                  │ uses
┌─────────────────▼───────────────────────┐
│  Layer 3: Hooks (React Query)           │  ← state + caching + invalidation
│  • src/features/*/hooks/                 │
└─────────────────┬───────────────────────┘
                  │ calls
┌─────────────────▼───────────────────────┐
│  Layer 2: Services (Pure functions)     │  ← supabase calls فقط
│  • src/features/*/services/              │  ← مفيش logic
└─────────────────┬───────────────────────┘
                  │ invokes
┌─────────────────▼───────────────────────┐
│  Layer 1: Database (Postgres + RPCs)    │  ← business logic + data integrity
│  • supabase/migrations/                  │
└─────────────────────────────────────────┘
```

### قواعد الطبقات

| Layer | يقدر يستدعي | لا يقدر يستدعي |
|---|---|---|
| **UI** | Hooks | Services, Supabase, DB مباشر |
| **Hooks** | Services, React Query | Supabase مباشر (فيه استثناء واحد: realtime) |
| **Services** | Supabase client, RPCs | Hooks, UI |
| **DB (RPC)** | Tables, other RPCs | Application code |

---

## 🚫 الـ Anti-Patterns الممنوعة

| Anti-Pattern | البديل |
|---|---|
| `import { supabase } from '@/integrations/supabase/client'` في `pages/` أو `components/` | استخدم hook من `src/features/<entity>/hooks/` |
| `useState + useEffect + supabase.from(...)` | `useQuery` من `src/features/<entity>/hooks/` |
| Business logic مكرر في frontend (مثل حساب الدرجة، الـ renewal) | Postgres RPC واحد |
| `queryClient.invalidateQueries()` بدون مفتاح | invalidate صريح بمفتاح محدد |
| ملفات > 500 سطر | تفكيك لـ feature module |
| Cross-feature imports عشوائية (`features/students/` بيـ-import من `features/groups/`) | Shared types في `src/types/` فقط |

> **ملاحظة**: ESLint بيطبع warnings دلوقتي. هتتحول لـ errors بعد ما كل entity تخلص refactor.

---

## 🏗️ Folder Structure (Feature-Based)

```
src/
├── features/
│   └── <entity>/                          ← مثال: students
│       ├── types.ts                        ← StudentListItem, StudentSummary, StudentFullProfile
│       ├── services/
│       │   └── <entity>Service.ts          ← studentsService.ts (calls فقط)
│       ├── hooks/
│       │   ├── use<Entity>List.ts          ← useStudentsList.ts
│       │   ├── use<Entity>.ts              ← useStudent.ts
│       │   └── use<Entity>Mutations.ts     ← useUpdateStudent + invalidation
│       ├── components/                     ← UI sub-components
│       │   ├── <Entity>Table.tsx
│       │   └── <Entity>Filters.tsx
│       └── lib/                            ← UI helpers (formatters, validators)
│           └── <entity>Helpers.ts
│
├── pages/                                 ← orchestration فقط (≤ 200 سطر)
├── services/
│   └── realtime.ts                        ← كل realtime subscriptions في مكان واحد
└── types/                                 ← shared types عبر features
```

---

## 📛 Naming Conventions (نهائي)

### Database (RPCs)
```
get_<entity>_<scope>           — get_student_full_profile
list_<entity>s                 — (نستخدم get_<entity>s_list للوضوح)
calculate_<metric>             — calculate_student_renewal_status
update_<entity>_<action>       — update_student_subscription
transition_<entity>_<state>    — transition_student_to_next_level
```

### Services
```typescript
// studentsService.ts
export const studentsService = {
  getList: (filters) => supabase.rpc('get_students_list', { p_filters: filters }),
  getById: (userId) => supabase.rpc('get_student_summary', { p_user_id: userId }),
  getFullProfile: (userId) => supabase.rpc('get_student_full_profile', { p_user_id: userId }),
  update: (userId, data) => supabase.from('profiles').update(data).eq('user_id', userId),
};
```

### Hooks
```typescript
useStudentsList(filters)        // قائمة + pagination
useStudent(userId)              // entity واحد summary
useStudentFullProfile(userId)   // كل التفاصيل
useUpdateStudent()              // mutation
```

### Query Keys (مثبتة)
```typescript
['students', 'list', filters]              // قائمة + فلاتر
['students', userId]                       // entity واحد
['students', userId, 'full']               // الـ full profile
['students', userId, 'attendance']         // sub-resource
['students', userId, 'subscription']       // sub-resource
```

---

## 🔄 Invalidation Rules (صريحة)

كل mutation **لازم** يحدد بالظبط أي keys تتعمل invalidate. ممنوع `invalidateQueries()` بدون مفتاح.

| Mutation | Invalidates |
|---|---|
| `useUpdateStudent` | `['students', userId]`, `['students', 'list']` |
| `useCreateStudent` | `['students', 'list']` |
| `useRecordPayment` | `['students', userId, 'subscription']`, `['students', userId, 'full']`, `['payments', 'list']` |
| `useRecordAttendance` | `['session', sessionId]`, `['students', studentId, 'attendance']`, `['groups', groupId, 'progress']` |
| `useUpdateSubscription` | `['students', userId, 'subscription']`, `['students', userId, 'full']`, `['students', 'list']` |

> **القاعدة**: invalidation list مكتوبة بالـ source code جنب الـ mutation نفسها. لو الـ list بقت طويلة، ده مؤشر إن الـ mutation بتعمل أكتر من حاجة.

---

## 📦 Data Contracts (3 مستويات لكل entity)

كل entity له **3 أشكال بس** للـ payload. أي طلب لشكل تاني = إضافة hook جديد لازم تتم review.

### مثال: Student
```typescript
// src/features/students/types.ts

export interface StudentListItem {
  user_id: string;
  full_name: string;
  full_name_ar: string;
  age_group_name: string | null;
  current_level_name: string | null;
  group_name: string | null;
  subscription_status: 'active' | 'expired' | 'pending' | 'none';
  needs_renewal: boolean;
}

export interface StudentSummary extends StudentListItem {
  email: string;
  phone: string | null;
  avatar_url: string | null;
  attendance_rate: number;          // 0-100
  total_payments: number;
}

export interface StudentFullProfile extends StudentSummary {
  date_of_birth: string | null;
  parents: Array<{ user_id: string; full_name: string; phone: string | null }>;
  active_subscription: SubscriptionData | null;
  current_group: GroupData | null;
  lifecycle: LifecycleData;
  recent_payments: PaymentData[];
  recent_attendance: AttendanceRecord[];
}
```

### قواعد الـ Contracts
1. **Stable shape**: مفيش optional fields عشوائية. `null` بس لو الحقل منطقياً ممكن يبقى فاضي.
2. **No frontend joins**: لو محتاج بيانات من جدولين، يبقى view أو RPC. ممنوع `Promise.all` لجمع entity واحد.
3. **Enums**: كل status field يبقى string union محدد.

---

## 📡 Realtime Strategy

### القاعدة
كل subscription على Supabase realtime بتتعمل في **`src/services/realtime.ts` فقط**. الـ hooks بتـ-trigger `queryClient.invalidateQueries` بدل ما تـ-update state يدوياً.

```typescript
// src/services/realtime.ts
export function subscribeToStudent(userId: string, queryClient: QueryClient) {
  return supabase
    .channel(`student-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `user_id=eq.${userId}` }, () => {
      queryClient.invalidateQueries({ queryKey: ['students', userId] });
    })
    .subscribe();
}
```

### القواعد
- ممنوع `useEffect + supabase.channel` في component مباشرة.
- subscription واحدة فقط لكل entity (مش في كل صفحة).
- cleanup إجباري في `onUnmount`.

---

## ✅ Pull Request Checklist

قبل أي PR:
- [ ] مفيش `supabase.from` أو `supabase.rpc` خارج `src/features/*/services/` أو `src/services/`
- [ ] كل query جديد له hook في `src/features/<entity>/hooks/`
- [ ] كل mutation محدد invalidation list صريح
- [ ] Business logic جديد = RPC مش frontend function
- [ ] Component < 500 سطر
- [ ] Types من `src/features/<entity>/types.ts` مش inline

---

## 🚦 Migration Status (live counter)

| Entity | Status | Files Refactored | Direct supabase calls remaining |
|---|---|---|---|
| Students | 🔄 Pilot | 0/8 | 26 |
| Sessions | ⏳ Pending | 0 | ~30 |
| Groups | ⏳ Pending | 0 | ~25 |
| Subscriptions | ⏳ Pending | 0 | 11 |
| Payments | ⏳ Pending | 0 | 10 |
| Quizzes | ⏳ Pending | 0 | 16 |
| Curriculum | ⏳ Pending | 0 | 6 |
| Finance | ⏳ Pending | 0 | ~30 |

**Goal**: 0 direct `supabase.*` calls outside service layer.
