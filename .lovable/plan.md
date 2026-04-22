# تحسين إدارة قوالب الإيميل والإشعارات — Production-Ready

الهدف: تحويل صفحة `Email Templates` لواجهة احترافية على مستوى SaaS (SendGrid/Mailchimp) مع 3 layers أساسيين: **Validation & Safety**, **Audit & Permissions**, **Versioning & Rollback** — بجانب تحسينات الـ UX.

---

## 🛡 Layer 1 — Validation & Safety (قبل أي حاجة)

### 1.1 Variables Schema & Validation
- لكل event في `email_event_catalog`، نعتمد `available_variables` كـ **schema رسمي** فيه:
  - اسم المتغير، النوع (string/number/date/url)، required/optional، sample value
- عند الحفظ: نـ parse القالب ونستخرج كل `{{variable}}` ونتحقق:
  - كل المتغيرات المستخدمة موجودة في schema الـ events المربوطة
  - كل الـ required variables موجودة في القالب (أو فيه fallback)
- عرض **inline errors** في الـ editor (highlight للمتغير الغلط) + قائمة warnings قبل الحفظ

### 1.2 Channel Status Logic — 3 حالات
لكل قناة (Email/Telegram) أيقونة بـ 3 ألوان:
- 🟢 **شغال**: فيه content + variables صحيحة + آخر test/send نجح
- 🟡 **ناقص بيانات**: content موجود بس فيه missing required vars أو مفيش test history
- 🔴 **فيه error**: آخر send فشل، أو variables غلط، أو القالب فاضي للـ audience المربوط

نخزن آخر validation result في column جديد `validation_status jsonb` على `email_templates`.

### 1.3 Deterministic Live Preview
- كل event عنده **fixed mock data** في `email_event_catalog.preview_data jsonb` (مش بيانات حقيقية)
- الـ Live Preview بياخد المـ mock ده ويـ render القالب — نفس النتيجة دايماً
- زر "Use my data" optional لو حد عايز يـ test ببيانات حقيقية

### 1.4 Preview Fallback
لو متغير في القالب مش موجود في الـ mock data، نعرضه كـ `[missing: variableName]` بلون أحمر بدل ما يبقى string فاضي.

---

## 📊 Layer 2 — Audit & Permissions

### 2.1 Audit Log
جدول جديد `email_template_audit_log`:
- `template_id`, `actor_id`, `action` (created/updated/deleted/activated/deactivated/duplicated/imported/restored)
- `changes jsonb` (diff بين before/after — بس للـ fields اللي اتغيرت)
- `created_at`
- Trigger على `email_templates` يـ insert تلقائي

في الـ UI: تبويب **History** جوه TemplateEditorDialog يعرض timeline لكل التغييرات + من عملها.

### 2.2 Permissions
نضيف enum `template_permission_level`: `viewer | editor | admin`
- **viewer**: يشوف القوالب + preview بس (مفيش edit/delete/import)
- **editor**: يعدل + يحفظ versions، مفيش delete أو import/bulk
- **admin**: full access (delete, import, permissions, restore versions)

نـ map للـ user_roles الموجودة:
- `admin` → admin
- `reception` → editor (configurable لاحقاً)
- باقي الأدوار → viewer (لو دخلوا الصفحة أصلاً، حالياً مش مسموح)

كل action في الـ UI يتحقق من الـ permission وي disable الزرار للـ unauthorized.

---

## 🔄 Layer 3 — Versioning & Rollback

### 3.1 Template Versions
جدول جديد `email_template_versions`:
- `template_id`, `version_number` (auto-increment per template)
- snapshot كامل لكل الحقول (subject_en/ar, body_html_en/ar, body_telegram_*, audience, is_active)
- `created_by`, `created_at`, `change_note text`

كل **save** يعمل version جديد تلقائي. الـ `email_templates` row يمثل آخر version (الـ "head").

### 3.2 Version History UI
في الـ TemplateEditorDialog، تبويب **Versions**:
- Timeline لكل النسخ مع اسم اللي عدّلها + timestamp + change note
- زر **Compare** يعرض diff بين أي نسختين (subject + body) side-by-side
- زر **Restore** يرجّع نسخة قديمة (يعمل version جديد بنفس المحتوى — مفيش حذف)
- Pagination لو النسخ كتير

