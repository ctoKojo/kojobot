// Pre-built question library for job application forms.
// Each entry can be added as-is to a job's form_fields.

export type QuestionCategory = "basic" | "experience" | "skills" | "preferences";

export const CATEGORY_ORDER: QuestionCategory[] = ["basic", "experience", "skills", "preferences"];

export const CATEGORY_LABELS: Record<QuestionCategory, { en: string; ar: string }> = {
  basic:       { en: "Basic Info",   ar: "معلومات أساسية" },
  experience:  { en: "Experience",   ar: "الخبرة" },
  skills:      { en: "Skills",       ar: "المهارات" },
  preferences: { en: "Preferences",  ar: "التفضيلات" },
};

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
  category?: QuestionCategory;
}

// Reserved core fields — always present, cannot be removed
export const RESERVED_FIELDS: JobFormField[] = [
  { key: "full_name", type: "short_text", label_en: "Full Name", label_ar: "الاسم الكامل", required: true, reserved: true },
  { key: "email", type: "email", label_en: "Email", label_ar: "البريد الإلكتروني", required: true, reserved: true },
  { key: "phone", type: "phone", label_en: "Phone", label_ar: "رقم الهاتف", required: true, reserved: true },
  {
    key: "location",
    type: "single_choice",
    label_en: "Governorate",
    label_ar: "المحافظة",
    required: true,
    reserved: true,
    options: [
      { value: "cairo",        label_en: "Cairo",         label_ar: "القاهرة" },
      { value: "giza",         label_en: "Giza",          label_ar: "الجيزة" },
      { value: "alexandria",   label_en: "Alexandria",    label_ar: "الإسكندرية" },
      { value: "qalyubia",     label_en: "Qalyubia",      label_ar: "القليوبية" },
      { value: "sharqia",      label_en: "Sharqia",       label_ar: "الشرقية" },
      { value: "dakahlia",     label_en: "Dakahlia",      label_ar: "الدقهلية" },
      { value: "gharbia",      label_en: "Gharbia",       label_ar: "الغربية" },
      { value: "menoufia",     label_en: "Menoufia",      label_ar: "المنوفية" },
      { value: "beheira",      label_en: "Beheira",       label_ar: "البحيرة" },
      { value: "kafr_sheikh",  label_en: "Kafr El Sheikh", label_ar: "كفر الشيخ" },
      { value: "damietta",     label_en: "Damietta",      label_ar: "دمياط" },
      { value: "port_said",    label_en: "Port Said",     label_ar: "بورسعيد" },
      { value: "ismailia",     label_en: "Ismailia",      label_ar: "الإسماعيلية" },
      { value: "suez",         label_en: "Suez",          label_ar: "السويس" },
      { value: "fayoum",       label_en: "Fayoum",        label_ar: "الفيوم" },
      { value: "beni_suef",    label_en: "Beni Suef",     label_ar: "بني سويف" },
      { value: "minya",        label_en: "Minya",         label_ar: "المنيا" },
      { value: "assiut",       label_en: "Assiut",        label_ar: "أسيوط" },
      { value: "sohag",        label_en: "Sohag",         label_ar: "سوهاج" },
      { value: "qena",         label_en: "Qena",          label_ar: "قنا" },
      { value: "luxor",        label_en: "Luxor",         label_ar: "الأقصر" },
      { value: "aswan",        label_en: "Aswan",         label_ar: "أسوان" },
      { value: "red_sea",      label_en: "Red Sea",       label_ar: "البحر الأحمر" },
      { value: "new_valley",   label_en: "New Valley",    label_ar: "الوادي الجديد" },
      { value: "matrouh",      label_en: "Matrouh",       label_ar: "مطروح" },
      { value: "north_sinai",  label_en: "North Sinai",   label_ar: "شمال سيناء" },
      { value: "south_sinai",  label_en: "South Sinai",   label_ar: "جنوب سيناء" },
      { value: "outside_egypt", label_en: "Outside Egypt", label_ar: "خارج مصر" },
    ],
  },
  {
    key: "city",
    type: "single_choice",
    label_en: "City / Markaz",
    label_ar: "المدينة / المركز",
    required: true,
    reserved: true,
    // Options are populated dynamically by the form based on selected governorate.
    // The "depends_on" hint is consumed by the public form renderer.
    options: [],
    // @ts-ignore — extra hint, ignored by other consumers
    depends_on: "location",
  } as JobFormField,
  { key: "cv", type: "file_upload", label_en: "CV / Resume (PDF)", label_ar: "السيرة الذاتية (PDF)", required: true, accept: ".pdf,.doc,.docx", reserved: true },
];

