// Pre-built question library for job application forms.
// Each entry can be added as-is to a job's form_fields.

export interface JobFormField {
  key: string;
  type:
    | "short_text"
    | "long_text"
    | "email"
    | "phone"
    | "number"
    | "date"
    | "url"
    | "file_upload"
    | "single_choice"
    | "multi_choice";
  label_en: string;
  label_ar: string;
  placeholder_en?: string;
  placeholder_ar?: string;
  required?: boolean;
  accept?: string; // for file_upload
  options?: Array<{ value: string; label_en: string; label_ar: string }>;
  min?: number;
  max?: number;
  reserved?: boolean; // built-in keys cannot be removed
}

// Reserved core fields — always present, cannot be removed
export const RESERVED_FIELDS: JobFormField[] = [
  { key: "full_name", type: "short_text", label_en: "Full Name", label_ar: "الاسم الكامل", required: true, reserved: true },
  { key: "email", type: "email", label_en: "Email", label_ar: "البريد الإلكتروني", required: true, reserved: true },
  { key: "phone", type: "phone", label_en: "Phone", label_ar: "رقم الهاتف", required: true, reserved: true },
  { key: "cv", type: "file_upload", label_en: "CV / Resume (PDF)", label_ar: "السيرة الذاتية (PDF)", required: true, accept: ".pdf,.doc,.docx", reserved: true },
];

// Library of common pre-built questions admin can add with one click
export const QUESTION_LIBRARY: JobFormField[] = [
  {
    key: "graduation_year",
    type: "number",
    label_en: "Graduation Year",
    label_ar: "سنة التخرج",
    placeholder_en: "e.g. 2025",
    placeholder_ar: "مثال: 2025",
    required: true,
    min: 1990,
    max: 2035,
  },
  {
    key: "university",
    type: "short_text",
    label_en: "University / College",
    label_ar: "الجامعة / الكلية",
    placeholder_en: "Cairo University - Faculty of Engineering",
    placeholder_ar: "جامعة القاهرة - كلية الهندسة",
    required: true,
  },
  {
    key: "major",
    type: "short_text",
    label_en: "Major / Field of Study",
    label_ar: "التخصص / المجال الدراسي",
    placeholder_en: "Computer Science",
    placeholder_ar: "علوم الحاسب",
  },
  {
    key: "gpa",
    type: "short_text",
    label_en: "GPA / Grade",
    label_ar: "المعدل التراكمي / التقدير",
    placeholder_en: "3.5 / Very Good",
    placeholder_ar: "3.5 / جيد جداً",
  },
  {
    key: "years_of_experience",
    type: "single_choice",
    label_en: "Years of Experience",
    label_ar: "سنوات الخبرة",
    required: true,
    options: [
      { value: "fresh", label_en: "Fresh Graduate", label_ar: "حديث التخرج" },
      { value: "0-1", label_en: "Less than 1 year", label_ar: "أقل من سنة" },
      { value: "1-3", label_en: "1-3 years", label_ar: "1-3 سنوات" },
      { value: "3-5", label_en: "3-5 years", label_ar: "3-5 سنوات" },
      { value: "5+", label_en: "5+ years", label_ar: "أكثر من 5 سنوات" },
    ],
  },
  {
    key: "linkedin_url",
    type: "url",
    label_en: "LinkedIn Profile",
    label_ar: "حساب LinkedIn",
    placeholder_en: "https://linkedin.com/in/username",
    placeholder_ar: "https://linkedin.com/in/username",
  },
  {
    key: "github_url",
    type: "url",
    label_en: "GitHub / Portfolio URL",
    label_ar: "رابط GitHub / معرض الأعمال",
    placeholder_en: "https://github.com/username",
    placeholder_ar: "https://github.com/username",
  },
  {
    key: "motivation",
    type: "long_text",
    label_en: "Why do you want to join us?",
    label_ar: "لماذا ترغب في الانضمام إلينا؟",
    placeholder_en: "Tell us in a few sentences...",
    placeholder_ar: "أخبرنا في بضع جمل...",
    required: true,
  },
  {
    key: "skills",
    type: "long_text",
    label_en: "Key Skills (comma-separated)",
    label_ar: "المهارات الأساسية (مفصولة بفواصل)",
    placeholder_en: "React, TypeScript, Node.js",
    placeholder_ar: "React، TypeScript، Node.js",
  },
  {
    key: "availability",
    type: "single_choice",
    label_en: "When can you start?",
    label_ar: "متى يمكنك البدء؟",
    options: [
      { value: "immediately", label_en: "Immediately", label_ar: "فوراً" },
      { value: "2_weeks", label_en: "Within 2 weeks", label_ar: "خلال أسبوعين" },
      { value: "1_month", label_en: "Within 1 month", label_ar: "خلال شهر" },
      { value: "more", label_en: "More than a month", label_ar: "أكثر من شهر" },
    ],
  },
  {
    key: "preferred_work_mode",
    type: "single_choice",
    label_en: "Preferred Work Mode",
    label_ar: "نمط العمل المفضل",
    options: [
      { value: "onsite", label_en: "On-site", label_ar: "حضوري" },
      { value: "remote", label_en: "Remote", label_ar: "عن بُعد" },
      { value: "hybrid", label_en: "Hybrid", label_ar: "مختلط" },
    ],
  },
  {
    key: "expected_salary",
    type: "short_text",
    label_en: "Expected Salary (EGP)",
    label_ar: "الراتب المتوقع (ج.م)",
    placeholder_en: "10000",
    placeholder_ar: "10000",
  },
  {
    key: "heard_from",
    type: "single_choice",
    label_en: "How did you hear about us?",
    label_ar: "كيف سمعت عنّا؟",
    options: [
      { value: "linkedin", label_en: "LinkedIn", label_ar: "LinkedIn" },
      { value: "facebook", label_en: "Facebook", label_ar: "Facebook" },
      { value: "friend", label_en: "Friend / Colleague", label_ar: "صديق / زميل" },
      { value: "website", label_en: "Our Website", label_ar: "موقعنا" },
      { value: "other", label_en: "Other", label_ar: "أخرى" },
    ],
  },
];

export const FIELD_TYPES: Array<{ value: JobFormField["type"]; label_en: string; label_ar: string }> = [
  { value: "short_text", label_en: "Short Text", label_ar: "نص قصير" },
  { value: "long_text", label_en: "Long Text", label_ar: "نص طويل" },
  { value: "email", label_en: "Email", label_ar: "بريد إلكتروني" },
  { value: "phone", label_en: "Phone", label_ar: "هاتف" },
  { value: "number", label_en: "Number", label_ar: "رقم" },
  { value: "date", label_en: "Date", label_ar: "تاريخ" },
  { value: "url", label_en: "URL / Link", label_ar: "رابط" },
  { value: "file_upload", label_en: "File Upload", label_ar: "رفع ملف" },
  { value: "single_choice", label_en: "Single Choice", label_ar: "اختيار واحد" },
  { value: "multi_choice", label_en: "Multiple Choice", label_ar: "اختيار متعدد" },
];

export function generateFieldKey(label: string, existing: string[]): string {
  let base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  if (!base) base = "field";
  let key = base;
  let i = 1;
  while (existing.includes(key)) {
    key = `${base}_${i++}`;
  }
  return key;
}