### 3.3 Import/Export Safety
**Export**: يـ include `version_number` و `exported_at` و `schema_version` (نبدأ بـ 1).

**Import** يبقى عملية متعددة الخطوات:
1. **Upload** للـ JSON
2. **Schema validation**: نتحقق من `schema_version` متوافق
3. **Diff Preview**: لكل قالب نعرض:
   - 🆕 **New** (هيتنشأ)
   - ✏️ **Modified** (موجود وهيتغير) + diff للحقول
   - ⚠️ **Conflict** (الـ updated_at في الـ JSON أقدم من اللي في DB)
   - ⏭️ **Unchanged** (هيتسكب)
4. **Conflict Resolution Mode** (radio):
   - **Overwrite**: استبدل الموجود (يعمل version snapshot قبلها)
   - **Skip conflicts**: سيب الـ conflicts زي ما هي
   - **Duplicate**: انشئ القوالب الجاية كـ نسخ جديدة (`name + " (imported)"`)
5. **Confirm & Apply** — في **transaction واحدة**، مع:
   - Snapshot لكل القوالب اللي هتتغير قبل الـ apply (للـ rollback)
   - تسجيل في `email_template_audit_log` (action: `imported`, details: file name + count)
6. **Rollback button** بعد الـ import (متاح ساعة كاملة) — يرجّع كل التغييرات في الـ batch ده

---

## 🎨 UI/UX — Master/Detail Layout

### Sidebar (مع scalability)
```
┌─────────────────┐
│ 🔍 Search...    │  ← search جوه الـ sidebar
├─────────────────┤
│ ▼ Audiences     │  ← collapsible groups
│   👨‍🎓 Students (15) │
│   👨‍👩‍👧 Parents (8)  │
│   👨‍🏫 Instructors  │
│   🛡 Staff       │
│ ▼ Categories    │  ← collapsible
│   • Sessions    │
│   • Academic    │
│   • Financial   │
│   ...           │
│ ▼ Status        │
│   🟢 Working    │
│   🟡 Incomplete │
│   🔴 Errors     │
└─────────────────┘
```
- **Lazy load** counts (مش query واحدة كبيرة) — query لكل group on-demand
- **Collapsible groups** (افتراضياً مفتوحة للـ active filter)

### Card View — Priority Hierarchy
كل كارت يعرض **بس**:
- **Name** (bold)
- **Channel status icons** (🟢🟡🔴 لكل قناة)
- **Linked events count** (badge)

عند الـ **hover** يظهر:
- Description, last updated, last edited by
- Quick actions: Edit, Duplicate, Test, Toggle active

### Linked Events — Bidirectional
في الـ TemplateEditorDialog، تبويب **Linked Events**:
- جدول صغير بكل الـ events المربوطة بالقالب
- لكل صف: event name, audience, channels, enabled toggle
- زر **Edit mapping** يفتح inline editor (مش redirect)
- زر **Add new mapping** يربط الـ event ده بـ audience تاني

### TemplateEditorDialog — Split View
```
┌─────────────────────────────────────────────────────┐
│ Header: [Name] [Audience] [Active] [Permission badge]│
├─────────────────────────────────────────────────────┤
│ Tabs: [📧 Email] [✉ Telegram] [Linked] [History] [Versions]│
├──────────────────────┬──────────────────────────────┤
│ Editor (left)        │ Live Preview (right)         │
│ [AR | EN]            │ [AR | EN]                    │
│ Subject input        │ Subject rendered             │
│ Body editor          │ Body rendered                │
│ ─────────────        │ (deterministic mock data)    │
│ Variables panel:     │                              │
│  📌 {{name}} ✓      │ Validation banner:           │
│  📌 {{date}} ✗     │  ⚠ Missing var: {{date}}    │
│  📌 {{link}} ✓      │                              │
└──────────────────────┴──────────────────────────────┘
│ Footer: [Send Test] [Cancel] [Save (creates v#)]   │
└─────────────────────────────────────────────────────┘
```

