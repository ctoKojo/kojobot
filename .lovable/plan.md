

# ما ينقص النظام حالياً — تحليل شامل

## 1. خطة قفل الاشتراك (Payment Lock) — مخططة لكن غير مكتملة

الخطة موجودة في `plan.md` وبعض الأجزاء متنفذة (صفحة `RenewalRequired.tsx`، route في `App.tsx`، check في `ProtectedRoute.tsx`) لكن:

- **Migration غير مؤكد**: هل `needs_renewal` column موجود فعلاً في الـ DB؟ والـ RPC `student_choose_track_and_upgrade` هل بيعمل `needs_renewal = true`؟
- **CreateSubscriptionDialog**: هل بيعمل reset لـ `needs_renewal = false` عند التجديد؟

**الحالة**: محتاج تأكيد إن الدورة كاملة (ترقية → قفل → تجديد → فتح).

---

## 2. تصحيح الامتحان النهائي — متنفذ جزئياً

- زر "تصحيح" موجود في `/final-exams`
- `QuizResultsDialog` بيدعم `isFinalExam` mode
- **لكن**: لسه محتاج اختبار فعلي إن الأدمن يقدر يصحح الأسئلة المفتوحة ويحفظ الدرجات وإن `compute_level_grades_batch` يشتغل بعدها

---

## 3. نواقص وظيفية عامة

| الناقص | التفاصيل |
|--------|---------|
| **Parents Portal** | مفيش واجهة لأولياء الأمور يتابعوا أداء أولادهم |
| **Email Notifications** | النظام يعتمد على in-app notifications فقط، مفيش email/SMS للتذكيرات المهمة (دفع، امتحان، غياب) |
| **Export/Print Reports** | بعض الصفحات فيها PDF export لكن مفيش تقرير شامل للمستوى أو تقرير مالي قابل للطباعة |
| **Dashboard Analytics عميقة** | الداشبورد فيها KPIs أساسية لكن مفيش trends/charts على مدار الوقت (retention rate، revenue growth، completion rate) |
| **Instructor Self-Service** | المدرب مش بيقدر يعدل بياناته المالية أو يشوف تفاصيل الراتب بشكل كامل |
| **Audit Trail للمالية** | مفيش log لمين عدل مبلغ أو حذف دفعة |
| **Bulk Operations** | مفيش عمليات جماعية (تحويل طلاب، إرسال إشعارات جماعية، تصدير بيانات مجمعة) |
| **Waiting List** | مفيش نظام قوائم انتظار للمجموعات الممتلئة |
| **Student Self-Registration Flow** | صفحة `/subscribe` موجودة لكن مفيش تأكيد إنها متكاملة مع الدفع والقبول |
| **Mobile App / PWA** | فيه `sw-push.js` للإشعارات لكن مفيش manifest كامل أو offline support حقيقي |

---

## 4. تحسينات تقنية مطلوبة

| التحسين | التفاصيل |
|---------|---------|
| **Error Handling موحد** | `errorHandler.ts` موجود لكن مش كل الصفحات بتستخدمه |
| **Testing Coverage** | عدد التيستات قليل جداً مقارنة بحجم الكود (5-6 test files فقط) |
| **Pagination** | `usePaginatedQuery` موجود لكن مش كل الجداول بتستخدمه (الصفحات الكبيرة زي Students/Sessions) |
| **Caching Strategy** | React Query موجود لكن بدون staleTime/cacheTime strategy موحدة |
| **Accessibility (a11y)** | مفيش focus management أو screen reader support واضح |

---

## 5. الأولويات المقترحة (من الأهم للأقل)

1. **تأكيد اكتمال دورة Payment Lock** — ده حرج لأنه بيأثر على فلوس وعلى تجربة الطالب
2. **Email/WhatsApp Notifications** — التذكيرات الحالية in-app فقط، الطلاب ممكن ميفتحوش الموقع
3. **Dashboard Analytics المتقدمة** — charts وtrends للإدارة
4. **Parents Portal** — خصوصاً لو الطلاب أطفال
5. **Bulk Operations** — توفير وقت الأدمن

---

## ملخص

النظام **قوي ومتكامل** في الوظائف الأساسية (طلاب، مجموعات، حضور، كويزات، امتحانات، مالية، رسائل، شهادات، leaderboard). النواقص الأساسية هي في **التواصل الخارجي** (email/SMS)، **التحليلات المتقدمة**، و**تأكيد اكتمال الـ flows الجديدة** (payment lock + final exam grading).

