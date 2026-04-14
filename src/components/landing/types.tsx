import {
  Monitor, BookOpen, BarChart3, Award, Cpu, Code, Puzzle, Bot, Palette,
  Instagram, Facebook, MessageCircle
} from "lucide-react";

export interface SocialLink {
  platform: string;
  url: string;
}

export interface LandingContent {
  settings: {
    hero_title_en: string;
    hero_title_ar: string;
    hero_subtitle_en: string;
    hero_subtitle_ar: string;
    cta_text_en: string;
    cta_text_ar: string;
    cta_url: string;
    footer_text_en: string;
    footer_text_ar: string;
    logo_url?: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
    address_en?: string;
    address_ar?: string;
    social_links?: SocialLink[];
  };
  features: {
    id: string;
    icon_name: string;
    sort_order: number;
    title_en: string;
    title_ar: string;
    desc_en: string;
    desc_ar: string;
  }[];
  plans: {
    id: string;
    name_en: string;
    name_ar: string;
    price_number: number;
    price_online: number;
    price_currency: string;
    price_before_discount: number;
    price_online_before_discount: number;
    billing_period_en: string;
    billing_period_ar: string;
    mode: string;
    is_featured: boolean;
    sort_order: number;
    sessions_per_month?: number;
    session_duration_minutes?: number;
    description_en?: string;
    description_ar?: string;
    slug?: string;
    benefits: { id: string; text_en: string; text_ar: string; sort_order: number }[];
  }[];
  tracks: {
    id: string;
    age_group: string;
    sort_order: number;
    title_en: string;
    title_ar: string;
    intro_en: string;
    intro_ar: string;
    steps: {
      id: string;
      step_number: number;
      path_type: string;
      title_en: string;
      title_ar: string;
      desc_en: string;
      desc_ar: string;
      specializations?: string[];
    }[];
  }[];
  testimonials?: {
    id: string;
    parent_name: string;
    parent_name_ar?: string;
    content_en?: string;
    content_ar?: string;
    rating: number;
    sort_order: number;
  }[];
}

export const iconMap: Record<string, React.ElementType> = {
  Monitor, BookOpen, BarChart3, Award, Cpu, Code, Puzzle, Bot, Palette,
};

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className || "w-7 h-7"}>
    <path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z" />
  </svg>
);

export const socialIconMap: Record<string, React.ElementType | (() => JSX.Element)> = {
  instagram: Instagram,
  facebook: Facebook,
  tiktok: TikTokIcon,
  whatsapp: MessageCircle,
};

export const socialLabelMap: Record<string, { en: string; ar: string }> = {
  instagram: { en: "Instagram", ar: "انستجرام" },
  facebook: { en: "Facebook", ar: "فيسبوك" },
  tiktok: { en: "TikTok", ar: "تيك توك" },
  whatsapp: { en: "WhatsApp", ar: "واتساب" },
};

export const navSections = [
  { id: "features", en: "Features", ar: "المميزات" },
  { id: "tracks", en: "Tracks", ar: "المسارات" },
  { id: "plans", en: "Plans", ar: "الباقات" },
  { id: "testimonials", en: "Reviews", ar: "آراء" },
  { id: "faq", en: "FAQ", ar: "الأسئلة" },
  { id: "contact", en: "Contact", ar: "تواصل" },
];

export const faqData = [
  {
    q_en: "What is Kojobot?",
    q_ar: "ما هو كوجوبوت؟",
    a_en: "Kojobot is an integrated platform for teaching coding and technology to children and teenagers, offering structured learning tracks tailored for different age groups.",
    a_ar: "كوجوبوت هو منصة متكاملة لتعليم البرمجة والتكنولوجيا للأطفال والمراهقين، تقدم مسارات تعليمية منظمة مصممة لمختلف الفئات العمرية.",
  },
  {
    q_en: "What age groups do you accept?",
    q_ar: "ما الأعمار المناسبة؟",
    a_en: "We accept students from ages 6 to 18, with specialized tracks for each age group: 6-9 years, 10-13 years, and 14-18 years.",
    a_ar: "نقبل الطلاب من سن 6 إلى 18 سنة، مع مسارات متخصصة لكل فئة عمرية: 6-9 سنوات، 10-13 سنة، و14-18 سنة.",
  },
  {
    q_en: "How are the sessions conducted?",
    q_ar: "كيف تتم الحصص؟",
    a_en: "Sessions are conducted online or offline with qualified instructors. Each session is 120 minutes with 4 sessions per month.",
    a_ar: "تتم الحصص أونلاين أو أوفلاين مع مدربين مؤهلين. مدة كل حصة 120 دقيقة بواقع 4 حصص في الشهر.",
  },
  {
    q_en: "Is there a free trial?",
    q_ar: "هل يوجد تجربة مجانية؟",
    a_en: "Yes! We offer a free trial session so your child can experience our teaching method before committing to a plan.",
    a_ar: "نعم! نقدم حصة تجريبية مجانية حتى يتمكن طفلك من تجربة طريقة التعليم قبل الاشتراك في أي باقة.",
  },
  {
    q_en: "What is the difference between plans?",
    q_ar: "ما الفرق بين الباقات؟",
    a_en: "KOJO SQUAD offers small group sessions. KOJO CORE adds summary videos, homework support, and learning materials. KOJO X provides private 1-on-1 sessions with full recordings and weekly reports.",
    a_ar: "كوجو سكواد تقدم حصص في جروب صغير. كوجو كور تضيف فيديو ملخص ودعم في الواجبات. كوجو إكس تقدم حصص فردية مع تسجيل كامل وتقارير أسبوعية.",
  },
  {
    q_en: "What programming languages do you teach?",
    q_ar: "ما لغات البرمجة التي تعلمونها؟",
    a_en: "We teach Scratch for younger students, then progress to Python, web development (HTML/CSS/JavaScript), and advanced topics like robotics and AI.",
    a_ar: "نعلم سكراتش للطلاب الأصغر، ثم بايثون، تطوير الويب، ومواضيع متقدمة مثل الروبوتيكس والذكاء الاصطناعي.",
  },
  {
    q_en: "Do I need to buy a computer for my child?",
    q_ar: "هل أحتاج لشراء كمبيوتر لطفلي؟",
    a_en: "Yes, a laptop or desktop computer is required. A tablet is not sufficient for coding exercises.",
    a_ar: "نعم، يحتاج الطالب لابتوب أو كمبيوتر للحصص. التابلت غير كافي لتمارين البرمجة.",
  },
  {
    q_en: "How do I track my child's progress?",
    q_ar: "كيف أتابع تقدم طفلي؟",
    a_en: "Depending on your plan, you receive monthly or weekly progress reports with detailed performance insights.",
    a_ar: "حسب باقتك، بتستلم تقارير شهرية أو أسبوعية مع تفاصيل الأداء.",
  },
];

export const SITE_URL = "https://kojobot.com";

/** Localization helper */
export const l = (en: string | undefined, ar: string | undefined, language: string) =>
  language === "ar" ? ar || en || "" : en || ar || "";

export const scrollTo = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