// Library of common pre-built questions admin can add with one click
export const QUESTION_LIBRARY: JobFormField[] = [
  // ============== BASIC INFO ==============
  {
    key: "city",
    category: "basic",
    type: "short_text",
    label_en: "City / Area of Residence",
    label_ar: "المدينة / المنطقة",
    placeholder_en: "Nasr City",
    placeholder_ar: "مدينة نصر",
  },
  {
    key: "nationality",
    category: "basic",
    type: "short_text",
    label_en: "Nationality",
    label_ar: "الجنسية",
    placeholder_en: "Egyptian",
    placeholder_ar: "مصري",
  },
  {
    key: "date_of_birth",
    category: "basic",
    type: "date",
    label_en: "Date of Birth",
    label_ar: "تاريخ الميلاد",
  },
  {
    key: "gender",
    category: "basic",
    type: "single_choice",
    label_en: "Gender",
    label_ar: "النوع",
    options: [
      { value: "male",   label_en: "Male",   label_ar: "ذكر" },
      { value: "female", label_en: "Female", label_ar: "أنثى" },
    ],
  },
  {
    key: "linkedin_url",
    category: "basic",
    type: "url",
    label_en: "LinkedIn Profile",
    label_ar: "حساب LinkedIn",
    placeholder_en: "https://linkedin.com/in/username",
    placeholder_ar: "https://linkedin.com/in/username",
  },
  {
    key: "github_url",
    category: "basic",
    type: "url",
    label_en: "GitHub / Portfolio URL",
    label_ar: "رابط GitHub / معرض الأعمال",
    placeholder_en: "https://github.com/username",
    placeholder_ar: "https://github.com/username",
  },
  {
    key: "heard_from",
    category: "basic",
    type: "single_choice",
    label_en: "How did you hear about us?",
    label_ar: "كيف سمعت عنّا؟",
    options: [
      { value: "linkedin",  label_en: "LinkedIn",          label_ar: "LinkedIn" },
      { value: "facebook",  label_en: "Facebook",          label_ar: "Facebook" },
      { value: "instagram", label_en: "Instagram",         label_ar: "إنستجرام" },
      { value: "friend",    label_en: "Friend / Colleague", label_ar: "صديق / زميل" },
      { value: "website",   label_en: "Our Website",       label_ar: "موقعنا" },
      { value: "google",    label_en: "Google Search",     label_ar: "بحث جوجل" },
      { value: "other",     label_en: "Other",             label_ar: "أخرى" },
    ],
  },

  // ============== EXPERIENCE ==============
  {
    key: "graduation_year",
    category: "experience",
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
    category: "experience",
    type: "short_text",
    label_en: "University / College",
    label_ar: "الجامعة / الكلية",
    placeholder_en: "Cairo University - Faculty of Engineering",
    placeholder_ar: "جامعة القاهرة - كلية الهندسة",
    required: true,
  },
  {
    key: "major",
    category: "experience",
    type: "short_text",
    label_en: "Major / Field of Study",
    label_ar: "التخصص / المجال الدراسي",
    placeholder_en: "Computer Science",
    placeholder_ar: "علوم الحاسب",
  },
  {
    key: "gpa",
    category: "experience",
    type: "short_text",
    label_en: "GPA / Grade",
    label_ar: "المعدل التراكمي / التقدير",
    placeholder_en: "3.5 / Very Good",
    placeholder_ar: "3.5 / جيد جداً",
  },
  {
    key: "years_of_experience",
    category: "experience",
    type: "single_choice",
    label_en: "Years of Experience",
    label_ar: "سنوات الخبرة",
    required: true,
    options: [
      { value: "fresh", label_en: "Fresh Graduate",   label_ar: "حديث التخرج" },
      { value: "0-1",   label_en: "Less than 1 year", label_ar: "أقل من سنة" },
      { value: "1-3",   label_en: "1-3 years",        label_ar: "1-3 سنوات" },
      { value: "3-5",   label_en: "3-5 years",        label_ar: "3-5 سنوات" },
      { value: "5+",    label_en: "5+ years",         label_ar: "أكثر من 5 سنوات" },
    ],
  },
  {
    key: "previous_companies",
    category: "experience",
    type: "long_text",
    label_en: "Previous Companies / Roles",
    label_ar: "الشركات / الأدوار السابقة",
    placeholder_en: "Company name - Role - Duration",
    placeholder_ar: "اسم الشركة - المنصب - المدة",
  },
  {
    key: "certifications",
    category: "experience",
    type: "long_text",
    label_en: "Certifications & Courses",
    label_ar: "الشهادات والدورات",
    placeholder_en: "AWS Certified, Coursera ML, ...",
    placeholder_ar: "AWS، كورسيرا، ...",
  },
  {
    key: "portfolio_file",
    category: "experience",
    type: "file_upload",
    label_en: "Portfolio / Sample Work (PDF)",
    label_ar: "نموذج أعمال / Portfolio (PDF)",
    accept: ".pdf,.zip",
  },

  // ============== SKILLS ==============
  {
    key: "skills",
    category: "skills",
    type: "long_text",
    label_en: "Key Skills (comma-separated)",
    label_ar: "المهارات الأساسية (مفصولة بفواصل)",
    placeholder_en: "React, TypeScript, Node.js",
    placeholder_ar: "React، TypeScript، Node.js",
  },
  {
    key: "english_level",
    category: "skills",
    type: "single_choice",
    label_en: "English Proficiency",
    label_ar: "مستوى اللغة الإنجليزية",
    options: [
      { value: "basic",        label_en: "Basic",            label_ar: "مبتدئ" },
      { value: "intermediate", label_en: "Intermediate",     label_ar: "متوسط" },
      { value: "advanced",     label_en: "Advanced",         label_ar: "متقدم" },
      { value: "native",       label_en: "Native / Fluent",  label_ar: "إجادة تامة" },
    ],
  },
  {
    key: "arabic_level",
    category: "skills",
    type: "single_choice",
    label_en: "Arabic Proficiency",
    label_ar: "مستوى اللغة العربية",
    options: [
      { value: "basic",        label_en: "Basic",        label_ar: "مبتدئ" },
      { value: "intermediate", label_en: "Intermediate", label_ar: "متوسط" },
      { value: "advanced",     label_en: "Advanced",     label_ar: "متقدم" },
      { value: "native",       label_en: "Native",       label_ar: "اللغة الأم" },
    ],
  },
  {
    key: "has_laptop",
    category: "skills",
    type: "single_choice",
    label_en: "Do you own a laptop?",
    label_ar: "هل تمتلك لاب توب؟",
    options: [
      { value: "yes", label_en: "Yes", label_ar: "نعم" },
      { value: "no",  label_en: "No",  label_ar: "لا" },
    ],
  },

  // ============== PREFERENCES ==============
  {
    key: "available_work_days",
    category: "preferences",
    type: "multi_choice",
    label_en: "Available Work Days",
    label_ar: "أيام العمل المتاحة",
    required: true,
    options: [
      { value: "saturday",  label_en: "Saturday",  label_ar: "السبت" },
      { value: "sunday",    label_en: "Sunday",    label_ar: "الأحد" },
      { value: "monday",    label_en: "Monday",    label_ar: "الاثنين" },
      { value: "tuesday",   label_en: "Tuesday",   label_ar: "الثلاثاء" },
      { value: "wednesday", label_en: "Wednesday", label_ar: "الأربعاء" },
      { value: "thursday",  label_en: "Thursday",  label_ar: "الخميس" },
      { value: "friday",    label_en: "Friday",    label_ar: "الجمعة" },
    ],
  },
  {
    key: "available_hours_per_week",
    category: "preferences",
    type: "single_choice",
    label_en: "Available Hours per Week",
    label_ar: "عدد الساعات المتاحة أسبوعياً",
    options: [
      { value: "lt_10",   label_en: "Less than 10 hours", label_ar: "أقل من 10 ساعات" },
      { value: "10_20",   label_en: "10 - 20 hours",      label_ar: "10 - 20 ساعة" },
      { value: "20_30",   label_en: "20 - 30 hours",      label_ar: "20 - 30 ساعة" },
      { value: "30_40",   label_en: "30 - 40 hours",      label_ar: "30 - 40 ساعة" },
      { value: "full",    label_en: "Full-time (40+)",    label_ar: "دوام كامل (40+)" },
    ],
  },
  {
    key: "preferred_shift",
    category: "preferences",
    type: "single_choice",
    label_en: "Preferred Shift",
    label_ar: "الوردية المفضلة",
    options: [
      { value: "morning",   label_en: "Morning",   label_ar: "صباحية" },
      { value: "afternoon", label_en: "Afternoon", label_ar: "ظهيرة" },
      { value: "evening",   label_en: "Evening",   label_ar: "مسائية" },
      { value: "flexible",  label_en: "Flexible",  label_ar: "مرنة" },
    ],
  },
  {
    key: "availability",
    category: "preferences",
    type: "single_choice",
    label_en: "When can you start?",
    label_ar: "متى يمكنك البدء؟",
    options: [
      { value: "immediately", label_en: "Immediately",      label_ar: "فوراً" },
      { value: "2_weeks",     label_en: "Within 2 weeks",   label_ar: "خلال أسبوعين" },
      { value: "1_month",     label_en: "Within 1 month",   label_ar: "خلال شهر" },
      { value: "more",        label_en: "More than a month", label_ar: "أكثر من شهر" },
    ],
  },
  {
    key: "preferred_work_mode",
    category: "preferences",
    type: "single_choice",
    label_en: "Preferred Work Mode",
    label_ar: "نمط العمل المفضل",
    options: [
      { value: "onsite", label_en: "On-site", label_ar: "حضوري" },
      { value: "remote", label_en: "Remote",  label_ar: "عن بُعد" },
      { value: "hybrid", label_en: "Hybrid",  label_ar: "مختلط" },
    ],
  },
  {
    key: "transportation",
    category: "preferences",
    type: "single_choice",
    label_en: "Do you have personal transportation?",
    label_ar: "هل تمتلك وسيلة مواصلات خاصة؟",
    options: [
      { value: "car",    label_en: "Car",            label_ar: "سيارة" },
      { value: "public", label_en: "Public transit", label_ar: "مواصلات عامة" },
      { value: "none",   label_en: "None",           label_ar: "لا يوجد" },
    ],
  },
  {
    key: "willing_to_relocate",
    category: "preferences",
    type: "single_choice",
    label_en: "Willing to relocate?",
    label_ar: "مستعد للانتقال للسكن في موقع آخر؟",
    options: [
      { value: "yes",   label_en: "Yes",   label_ar: "نعم" },
      { value: "no",    label_en: "No",    label_ar: "لا" },
      { value: "maybe", label_en: "Maybe", label_ar: "ربما" },
    ],
  },
  {
    key: "notice_period",
    category: "preferences",
    type: "single_choice",
    label_en: "Current Notice Period",
    label_ar: "فترة الإشعار الحالية",
    options: [
      { value: "none",     label_en: "None",      label_ar: "لا يوجد" },
      { value: "2_weeks",  label_en: "2 weeks",   label_ar: "أسبوعين" },
      { value: "1_month",  label_en: "1 month",   label_ar: "شهر" },
      { value: "2_months", label_en: "2 months",  label_ar: "شهرين" },
      { value: "3_months", label_en: "3+ months", label_ar: "3 شهور أو أكثر" },
    ],
  },
  {
    key: "expected_salary",
    category: "preferences",
    type: "short_text",
    label_en: "Expected Salary (EGP)",
    label_ar: "الراتب المتوقع (ج.م)",
    placeholder_en: "10000",
    placeholder_ar: "10000",
  },
  {
    key: "motivation",
    category: "preferences",
    type: "long_text",
    label_en: "Why do you want to join us?",
    label_ar: "لماذا ترغب في الانضمام إلينا؟",
    placeholder_en: "Tell us in a few sentences...",
    placeholder_ar: "أخبرنا في بضع جمل...",
    required: true,
  },
  {
    key: "cover_letter",
    category: "preferences",
    type: "long_text",
    label_en: "Cover Letter",
    label_ar: "خطاب تعريفي",
    placeholder_en: "Briefly introduce yourself...",
    placeholder_ar: "عرّفنا بنفسك باختصار...",
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
