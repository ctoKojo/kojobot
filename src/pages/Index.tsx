import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import kojobotLogo from "@/assets/kojobot-main-logo.png";
import {
  Monitor,
  BookOpen,
  BarChart3,
  Award,
  ArrowRight,
  ArrowLeft,
  Check,
  Cpu,
  Code,
  Puzzle,
  Bot,
  Palette,
  Mail,
  Phone,
  MapPin,
  MessageCircle,
  Instagram,
  Facebook,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

/* ─────────────────────────── types ─────────────────────────── */
const iconMap: Record<string, React.ElementType> = {
  Monitor,
  BookOpen,
  BarChart3,
  Award,
  Cpu,
  Code,
  Puzzle,
  Bot,
  Palette,
};

interface SocialLink {
  platform: string;
  url: string;
}
interface LandingContent {
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
}

/* ─────────────────────────── static data ─────────────────────────── */
const faqData = [
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
    a_en: "KOJO SQUAD offers small group sessions. KOJO CORE adds summary videos and homework support. KOJO X provides private 1-on-1 sessions with full recordings and weekly reports.",
    a_ar: "كوجو سكواد تقدم حصص في جروب صغير. كوجو كور تضيف فيديو ملخص ودعم في الواجبات. كوجو إكس تقدم حصص فردية مع تسجيل كامل وتقارير أسبوعية.",
  },
  {
    q_en: "What programming languages do you teach?",
    q_ar: "ما لغات البرمجة التي تعلمونها؟",
    a_en: "We teach Scratch for younger students, then Python, web development (HTML/CSS/JavaScript), robotics and AI for older students.",
    a_ar: "نعلم سكراتش للطلاب الأصغر، ثم بايثون، تطوير الويب، ومواضيع متقدمة مثل الروبوتيكس والذكاء الاصطناعي.",
  },
  {
    q_en: "Do I need to buy a computer for my child?",
    q_ar: "هل أحتاج لشراء كمبيوتر لطفلي؟",
    a_en: "Yes, a laptop or desktop is required. A tablet is not sufficient for coding exercises.",
    a_ar: "نعم، يحتاج الطالب لابتوب أو كمبيوتر. التابلت غير كافي لتمارين البرمجة.",
  },
  {
    q_en: "How do I track my child's progress?",
    q_ar: "كيف أتابع تقدم طفلي؟",
    a_en: "You receive monthly or weekly progress reports depending on your plan.",
    a_ar: "حسب باقتك، بتستلم تقارير شهرية أو أسبوعية مع تفاصيل الأداء.",
  },
];

const navSections = [
  { id: "features", en: "Features", ar: "المميزات" },
  { id: "tracks", en: "Tracks", ar: "المسارات" },
  { id: "plans", en: "Plans", ar: "الباقات" },
  { id: "faq", en: "FAQ", ar: "الأسئلة" },
  { id: "contact", en: "Contact", ar: "تواصل" },
];

/* ─────────────────────────── icons ─────────────────────────── */
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className || "w-5 h-5"}>
    <path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z" />
  </svg>
);

const socialIconMap: Record<string, React.ElementType> = {
  instagram: Instagram,
  facebook: Facebook,
  tiktok: TikTokIcon,
  whatsapp: MessageCircle,
};
const socialLabelMap: Record<string, { en: string; ar: string }> = {
  instagram: { en: "Instagram", ar: "انستجرام" },
  facebook: { en: "Facebook", ar: "فيسبوك" },
  tiktok: { en: "TikTok", ar: "تيك توك" },
  whatsapp: { en: "WhatsApp", ar: "واتساب" },
};