### Toolbar
- Search (name + content)
- Filters (audience, channel status, active/inactive)
- **Bulk actions** (admin only): activate/deactivate/export/delete
- **Export JSON** (selected or all)
- **Import JSON** (multi-step dialog)
- **New template**

---

## 📂 الملفات الجديدة والمعدّلة

### Database (Migration)
- جدول `email_template_versions` (history snapshots)
- جدول `email_template_audit_log` (audit trail)
- column جديد `validation_status jsonb` على `email_templates`
- column جديد `preview_data jsonb` على `email_event_catalog`
- Trigger `email_templates_audit_trigger` (insert في audit log)
- Trigger `email_templates_version_trigger` (insert في versions on update)
- RPC `restore_email_template_version(version_id uuid)`
- RPC `import_email_templates_batch(payload jsonb, mode text)` (transactional + rollback support)
- RLS policies جديدة للجدولين

### Edge Functions
- `validate-template` — يـ parse template + variables ويرجّع errors/warnings
- `send-test-email` — يبعت test email/telegram للـ current user (يستخدم send-email + send-telegram)

### Frontend — Created
- `src/lib/templateValidation.ts` — variable parser + schema validator
- `src/lib/templateExport.ts` — JSON import/export helpers + diff calculator
- `src/lib/templatePermissions.ts` — permission checks
- `src/components/email/TemplatesSidebar.tsx` — collapsible sidebar with search
- `src/components/email/TemplateCard.tsx` — minimal card with hover details
- `src/components/email/TemplatePreviewPanel.tsx` — deterministic live preview
- `src/components/email/TemplateValidationBanner.tsx` — errors/warnings display
- `src/components/email/TemplateImportDialog.tsx` — multi-step import (upload → diff → resolve → apply)
- `src/components/email/TemplateVersionsTab.tsx` — versions list + compare + restore
- `src/components/email/TemplateHistoryTab.tsx` — audit log timeline
- `src/components/email/TemplateLinkedEventsTab.tsx` — bidirectional event mappings
- `src/components/email/SendTestDialog.tsx` — test send UI
- `src/components/email/ChannelStatusIcon.tsx` — 3-state status icon
- `src/hooks/useTemplatePermissions.ts` — permission hook

### Frontend — Edited
- `src/pages/EmailTemplates.tsx` — Master/Detail layout + bulk actions + import/export
- `src/components/email/TemplateEditorDialog.tsx` — Split view + tabs (Email/Telegram/Linked/History/Versions) + validation

---

## 🚧 Out of Scope (لاحقاً — مش دلوقتي)

اقتراحاتك دي قوية بس بتحتاج infrastructure منفصلة:
- **A/B Testing**: يحتاج مقاييس + traffic splitting + statistical engine — مرحلة منفصلة
- **Performance Tracking** (open rate / click rate / delivery rate): الجزء الأكبر منها موجود فعلاً في `email_send_log` و `email_delivery_events` (delivered/bounced/complained) — هنحتاج Dashboard منفصل يعرضها بـ charts (مش جزء من template editor)

هنعمل لها خطة منفصلة بعد ما الـ governance layer ده يستقر.

---

## ترتيب التنفيذ

**Phase 1 — Foundation (Safety + Audit + Versioning)**
1. Migration: versions table + audit log + validation_status + preview_data + triggers + RPCs
2. `templateValidation.ts` + `templatePermissions.ts` + `templateExport.ts`
3. `useTemplatePermissions` hook

**Phase 2 — Editor Upgrade**
4. TemplateEditorDialog split view + tabs (Email/Telegram)
5. Live preview panel + validation banner
6. Versions tab + History tab + Linked Events tab
7. Send Test dialog

**Phase 3 — List Page UX**
8. Master/Detail layout + Sidebar (collapsible + search + lazy counts)
9. Card view + 3-state channel status
10. Bulk actions (permission-gated)

**Phase 4 — Import/Export**
11. Export JSON (with versioning metadata)
12. Multi-step Import dialog (upload → diff → resolve → apply → rollback)
