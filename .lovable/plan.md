
# تغيير خطوط الموقع

## التغييرات المطلوبة

تحديث إعدادات الخطوط بحيث يستخدم الموقع خط **Poppins** للإنجليزي وخط **Cairo** للعربي.

---

## التفاصيل التقنية

### 1. تحديث `tailwind.config.ts`
- تغيير `fontFamily.sans` من `Inter, Noto Sans Arabic` إلى `Poppins, sans-serif`

### 2. تحديث `src/index.css`
- التأكد من أن `body` يستخدم `Poppins` (موجود بالفعل)
- التأكد من أن `[dir="rtl"]` يستخدم `Cairo` (موجود بالفعل)

### 3. تحديث `index.html`
- الخطوط (Poppins و Cairo) محملة بالفعل من Google Fonts -- لا يوجد تغيير مطلوب

---

## ملخص
التغيير الأساسي هو في ملف `tailwind.config.ts` فقط -- تغيير الخط الافتراضي من `Inter` إلى `Poppins`. باقي الإعدادات في CSS و HTML جاهزة بالفعل.