/* ─────────────────────────── particle canvas ─────────────────────────── */
const ParticleCanvas = ({ isDark }: { isDark: boolean }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const dots = Array.from({ length: 55 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.6 + 0.5,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const dotAlpha = isDark ? "0.45" : "0.25";
      const lineAlpha = isDark ? "0.12" : "0.07";
      dots.forEach((d) => {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0 || d.x > canvas.width) d.vx *= -1;
        if (d.y < 0 || d.y > canvas.height) d.vy *= -1;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(124,58,237,${dotAlpha})`;
        ctx.fill();
      });
      dots.forEach((a, i) =>
        dots.slice(i + 1).forEach((b) => {
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 130) {
            const alpha = parseFloat(lineAlpha) * (1 - dist / 130);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(124,58,237,${alpha.toFixed(3)})`;
            ctx.stroke();
          }
        }),
      );
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [isDark]);
  return <canvas ref={ref} className="fixed inset-0 pointer-events-none z-0" />;
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
const Index = () => {
  const { language, isRTL } = useLanguage();
  const [content, setContent] = useState<LandingContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    supabase.rpc("get_landing_content").then(({ data }) => {
      if (data) setContent(data as unknown as LandingContent);
      setLoading(false);
    });
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll);
    const observer = new MutationObserver(() => setIsDark(document.documentElement.classList.contains("dark")));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  const l = (en?: string, ar?: string) => (language === "ar" ? ar || en || "" : en || ar || "");
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  /* ── loading ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
          <div className="absolute inset-1 rounded-full border-2 border-t-primary border-transparent animate-spin" />
          <div className="absolute inset-3 rounded-full bg-primary/20 animate-pulse" />
        </div>
      </div>
    );
  }

  const s = content?.settings;
  const features = content?.features || [];
  const plans = content?.plans || [];
  const tracks = content?.tracks || [];
  const socialLinks: SocialLink[] = Array.isArray(s?.social_links) ? s!.social_links! : [];

  /* ──────────────── theme-aware design tokens ──────────────── */
  /* All brand colours come from the original kojo-gradient:    */
  /*   primary  → violet-600  #7c3aed                           */
  /*   secondary → pink-600  #db2777                            */
  const GRAD = "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)";

  const T = {
    /* backgrounds */
    bg: isDark ? "#07071a" : "#ffffff",
    bgAlt: isDark ? "#0e0e2a" : "#f8f7ff",
    surface: isDark ? "#0e0e2a" : "#ffffff",
    /* borders */
    border: isDark ? "rgba(124,58,237,0.18)" : "rgba(124,58,237,0.13)",
    borderHover: isDark ? "rgba(124,58,237,0.45)" : "rgba(124,58,237,0.35)",
    /* text */
    text: isDark ? "#f0f0ff" : "#1a1040",
    muted: isDark ? "rgba(240,240,255,0.45)" : "rgba(26,16,64,0.48)",
    mutedStrong: isDark ? "rgba(240,240,255,0.68)" : "rgba(26,16,64,0.72)",
    /* ui states */
    navBg: isDark ? "rgba(7,7,26,0.88)" : "rgba(255,255,255,0.9)",
    statBg: isDark ? "rgba(255,255,255,0.03)" : "rgba(124,58,237,0.04)",
    checkBg: isDark ? "rgba(124,58,237,0.2)" : "rgba(124,58,237,0.1)",
    tagBg: isDark ? "rgba(124,58,237,0.15)" : "rgba(124,58,237,0.08)",
    ghostBg: isDark ? "rgba(255,255,255,0.05)" : "rgba(124,58,237,0.06)",
    ghostBorder: isDark ? "rgba(255,255,255,0.1)" : "rgba(124,58,237,0.18)",
    sectionOverlay: isDark ? "rgba(124,58,237,0.05)" : "rgba(124,58,237,0.03)",
    /* plan featured */
    featBg: isDark
      ? "linear-gradient(160deg, rgba(124,58,237,0.18) 0%, rgba(219,39,119,0.1) 100%)"
      : "linear-gradient(160deg, rgba(124,58,237,0.07) 0%, rgba(219,39,119,0.04) 100%)",
    featBorder: isDark ? "rgba(124,58,237,0.45)" : "rgba(124,58,237,0.3)",
    /* shadows */
    cardShadow: isDark
      ? "0 20px 60px rgba(124,58,237,0.15), 0 0 0 1px rgba(124,58,237,0.1)"
      : "0 20px 60px rgba(124,58,237,0.1),  0 0 0 1px rgba(124,58,237,0.07)",
    /* blob opacity */
    blob1: isDark ? "0.18" : "0.09",
    blob2: isDark ? "0.13" : "0.06",
    /* footer */
    footerBg: isDark ? "rgba(14,14,42,0.7)" : "rgba(248,247,255,0.95)",
  };

  const fontFamily = isRTL ? "'Cairo', sans-serif" : "'DM Sans', sans-serif";
  const displayFont = isRTL ? "'Cairo', sans-serif" : "'Syne', sans-serif";

  return (
    <>
      {/* ─────────── global styles ─────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&family=Cairo:wght@400;600;700;800&display=swap');

        /* gradient text — uses kojo brand colours */
        .kj-gt {
          background: ${GRAD};
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }

        /* display font */
        .kj-d { font-family: ${displayFont}; font-weight: 800; }

        /* animated logo float */
        @keyframes kj-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
        .kj-float { animation: kj-float 4.5s ease-in-out infinite; }

        /* badge dot pulse */
        @keyframes kj-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.6)} }

        /* primary CTA button */
        .kj-btn {
          background: ${GRAD}; color: #fff; border: none;
          border-radius: 14px; padding: 0 28px; height: 50px;
          font-size: 15px; font-weight: 600; cursor: pointer;
          display: inline-flex; align-items: center; gap: 8px;
          text-decoration: none; position: relative; overflow: hidden;
          transition: transform .2s, box-shadow .2s;
          font-family: ${fontFamily};
        }
        .kj-btn:hover { transform: translateY(-2px); box-shadow: 0 14px 36px rgba(124,58,237,0.42); }
        .kj-btn::after { content:''; position:absolute; inset:0; background:rgba(255,255,255,.12); opacity:0; transition:opacity .2s; }
        .kj-btn:hover::after { opacity:1; }

        /* ghost button */
        .kj-ghost {
          background: ${T.ghostBg}; border: 1px solid ${T.ghostBorder};
          color: ${T.mutedStrong}; border-radius: 14px; padding: 0 24px; height: 50px;
          font-size: 15px; font-weight: 500; cursor: pointer;
          transition: background .2s, border-color .2s, color .2s;
          font-family: ${fontFamily};
        }
        .kj-ghost:hover { background:rgba(124,58,237,0.12); border-color:${T.borderHover}; color:${T.text}; }

        /* section pill label */
        .kj-lbl {
          display: inline-block; padding: 4px 14px; border-radius: 999px;
          font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
          background: ${T.tagBg}; border: 1px solid ${isDark ? "rgba(124,58,237,0.28)" : "rgba(124,58,237,0.2)"};
          color: #7c3aed; margin-bottom: 16px;
        }

        /* card */
        .kj-card {
          background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 20px;
          transition: transform .3s, border-color .3s, box-shadow .3s, background .35s;
        }
        .kj-card:hover { transform:translateY(-6px); border-color:${T.borderHover}; box-shadow:${T.cardShadow}; }

        /* icon box — uses kojo-gradient */
        .kj-icon {
          width: 48px; height: 48px; border-radius: 14px;
          background: ${GRAD}; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 24px rgba(124,58,237,0.32); flex-shrink: 0;
          transition: transform .25s;
        }
        .kj-card:hover .kj-icon { transform: scale(1.1) rotate(-4deg); }

        /* contact card */
        .kj-contact {
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          padding: 28px 20px; border-radius: 20px; text-align: center;
          text-decoration: none; color: ${T.text};
          background: ${T.surface}; border: 1px solid ${T.border};
          transition: transform .3s, border-color .3s, box-shadow .3s, background .35s, color .35s;
        }
        .kj-contact:hover { transform:translateY(-6px); border-color:${T.borderHover}; box-shadow:${T.cardShadow}; }

        /* plan featured */
        .kj-feat {
          background: ${T.featBg} !important;
          border-color: ${T.featBorder} !important;
          box-shadow: 0 0 60px rgba(124,58,237,0.12);
        }

        /* FAQ */
        .kj-faq {
          background: ${T.surface}; border: 1px solid ${T.border};
          border-radius: 16px; margin-bottom: 10px;
          transition: border-color .3s, background .35s;
        }
        .kj-faq:hover { border-color: ${T.borderHover}; }

        /* navbar */
        .kj-nav {
          position: fixed; top: 0; inset-x: 0; z-index: 100;
          padding: 0 28px; height: 68px;
          display: flex; align-items: center; justify-content: space-between;
          transition: background .3s, border-color .3s;
        }
        .kj-nav.kj-scrolled {
          background: ${T.navBg};
          backdrop-filter: blur(22px) saturate(160%);
          border-bottom: 1px solid ${T.border};
        }

        /* timeline */
        .kj-tl { position: absolute; top: 0; bottom: 0; width: 2px; background: ${GRAD}; left: 11px; }
        [dir="rtl"] .kj-tl { left: auto; right: 11px; }

        /* tabs — override radix defaults */
        [role="tablist"] {
          background: ${isDark ? "rgba(14,14,42,0.9)" : "rgba(124,58,237,0.05)"} !important;
          border: 1px solid ${T.border} !important;
          border-radius: 14px !important; padding: 4px !important;
        }
        [role="tab"] { color: ${T.muted} !important; transition: color .2s !important; border-radius: 11px !important; }
        [role="tab"]:hover { color: ${T.text} !important; }
        [role="tab"][data-state="active"] { background: ${GRAD} !important; color: #fff !important; }

        /* accordion */
        [data-radix-accordion-trigger] { color: ${T.text} !important; }
        [data-radix-accordion-content]  { color: ${T.muted} !important; }

        /* check row */
        .kj-chk { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; margin-bottom: 10px; color: ${T.mutedStrong}; }
        .kj-chk-dot { width:20px; height:20px; border-radius:50%; background:${T.checkBg}; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; }

        /* scrollbar */
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.35); border-radius: 4px; }
      `}</style>

      <div
        dir={isRTL ? "rtl" : "ltr"}
        style={{
          minHeight: "100vh",
          background: T.bg,
          color: T.text,
          overflowX: "hidden",
          fontFamily,
          transition: "background .35s, color .35s",
        }}
      >
        <ParticleCanvas isDark={isDark} />

        {/* ══════════ NAVBAR ══════════ */}
        <nav className={`kj-nav${scrolled ? " kj-scrolled" : ""}`}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <img src={kojobotLogo} alt="Kojobot" style={{ height: 36 }} />
            <span className="kj-d kj-gt" style={{ fontSize: 22 }}>
              Kojobot
            </span>
          </Link>

          <div className="hidden md:flex" style={{ flex: 1, justifyContent: "center", gap: 4 }}>
            {navSections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => scrollTo(sec.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px 14px",
                  borderRadius: 10,
                  fontSize: 14,
                  color: T.muted,
                  transition: "color .2s, background .2s",
                  fontFamily,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = T.text;
                  (e.currentTarget as HTMLButtonElement).style.background = isDark
                    ? "rgba(124,58,237,0.08)"
                    : "rgba(124,58,237,0.06)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = T.muted;
                  (e.currentTarget as HTMLButtonElement).style.background = "none";
                }}
              >
                {language === "ar" ? sec.ar : sec.en}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <LanguageToggle />
            <ThemeToggle />
            <Link
              to={s?.cta_url || "/auth"}
              className="kj-btn"
              style={{ height: 38, padding: "0 18px", borderRadius: 10, fontSize: 14 }}
            >
              {l(s?.cta_text_en, s?.cta_text_ar)}
            </Link>
          </div>
        </nav>

        {/* ══════════ HERO ══════════ */}
        <section style={{ position: "relative", paddingTop: 160, paddingBottom: 100, overflow: "hidden", zIndex: 1 }}>
          {/* ambient glows */}
          <div
            style={{
              position: "absolute",
              width: 520,
              height: 520,
              top: -80,
              left: -180,
              borderRadius: "50%",
              background: `rgba(124,58,237,${T.blob1})`,
              filter: "blur(90px)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 400,
              height: 400,
              top: 60,
              right: -120,
              borderRadius: "50%",
              background: `rgba(219,39,119,${T.blob2})`,
              filter: "blur(90px)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              maxWidth: 780,
              margin: "0 auto",
              padding: "0 24px",
              textAlign: "center",
              position: "relative",
              zIndex: 2,
            }}
          >
            {/* badge */}
            <div style={{ marginBottom: 4 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 18px",
                  borderRadius: 999,
                  background: T.tagBg,
                  border: "1px solid " + (isDark ? "rgba(124,58,237,0.3)" : "rgba(124,58,237,0.18)"),
                  fontSize: 13,
                  color: T.mutedStrong,
                  marginBottom: 24,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#7c3aed",
                    display: "inline-block",
                    animation: "kj-pulse 2s ease-in-out infinite",
                  }}
                />
                {language === "ar" ? "منصة البرمجة للأجيال القادمة" : "Coding Platform for the Next Generation"}
              </span>
            </div>

            {/* logo */}
            <div className="kj-float" style={{ marginBottom: 28 }}>
              <img
                src={kojobotLogo}
                alt="Kojobot"
                style={{
                  width: 110,
                  margin: "0 auto",
                  display: "block",
                  filter: `drop-shadow(0 0 32px rgba(124,58,237,${isDark ? ".55" : ".28"}))`,
                }}
              />
            </div>

            <h1 className="kj-d" style={{ fontSize: "clamp(34px,6vw,70px)", lineHeight: 1.08, marginBottom: 22 }}>
              <span className="kj-gt">{l(s?.hero_title_en, s?.hero_title_ar)}</span>
            </h1>
            <p
              style={{
                fontSize: "clamp(15px,2vw,18px)",
                color: T.muted,
                maxWidth: 520,
                margin: "0 auto 40px",
                lineHeight: 1.75,
              }}
            >
              {l(s?.hero_subtitle_en, s?.hero_subtitle_ar)}
            </p>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link to={s?.cta_url || "/auth"} className="kj-btn">
                {l(s?.cta_text_en, s?.cta_text_ar)} <Arrow size={18} />
              </Link>
              <button className="kj-ghost" onClick={() => scrollTo("plans")}>
                {language === "ar" ? "استعرض الباقات" : "View Plans"}
              </button>
            </div>

            {/* stat bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 40,
                padding: "22px 36px",
                borderRadius: 18,
                background: T.statBg,
                border: "1px solid " + T.border,
                backdropFilter: "blur(12px)",
                flexWrap: "wrap",
                justifyContent: "center",
                marginTop: 60,
                transition: "background .35s",
              }}
            >
              {[
                { num: "500+", label: language === "ar" ? "طالب نشط" : "Active Students" },
                { num: "6–18", label: language === "ar" ? "الفئة العمرية" : "Age Range" },
                { num: "3", label: language === "ar" ? "مسارات تعليمية" : "Learning Tracks" },
                { num: "4×", label: language === "ar" ? "حصص في الشهر" : "Sessions / Month" },
              ].map(({ num, label }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div className="kj-d kj-gt" style={{ fontSize: 26, lineHeight: 1 }}>
                    {num}
                  </div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ FEATURES ══════════ */}
        {features.length > 0 && (
          <section
            id="features"
            style={{
              padding: "96px 24px",
              background: T.bgAlt,
              position: "relative",
              zIndex: 1,
              transition: "background .35s",
            }}
          >
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
              <div style={{ textAlign: "center", marginBottom: 54 }}>
                <span className="kj-lbl">{language === "ar" ? "لماذا كوجوبوت" : "Why Kojobot"}</span>
                <h2 className="kj-d" style={{ fontSize: "clamp(26px,4vw,44px)", marginBottom: 12 }}>
                  <span className="kj-gt">
                    {language === "ar" ? "منصة تعليمية متكاملة" : "A Complete Learning Platform"}
                  </span>
                </h2>
                <p style={{ color: T.muted, maxWidth: 460, margin: "0 auto", fontSize: 16, lineHeight: 1.7 }}>
                  {language === "ar"
                    ? "كل ما يحتاجه طفلك لرحلته في عالم التكنولوجيا"
                    : "Everything your child needs for their tech journey"}
                </p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 18 }}>
                {features.map((f) => {
                  const Icon = iconMap[f.icon_name] || Monitor;
                  return (
                    <div className="kj-card" key={f.id} style={{ padding: "26px 22px" }}>
                      <div className="kj-icon" style={{ marginBottom: 16 }}>
                        <Icon size={22} color="#fff" />
                      </div>
                      <h3 className="kj-d" style={{ fontSize: 17, marginBottom: 8, color: T.text }}>
                        {l(f.title_en, f.title_ar)}
                      </h3>
                      <p style={{ color: T.muted, fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                        {l(f.desc_en, f.desc_ar)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ══════════ TRACKS ══════════ */}
        {tracks.length > 0 && (
          <section
            id="tracks"
            style={{
              padding: "96px 24px",
              background: T.bg,
              position: "relative",
              zIndex: 1,
              transition: "background .35s",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(180deg,transparent 0%,${T.sectionOverlay} 50%,transparent 100%)`,
                pointerEvents: "none",
              }}
            />
            <div style={{ maxWidth: 900, margin: "0 auto", position: "relative" }}>
              <div style={{ textAlign: "center", marginBottom: 52 }}>
                <span className="kj-lbl">{language === "ar" ? "المسارات" : "Tracks"}</span>
                <h2 className="kj-d" style={{ fontSize: "clamp(26px,4vw,44px)", marginBottom: 12 }}>
                  <span className="kj-gt">
                    {language === "ar" ? "مسار مصمم لكل فئة عمرية" : "Designed for Every Age Group"}
                  </span>
                </h2>
              </div>

              <Tabs defaultValue={tracks[0]?.age_group}>
                <TabsList
                  className="grid w-full max-w-xl mx-auto mb-12"
                  style={{ gridTemplateColumns: `repeat(${tracks.length},1fr)` }}
                >
                  {tracks.map((tr) => (
                    <TabsTrigger key={tr.age_group} value={tr.age_group}>
                      {l(tr.title_en, tr.title_ar)}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {tracks.map((tr) => {
                  const general = tr.steps.filter((s) => s.path_type === "general");
                  const software = tr.steps.filter((s) => s.path_type === "software");
                  const hardware = tr.steps.filter((s) => s.path_type === "hardware");
                  return (
                    <TabsContent key={tr.age_group} value={tr.age_group}>
                      <p
                        style={{
                          textAlign: "center",
                          color: T.muted,
                          marginBottom: 44,
                          fontSize: 15,
                          lineHeight: 1.75,
                        }}
                      >
                        {l(tr.intro_en, tr.intro_ar)}
                      </p>
                      <div style={{ position: "relative", paddingInlineStart: 44 }}>
                        <div className="kj-tl" />
                        {general.map((step) => (
                          <div
                            key={step.id}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 14,
                              marginBottom: 22,
                              position: "relative",
                            }}
                          >
                            <div
                              style={{
                                position: "absolute",
                                insetInlineStart: -44,
                                width: 26,
                                height: 26,
                                borderRadius: "50%",
                                background: GRAD,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#fff",
                                zIndex: 1,
                                boxShadow: "0 0 0 5px " + (isDark ? "rgba(124,58,237,0.15)" : "rgba(124,58,237,0.1)"),
                              }}
                            >
                              {step.step_number}
                            </div>
                            <div className="kj-card" style={{ padding: "14px 18px", flex: 1 }}>
                              <h4 className="kj-d" style={{ fontSize: 15, marginBottom: 4, color: T.text }}>
                                {l(step.title_en, step.title_ar)}
                              </h4>
                              <p style={{ color: T.muted, fontSize: 13, lineHeight: 1.65, margin: 0 }}>
                                {l(step.desc_en, step.desc_ar)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      {(software.length > 0 || hardware.length > 0) && (
                        <div style={{ marginTop: 28 }}>
                          <h4 className="kj-d kj-gt" style={{ textAlign: "center", fontSize: 18, marginBottom: 18 }}>
                            {language === "ar" ? "اختر مسارك" : "Choose Your Path"}
                          </h4>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                            {[
                              { label: language === "ar" ? "💻 مسار Software" : "💻 Software Path", steps: software },
                              { label: language === "ar" ? "🔧 مسار Hardware" : "🔧 Hardware Path", steps: hardware },
                            ].map(
                              ({ label, steps: bs }) =>
                                bs.length > 0 && (
                                  <div className="kj-card" key={label} style={{ padding: "18px 16px" }}>
                                    <h5 className="kj-d" style={{ fontSize: 14, marginBottom: 14, color: T.text }}>
                                      {label}
                                    </h5>
                                    {bs.map((step) => (
                                      <div key={step.id} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                                        <div
                                          style={{
                                            width: 22,
                                            height: 22,
                                            borderRadius: "50%",
                                            background: T.checkBg,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: 10,
                                            fontWeight: 700,
                                            color: "#7c3aed",
                                            flexShrink: 0,
                                          }}
                                        >
                                          {step.step_number}
                                        </div>
                                        <div>
                                          <p
                                            style={{ fontSize: 13, fontWeight: 600, margin: "0 0 2px", color: T.text }}
                                          >
                                            {l(step.title_en, step.title_ar)}
                                          </p>
                                          <p style={{ fontSize: 12, color: T.muted, margin: 0, lineHeight: 1.55 }}>
                                            {l(step.desc_en, step.desc_ar)}
                                          </p>
                                          {(step.specializations?.length ?? 0) > 0 && (
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                                              {step.specializations!.map((sp) => (
                                                <span
                                                  key={sp}
                                                  style={{
                                                    fontSize: 11,
                                                    padding: "2px 8px",
                                                    borderRadius: 999,
                                                    background: T.tagBg,
                                                    color: "#7c3aed",
                                                    border:
                                                      "1px solid " +
                                                      (isDark ? "rgba(124,58,237,0.25)" : "rgba(124,58,237,0.18)"),
                                                  }}
                                                >
                                                  {sp}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ),
                            )}
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            </div>
          </section>
        )}

        {/* ══════════ PLANS ══════════ */}
        {plans.length > 0 && (
          <section
            id="plans"
            style={{
              padding: "96px 24px",
              background: T.bgAlt,
              position: "relative",
              zIndex: 1,
              transition: "background .35s",
            }}
          >
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
              <div style={{ textAlign: "center", marginBottom: 54 }}>
                <span className="kj-lbl">{language === "ar" ? "الباقات والأسعار" : "Plans & Pricing"}</span>
                <h2 className="kj-d" style={{ fontSize: "clamp(26px,4vw,44px)", marginBottom: 12 }}>
                  <span className="kj-gt">{language === "ar" ? "اختر باقتك" : "Choose Your Plan"}</span>
                </h2>
                <p style={{ color: T.muted, maxWidth: 400, margin: "0 auto", fontSize: 16 }}>
                  {language === "ar" ? "باقات مرنة لكل احتياج" : "Flexible plans for every need"}
                </p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20 }}>
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`kj-card${plan.is_featured ? " kj-feat" : ""}`}
                    style={{ padding: "32px 26px", position: "relative" }}
                  >
                    {plan.is_featured && (
                      <div
                        style={{
                          position: "absolute",
                          top: -13,
                          left: "50%",
                          transform: "translateX(-50%)",
                          padding: "4px 18px",
                          borderRadius: 999,
                          background: GRAD,
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#fff",
                          whiteSpace: "nowrap",
                          boxShadow: "0 6px 20px rgba(124,58,237,0.4)",
                        }}
                      >
                        {language === "ar" ? "⭐ الأكثر طلباً" : "⭐ Most Popular"}
                      </div>
                    )}

                    <h3 className="kj-d" style={{ fontSize: 20, marginBottom: 20, textAlign: "center", color: T.text }}>
                      {l(plan.name_en, plan.name_ar)}
                    </h3>

                    {/* prices */}
                    <div style={{ textAlign: "center", marginBottom: 22 }}>
                      {plan.price_number > 0 && (
                        <div
                          style={{
                            marginBottom: 8,
                            display: "flex",
                            alignItems: "baseline",
                            justifyContent: "center",
                            gap: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 10px",
                              borderRadius: 999,
                              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                              color: T.muted,
                            }}
                          >
                            {language === "ar" ? "أوفلاين" : "Offline"}
                          </span>
                          {plan.price_before_discount > plan.price_number && (
                            <span style={{ textDecoration: "line-through", color: T.muted, fontSize: 16 }}>
                              {plan.price_before_discount}
                            </span>
                          )}
                          <span className="kj-d kj-gt" style={{ fontSize: 32 }}>
                            {plan.price_number}
                          </span>
                          <span style={{ color: T.muted, fontSize: 12 }}>
                            {plan.price_currency}/{l(plan.billing_period_en, plan.billing_period_ar)}
                          </span>
                        </div>
                      )}
                      {plan.price_online > 0 && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            justifyContent: "center",
                            gap: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 10px",
                              borderRadius: 999,
                              background: T.tagBg,
                              color: "#7c3aed",
                            }}
                          >
                            {language === "ar" ? "أونلاين" : "Online"}
                          </span>
                          {plan.price_online_before_discount > plan.price_online && (
                            <span style={{ textDecoration: "line-through", color: T.muted, fontSize: 16 }}>
                              {plan.price_online_before_discount}
                            </span>
                          )}
                          <span className="kj-d kj-gt" style={{ fontSize: 32 }}>
                            {plan.price_online}
                          </span>
                          <span style={{ color: T.muted, fontSize: 12 }}>
                            {plan.price_currency}/{l(plan.billing_period_en, plan.billing_period_ar)}
                          </span>
                        </div>
                      )}
                      {plan.price_number <= 0 && plan.price_online <= 0 && (
                        <span className="kj-d kj-gt" style={{ fontSize: 24 }}>
                          {language === "ar" ? "تواصل معنا" : "Contact Us"}
                        </span>
                      )}
                    </div>

                    <div style={{ borderTop: "1px solid " + T.border, paddingTop: 16, marginBottom: 14 }}>
                      {plan.sessions_per_month && (
                        <div className="kj-chk">
                          <div className="kj-chk-dot">
                            <Check size={11} color="#7c3aed" />
                          </div>
                          <span>
                            {plan.sessions_per_month} {language === "ar" ? "حصص/شهر" : "sessions/month"}
                          </span>
                        </div>
                      )}
                      {plan.session_duration_minutes && (
                        <div className="kj-chk">
                          <div className="kj-chk-dot">
                            <Check size={11} color="#7c3aed" />
                          </div>
                          <span>
                            {plan.session_duration_minutes} {language === "ar" ? "دقيقة/حصة" : "min/session"}
                          </span>
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: 24 }}>
                      {plan.benefits.map((b) => (
                        <div key={b.id} className="kj-chk">
                          <div className="kj-chk-dot">
                            <Check size={11} color="#7c3aed" />
                          </div>
                          <span>{l(b.text_en, b.text_ar)}</span>
                        </div>
                      ))}
                    </div>

                    <Link
                      to={s?.cta_url || "/auth"}
                      className={plan.is_featured ? "kj-btn" : "kj-ghost"}
                      style={{ width: "100%", justifyContent: "center", borderRadius: 12, height: 46 }}
                    >
                      {l(s?.cta_text_en, s?.cta_text_ar)}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ══════════ FAQ ══════════ */}
        <section
          id="faq"
          style={{
            padding: "96px 24px",
            background: T.bg,
            position: "relative",
            zIndex: 1,
            transition: "background .35s",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(180deg,transparent 0%,${T.sectionOverlay} 50%,transparent 100%)`,
              pointerEvents: "none",
            }}
          />
          <div style={{ maxWidth: 720, margin: "0 auto", position: "relative" }}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <span className="kj-lbl">{language === "ar" ? "الأسئلة الشائعة" : "FAQ"}</span>
              <h2 className="kj-d" style={{ fontSize: "clamp(26px,4vw,44px)" }}>
                <span className="kj-gt">{language === "ar" ? "إجابات على أسئلتك" : "Got Questions?"}</span>
              </h2>
            </div>
            <Accordion type="single" collapsible>
              {faqData.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="kj-faq"
                  style={{ padding: "0 20px", border: "none" }}
                >
                  <AccordionTrigger
                    style={{ fontSize: 15, fontWeight: 600, paddingTop: 18, paddingBottom: 18, color: T.text }}
                  >
                    {l(faq.q_en, faq.q_ar)}
                  </AccordionTrigger>
                  <AccordionContent style={{ color: T.muted, fontSize: 14, lineHeight: 1.75, paddingBottom: 18 }}>
                    {l(faq.a_en, faq.a_ar)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ══════════ CONTACT ══════════ */}
        <section
          id="contact"
          style={{
            padding: "96px 24px",
            background: T.bgAlt,
            position: "relative",
            zIndex: 1,
            transition: "background .35s",
          }}
        >
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <span className="kj-lbl">{language === "ar" ? "تواصل معنا" : "Contact"}</span>
              <h2 className="kj-d" style={{ fontSize: "clamp(26px,4vw,44px)", marginBottom: 12 }}>
                <span className="kj-gt">{language === "ar" ? "نحن هنا لك" : "We're Here for You"}</span>
              </h2>
              <p style={{ color: T.muted, maxWidth: 420, margin: "0 auto", fontSize: 16 }}>
                {language === "ar" ? "تواصل معنا بأي طريقة تناسبك" : "Reach out through any channel that suits you"}
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 16 }}>
              {socialLinks.map((link) => {
                const Icon = socialIconMap[link.platform] || MessageCircle;
                const label = socialLabelMap[link.platform] || { en: link.platform, ar: link.platform };
                return (
                  <a
                    key={link.platform}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="kj-contact"
                  >
                    <div className="kj-icon" style={{ width: 58, height: 58, borderRadius: 16 }}>
                      <Icon className="w-6 h-6" style={{ color: "#fff" }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
                      {language === "ar" ? label.ar : label.en}
                    </span>
                  </a>
                );
              })}
              {s?.email && (
                <a href={`mailto:${s.email}`} className="kj-contact">
                  <div className="kj-icon" style={{ width: 58, height: 58, borderRadius: 16 }}>
                    <Mail size={24} color="#fff" />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
                    {language === "ar" ? "البريد الإلكتروني" : "Email"}
                  </span>
                  <span style={{ fontSize: 12, color: T.muted }}>{s.email}</span>
                </a>
              )}
              {s?.phone && (
                <a href={`tel:${s.phone}`} className="kj-contact">
                  <div className="kj-icon" style={{ width: 58, height: 58, borderRadius: 16 }}>
                    <Phone size={24} color="#fff" />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
                    {language === "ar" ? "الهاتف" : "Phone"}
                  </span>
                  <span style={{ fontSize: 12, color: T.muted }}>{s.phone}</span>
                </a>
              )}
            </div>
            {(s?.address_en || s?.address_ar) && (
              <div style={{ textAlign: "center", marginTop: 28 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: T.muted, fontSize: 14 }}>
                  <MapPin size={16} color="#7c3aed" />
                  {l(s?.address_en, s?.address_ar)}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ══════════ FOOTER ══════════ */}
        <footer
          style={{
            borderTop: "1px solid " + T.border,
            padding: "28px 28px",
            background: T.footerBg,
            position: "relative",
            zIndex: 1,
            transition: "background .35s, border-color .35s",
          }}
        >
          <div
            style={{
              maxWidth: 1100,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
              <img src={kojobotLogo} alt="Kojobot" style={{ height: 28 }} />
              <span className="kj-d kj-gt" style={{ fontSize: 18 }}>
                Kojobot
              </span>
            </Link>
            {socialLinks.length > 0 && (
              <div style={{ display: "flex", gap: 8 }}>
                {socialLinks.map((link) => {
                  const Icon = socialIconMap[link.platform] || MessageCircle;
                  return (
                    <a
                      key={link.platform}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        textDecoration: "none",
                        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(124,58,237,0.06)",
                        border: "1px solid " + T.border,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: T.muted,
                        transition: "background .2s, color .2s, border-color .2s",
                      }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget;
                        el.style.background = "rgba(124,58,237,0.14)";
                        el.style.color = "#7c3aed";
                        el.style.borderColor = T.borderHover;
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget;
                        el.style.background = isDark ? "rgba(255,255,255,0.04)" : "rgba(124,58,237,0.06)";
                        el.style.color = T.muted;
                        el.style.borderColor = T.border;
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </a>
                  );
                })}
              </div>
            )}
            <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>{l(s?.footer_text_en, s?.footer_text_ar)}</p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Index;
