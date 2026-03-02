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
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  MessageCircle,
  X,
  Instagram,
  Facebook,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className || "w-7 h-7"}>
    <path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z" />
  </svg>
);

const socialIconMap: Record<string, React.ElementType | (() => JSX.Element)> = {
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
const navSections = [
  { id: "features", en: "Features", ar: "المميزات" },
  { id: "tracks", en: "Tracks", ar: "المسارات" },
  { id: "plans", en: "Plans", ar: "الباقات" },
  { id: "faq", en: "FAQ", ar: "الأسئلة" },
  { id: "contact", en: "Contact", ar: "تواصل" },
];

/* ─── Floating particle grid background ─────────────────────── */
const ParticleGrid = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const dots: { x: number; y: number; vx: number; vy: number; r: number }[] = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.5,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dots.forEach((d) => {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0 || d.x > canvas.width) d.vx *= -1;
        if (d.y < 0 || d.y > canvas.height) d.vy *= -1;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(100,85,240,0.35)";
        ctx.fill();
      });
      dots.forEach((a, i) =>
        dots.slice(i + 1).forEach((b) => {
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(100,85,240,${0.12 * (1 - dist / 120)})`;
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
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0 opacity-60" />;
};

const Index = () => {
  const { language, t, isRTL } = useLanguage();
  const [content, setContent] = useState<LandingContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    supabase.rpc("get_landing_content").then(({ data }) => {
      if (data) setContent(data as unknown as LandingContent);
      setLoading(false);
    });
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const l = (en: string | undefined, ar: string | undefined) => (language === "ar" ? ar || en || "" : en || ar || "");
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#070714" }}>
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-[#6455F0]/30 animate-ping" />
          <div className="absolute inset-2 rounded-full border-2 border-t-[#6455F0] border-transparent animate-spin" />
          <div className="absolute inset-4 rounded-full bg-[#6455F0]/20 animate-pulse" />
        </div>
      </div>
    );
  }

  const s = content?.settings;
  const features = content?.features || [];
  const plans = content?.plans || [];
  const tracks = content?.tracks || [];
  const socialLinks: SocialLink[] = Array.isArray(s?.social_links) ? s.social_links : [];

  return (
    <>
      <style>{`
        /* Fonts loaded in index.html */

        :root {
          --kojo-bg: #070714;
          --kojo-surface: #0e0e2a;
          --kojo-border: rgba(100,85,240,0.15);
          --kojo-violet: #6455F0;
          --kojo-pink: #61BAE2;
          --kojo-cyan: #61BAE2;
          --kojo-gold: #f59e0b;
          --kojo-text: #f0f0ff;
          --kojo-muted: rgba(240,240,255,0.45);
        }

        * { box-sizing: border-box; }

        .kojo-root {
          background: var(--kojo-bg);
          color: var(--kojo-text);
          font-family: ${isRTL ? "'Cairo'" : "'Poppins'"}, sans-serif;
          min-height: 100vh;
          overflow-x: hidden;
        }

        .font-display {
          font-family: ${isRTL ? "'Cairo'" : "'Poppins'"}, sans-serif;
          font-weight: 800;
        }

        /* ── Gradient utilities ── */
        .grad-text {
          background: linear-gradient(135deg, var(--kojo-pink) 0%, var(--kojo-violet) 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .grad-btn {
          background: linear-gradient(135deg, var(--kojo-pink), var(--kojo-violet));
          border: none; color: #fff; position: relative; overflow: hidden;
          transition: transform .2s, box-shadow .2s;
        }
        .grad-btn::after {
          content:''; position:absolute; inset:0;
          background: linear-gradient(135deg, rgba(255,255,255,0.15), transparent);
          opacity:0; transition: opacity .2s;
        }
        .grad-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(100,85,240,.45); }
        .grad-btn:hover::after { opacity:1; }

        .card {
          background: var(--kojo-surface);
          border: 1px solid var(--kojo-border);
          border-radius: 20px;
          transition: transform .3s, border-color .3s, box-shadow .3s;
        }
        .card:hover {
          transform: translateY(-6px);
          border-color: rgba(100,85,240,.4);
          box-shadow: 0 20px 60px rgba(100,85,240,.12), 0 0 0 1px rgba(100,85,240,.08);
        }

        /* ── Noise overlay ── */
        .kojo-root::before {
          content: '';
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
          background-repeat: repeat; background-size: 200px 200px; opacity:.4;
        }

        /* ── Navbar ── */
        .kojo-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 0 24px; height: 68px; display: flex; align-items: center; justify-content: space-between;
          transition: background .3s, backdrop-filter .3s, border-color .3s;
        }
        .kojo-nav.scrolled {
          background: rgba(7,7,20,0.85);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--kojo-border);
        }

        /* ── Hero ── */
        .hero-glow {
          position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none;
        }
        .badge-pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 16px; border-radius: 999px;
          background: rgba(100,85,240,.12); border: 1px solid rgba(100,85,240,.3);
          font-size: 13px; font-weight: 500; color: rgba(240,240,255,.8);
          margin-bottom: 24px;
        }
        .badge-pill span.dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--kojo-violet); display: inline-block;
          animation: pulse-dot 1.8s ease-in-out infinite;
        }
        @keyframes pulse-dot {
          0%,100% { opacity:1; transform:scale(1); }
          50% { opacity:.4; transform:scale(.6); }
        }

        /* ── Stats bar ── */
        .stat-bar {
          display: flex; align-items: center; gap: 40px;
          padding: 20px 32px; border-radius: 16px;
          background: rgba(255,255,255,.025);
          border: 1px solid var(--kojo-border);
          backdrop-filter: blur(10px);
          flex-wrap: wrap; justify-content: center;
        }
        .stat-item { text-align: center; }
        .stat-num { font-size: 28px; font-weight: 800; line-height: 1; }
        .stat-label { font-size: 12px; color: var(--kojo-muted); margin-top: 4px; }

        /* ── Section label ── */
        .section-label {
          display: inline-block;
          padding: 4px 14px; border-radius: 999px;
          font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
          background: rgba(100,85,240,.1); border: 1px solid rgba(100,85,240,.25);
          color: var(--kojo-violet); margin-bottom: 16px;
        }

        /* ── Feature card icon ── */
        .icon-wrap {
          width: 48px; height: 48px; border-radius: 14px;
          background: linear-gradient(135deg, var(--kojo-violet), var(--kojo-pink));
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px; flex-shrink: 0;
          box-shadow: 0 8px 24px rgba(100,85,240,.3);
          transition: transform .25s;
        }
        .card:hover .icon-wrap { transform: scale(1.1) rotate(-4deg); }

        /* ── Plan card ── */
        .plan-featured {
          background: linear-gradient(160deg, rgba(100,85,240,.15) 0%, rgba(97,186,226,.08) 100%);
          border: 1px solid rgba(100,85,240,.4) !important;
          box-shadow: 0 0 60px rgba(100,85,240,.12);
        }
        .plan-featured:hover { box-shadow: 0 24px 80px rgba(100,85,240,.22); }

        /* ── Track timeline ── */
        .timeline-line {
          position: absolute; top: 0; bottom: 0; width: 2px;
          background: linear-gradient(to bottom, var(--kojo-violet), var(--kojo-pink), var(--kojo-cyan));
          left: 23px;
        }
        [dir="rtl"] .timeline-line { left: auto; right: 23px; }

        /* ── FAQ ── */
        .faq-item {
          background: var(--kojo-surface); border: 1px solid var(--kojo-border);
          border-radius: 16px; margin-bottom: 10px; overflow: hidden;
          transition: border-color .3s;
        }
        .faq-item:hover { border-color: rgba(100,85,240,.3); }

        /* ── Contact card ── */
        .contact-card {
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          padding: 28px 20px; border-radius: 20px;
          background: var(--kojo-surface); border: 1px solid var(--kojo-border);
          text-decoration: none; color: inherit;
          transition: transform .3s, border-color .3s, box-shadow .3s;
          text-align: center;
        }
        .contact-card:hover {
          transform: translateY(-6px);
          border-color: rgba(100,85,240,.4);
          box-shadow: 0 20px 50px rgba(100,85,240,.15);
        }
        .contact-icon {
          width: 60px; height: 60px; border-radius: 16px;
          background: linear-gradient(135deg, var(--kojo-violet), var(--kojo-pink));
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 24px rgba(100,85,240,.3);
          transition: transform .25s;
        }
        .contact-card:hover .contact-icon { transform: scale(1.1); }

        /* ── Footer ── */
        .kojo-footer {
          border-top: 1px solid var(--kojo-border);
          padding: 32px 24px;
          background: rgba(14,14,42,.6);
        }

        /* ── Scroll-reveal ── */
        .reveal { opacity: 0; transform: translateY(32px); transition: opacity .7s ease, transform .7s ease; }
        .reveal.visible { opacity: 1; transform: none; }

        /* ── Tabs override ── */
        [role="tablist"] {
          background: rgba(14,14,42,.8) !important;
          border: 1px solid var(--kojo-border) !important;
          border-radius: 12px !important; padding: 4px !important;
        }
        [role="tab"][data-state="active"] {
          background: linear-gradient(135deg, var(--kojo-pink), var(--kojo-violet)) !important;
          color: #fff !important; border-radius: 9px !important;
        }
        [role="tab"] { color: var(--kojo-muted) !important; transition: color .2s !important; border-radius: 9px !important; }
        [role="tab"]:hover { color: var(--kojo-text) !important; }

        /* ── Accordion override ── */
        [data-radix-accordion-item] { background: none !important; border: none !important; }
        [data-radix-accordion-trigger] { color: var(--kojo-text) !important; }
        [data-radix-accordion-content] { color: var(--kojo-muted) !important; }

        /* ── Scrollbar ── */
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(100,85,240,.4); border-radius: 4px; }

        /* ── Check list ── */
        .check-row { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; margin-bottom: 10px; }
        .check-icon { width: 18px; height: 18px; border-radius: 50%; background: rgba(100,85,240,.2);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }

        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .float { animation: float 4s ease-in-out infinite; }
      `}</style>

      <div className="kojo-root" dir={isRTL ? "rtl" : "ltr"}>
        <ParticleGrid />

        {/* ══════════ NAVBAR ══════════ */}
        <nav className={`kojo-nav${scrolled ? " scrolled" : ""}`}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <img src={kojobotLogo} alt="Kojobot" style={{ height: 36 }} />
            <span className="font-display grad-text" style={{ fontSize: 22 }}>
              Kojobot
            </span>
          </Link>

          <div
            style={{ display: "flex", gap: 4, flex: 1, justifyContent: "center", flexWrap: "nowrap" }}
            className="hidden md:flex"
          >
            {navSections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => scrollTo(sec.id)}
                style={{
                  padding: "6px 14px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "rgba(240,240,255,.5)",
                  fontSize: 14,
                  borderRadius: 8,
                  transition: "color .2s, background .2s",
                  fontFamily: isRTL ? "Cairo" : "Poppins",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.color = "#f0f0ff";
                  (e.target as HTMLElement).style.background = "rgba(100,85,240,.08)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.color = "rgba(240,240,255,.5)";
                  (e.target as HTMLElement).style.background = "none";
                }}
              >
                {language === "ar" ? sec.ar : sec.en}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <LanguageToggle />
            <ThemeToggle />
            <Button
              asChild
              size="sm"
              className="grad-btn"
              style={{ borderRadius: 10, padding: "0 18px", height: 36, fontSize: 14 }}
            >
              <Link to={s?.cta_url || "/auth"}>{l(s?.cta_text_en, s?.cta_text_ar)}</Link>
            </Button>
          </div>
        </nav>

        {/* ══════════ HERO ══════════ */}
        <section style={{ position: "relative", paddingTop: 160, paddingBottom: 100, overflow: "hidden", zIndex: 1 }}>
          {/* Glows */}
          <div
            className="hero-glow"
            style={{ width: 500, height: 500, top: -100, left: -150, background: "rgba(100,85,240,.18)" }}
          />
          <div
            className="hero-glow"
            style={{ width: 400, height: 400, top: 50, right: -100, background: "rgba(97,186,226,.12)" }}
          />
          <div
            className="hero-glow"
            style={{ width: 300, height: 300, bottom: -50, left: "40%", background: "rgba(97,186,226,.1)" }}
          />

          <div
            style={{
              maxWidth: 760,
              margin: "0 auto",
              padding: "0 24px",
              textAlign: "center",
              position: "relative",
              zIndex: 2,
            }}
          >
            <div className="badge-pill">
              <span className="dot" />{" "}
              {language === "ar" ? "منصة البرمجة للأجيال القادمة" : "Coding Platform for the Next Generation"}
            </div>

            <div className="float" style={{ marginBottom: 28 }}>
              <img
                src={kojobotLogo}
                alt="Kojobot"
                style={{
                  width: 120,
                  margin: "0 auto",
                  display: "block",
                  filter: "drop-shadow(0 0 30px rgba(100,85,240,.5))",
                }}
              />
            </div>

            <h1
              className="font-display"
              style={{ fontSize: "clamp(36px, 6vw, 72px)", lineHeight: 1.08, marginBottom: 24 }}
            >
              <span className="grad-text">{l(s?.hero_title_en, s?.hero_title_ar)}</span>
            </h1>

            <p
              style={{
                fontSize: "clamp(15px, 2vw, 19px)",
                color: "rgba(240,240,255,.55)",
                maxWidth: 540,
                margin: "0 auto 40px",
                lineHeight: 1.7,
              }}
            >
              {l(s?.hero_subtitle_en, s?.hero_subtitle_ar)}
            </p>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Button
                asChild
                size="lg"
                className="grad-btn"
                style={{ borderRadius: 14, padding: "0 32px", height: 52, fontSize: 16 }}
              >
                <Link to={s?.cta_url || "/auth"} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {l(s?.cta_text_en, s?.cta_text_ar)} <Arrow size={18} />
                </Link>
              </Button>
              <button
                onClick={() => scrollTo("plans")}
                style={{
                  height: 52,
                  padding: "0 28px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.12)",
                  color: "rgba(240,240,255,.75)",
                  fontSize: 15,
                  cursor: "pointer",
                  transition: "background .2s, border-color .2s",
                  fontFamily: isRTL ? "Cairo" : "Poppins",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.background = "rgba(255,255,255,.08)";
                  (e.target as HTMLElement).style.borderColor = "rgba(100,85,240,.4)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.background = "rgba(255,255,255,.04)";
                  (e.target as HTMLElement).style.borderColor = "rgba(255,255,255,.12)";
                }}
              >
                {language === "ar" ? "استعرض الباقات" : "View Plans"}
              </button>
            </div>

            {/* Stats */}
            <div className="stat-bar" style={{ marginTop: 64 }}>
              {[
                { num: "500+", label: language === "ar" ? "طالب نشط" : "Active Students" },
                { num: "6-18", label: language === "ar" ? "الفئة العمرية" : "Age Range" },
                { num: "3", label: language === "ar" ? "مسارات تعليمية" : "Learning Tracks" },
                { num: "4x", label: language === "ar" ? "حصص في الشهر" : "Sessions / Month" },
              ].map(({ num, label }) => (
                <div className="stat-item" key={label}>
                  <div className="stat-num grad-text font-display">{num}</div>
                  <div className="stat-label">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ FEATURES ══════════ */}
        {features.length > 0 && (
          <section id="features" style={{ padding: "100px 24px", position: "relative", zIndex: 1 }}>
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
              <div style={{ textAlign: "center", marginBottom: 60 }}>
                <span className="section-label">{language === "ar" ? "لماذا كوجوبوت" : "Why Kojobot"}</span>
                <h2 className="font-display" style={{ fontSize: "clamp(28px, 4vw, 46px)", marginBottom: 14 }}>
                  <span className="grad-text">
                    {language === "ar" ? "منصة تعليمية متكاملة" : "A Complete Learning Platform"}
                  </span>
                </h2>
                <p
                  style={{
                    color: "rgba(240,240,255,.45)",
                    maxWidth: 480,
                    margin: "0 auto",
                    fontSize: 16,
                    lineHeight: 1.7,
                  }}
                >
                  {language === "ar"
                    ? "كل ما يحتاجه طفلك لرحلته في عالم التكنولوجيا"
                    : "Everything your child needs for their tech journey"}
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
                {features.map((f, i) => {
                  const Icon = iconMap[f.icon_name] || Monitor;
                  return (
                    <div className="card" key={f.id} style={{ padding: "28px 24px" }}>
                      <div className="icon-wrap">
                        <Icon size={22} color="#fff" />
                      </div>
                      <h3 className="font-display" style={{ fontSize: 17, marginBottom: 8 }}>
                        {l(f.title_en, f.title_ar)}
                      </h3>
                      <p style={{ color: "rgba(240,240,255,.45)", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
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
          <section id="tracks" style={{ padding: "100px 24px", position: "relative", zIndex: 1 }}>
            {/* bg accent */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, transparent 0%, rgba(100,85,240,.04) 50%, transparent 100%)",
                pointerEvents: "none",
              }}
            />
            <div style={{ maxWidth: 900, margin: "0 auto", position: "relative" }}>
              <div style={{ textAlign: "center", marginBottom: 56 }}>
                <span className="section-label">{language === "ar" ? "المسارات التعليمية" : "Learning Tracks"}</span>
                <h2 className="font-display" style={{ fontSize: "clamp(28px, 4vw, 46px)", marginBottom: 14 }}>
                  <span className="grad-text">
                    {language === "ar" ? "مسار مصمم لكل فئة عمرية" : "Designed for Every Age Group"}
                  </span>
                </h2>
              </div>

              <Tabs defaultValue={tracks[0]?.age_group} className="w-full">
                <TabsList
                  className="grid w-full max-w-xl mx-auto mb-12"
                  style={{ gridTemplateColumns: `repeat(${tracks.length}, 1fr)` }}
                >
                  {tracks.map((tr) => (
                    <TabsTrigger key={tr.age_group} value={tr.age_group}>
                      {l(tr.title_en, tr.title_ar)}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {tracks.map((tr) => {
                  const generalSteps = tr.steps.filter((s) => s.path_type === "general");
                  const softwareSteps = tr.steps.filter((s) => s.path_type === "software");
                  const hardwareSteps = tr.steps.filter((s) => s.path_type === "hardware");
                  const hasBranches = softwareSteps.length > 0 || hardwareSteps.length > 0;
                  return (
                    <TabsContent key={tr.age_group} value={tr.age_group}>
                      <p
                        style={{
                          textAlign: "center",
                          color: "rgba(240,240,255,.5)",
                          marginBottom: 48,
                          fontSize: 15,
                          lineHeight: 1.7,
                        }}
                      >
                        {l(tr.intro_en, tr.intro_ar)}
                      </p>
                      <div style={{ position: "relative", paddingInlineStart: 60 }}>
                        <div className="timeline-line" />
                        {generalSteps.map((step, i) => (
                          <div
                            key={step.id}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 16,
                              marginBottom: 28,
                              position: "relative",
                            }}
                          >
                            <div
                              style={{
                                position: "absolute",
                                insetInlineStart: -60 + 12,
                                width: 24,
                                height: 24,
                                borderRadius: "50%",
                                background: `linear-gradient(135deg, var(--kojo-violet), var(--kojo-pink))`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#fff",
                                flexShrink: 0,
                                zIndex: 1,
                                boxShadow: "0 0 0 4px rgba(100,85,240,.15)",
                              }}
                            >
                              {step.step_number}
                            </div>
                            <div className="card" style={{ padding: "16px 20px", flex: 1, marginBottom: 0 }}>
                              <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                                {l(step.title_en, step.title_ar)}
                              </h4>
                              <p style={{ color: "rgba(240,240,255,.45)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                                {l(step.desc_en, step.desc_ar)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {hasBranches && (
                        <div style={{ marginTop: 32 }}>
                          <h4
                            className="font-display grad-text"
                            style={{ textAlign: "center", fontSize: 18, marginBottom: 20 }}
                          >
                            {language === "ar" ? "اختر مسارك" : "Choose Your Path"}
                          </h4>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            {[
                              {
                                label: language === "ar" ? "💻 مسار Software" : "💻 Software Path",
                                steps: softwareSteps,
                              },
                              {
                                label: language === "ar" ? "🔧 مسار Hardware" : "🔧 Hardware Path",
                                steps: hardwareSteps,
                              },
                            ].map(
                              ({ label, steps: bs }) =>
                                bs.length > 0 && (
                                  <div className="card" key={label} style={{ padding: "20px 18px" }}>
                                    <h5 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{label}</h5>
                                    {bs.map((step) => (
                                      <div key={step.id} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                                        <div
                                          style={{
                                            width: 22,
                                            height: 22,
                                            borderRadius: "50%",
                                            background: "rgba(100,85,240,.15)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: 10,
                                            fontWeight: 700,
                                            color: "var(--kojo-violet)",
                                            flexShrink: 0,
                                          }}
                                        >
                                          {step.step_number}
                                        </div>
                                        <div>
                                          <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 2px" }}>
                                            {l(step.title_en, step.title_ar)}
                                          </p>
                                          <p
                                            style={{
                                              fontSize: 12,
                                              color: "rgba(240,240,255,.4)",
                                              margin: 0,
                                              lineHeight: 1.5,
                                            }}
                                          >
                                            {l(step.desc_en, step.desc_ar)}
                                          </p>
                                          {step.specializations?.length! > 0 && (
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                                              {step.specializations!.map((sp) => (
                                                <span
                                                  key={sp}
                                                  style={{
                                                    fontSize: 11,
                                                    padding: "2px 8px",
                                                    borderRadius: 999,
                                                    background: "rgba(97,186,226,.1)",
                                                    color: "var(--kojo-cyan)",
                                                    border: "1px solid rgba(97,186,226,.2)",
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
          <section id="plans" style={{ padding: "100px 24px", position: "relative", zIndex: 1 }}>
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
              <div style={{ textAlign: "center", marginBottom: 60 }}>
                <span className="section-label">{language === "ar" ? "الباقات" : "Pricing"}</span>
                <h2 className="font-display" style={{ fontSize: "clamp(28px, 4vw, 46px)", marginBottom: 14 }}>
                  <span className="grad-text">{language === "ar" ? "اختر باقتك" : "Choose Your Plan"}</span>
                </h2>
                <p style={{ color: "rgba(240,240,255,.45)", maxWidth: 400, margin: "0 auto", fontSize: 16 }}>
                  {language === "ar" ? "باقات مرنة لكل احتياج" : "Flexible plans for every need"}
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`card${plan.is_featured ? " plan-featured" : ""}`}
                    style={{ padding: "32px 28px", position: "relative" }}
                  >
                    {plan.is_featured && (
                      <div
                        style={{
                          position: "absolute",
                          top: -12,
                          left: "50%",
                          transform: "translateX(-50%)",
                          padding: "4px 18px",
                          borderRadius: 999,
                          background: "linear-gradient(135deg, var(--kojo-violet), var(--kojo-pink))",
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#fff",
                          whiteSpace: "nowrap",
                          boxShadow: "0 6px 20px rgba(100,85,240,.4)",
                        }}
                      >
                        {language === "ar" ? "⭐ الأكثر طلباً" : "⭐ Most Popular"}
                      </div>
                    )}

                    <h3 className="font-display" style={{ fontSize: 20, marginBottom: 20, textAlign: "center" }}>
                      {l(plan.name_en, plan.name_ar)}
                    </h3>

                    <div style={{ textAlign: "center", marginBottom: 24 }}>
                      {plan.price_number > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 10px",
                              borderRadius: 999,
                              background: "rgba(255,255,255,.06)",
                              color: "rgba(240,240,255,.5)",
                              marginInlineEnd: 8,
                            }}
                          >
                            {language === "ar" ? "أوفلاين" : "Offline"}
                          </span>
                          {plan.price_before_discount > plan.price_number && (
                            <span
                              style={{
                                textDecoration: "line-through",
                                color: "rgba(240,240,255,.3)",
                                marginInlineEnd: 6,
                                fontSize: 16,
                              }}
                            >
                              {plan.price_before_discount}
                            </span>
                          )}
                          <span className="font-display grad-text" style={{ fontSize: 32 }}>
                            {plan.price_number}
                          </span>
                          <span style={{ color: "rgba(240,240,255,.35)", fontSize: 12, marginInlineStart: 4 }}>
                            {plan.price_currency}/{l(plan.billing_period_en, plan.billing_period_ar)}
                          </span>
                        </div>
                      )}
                      {plan.price_online > 0 && (
                        <div>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 10px",
                              borderRadius: 999,
                              background: "rgba(100,85,240,.12)",
                              color: "var(--kojo-violet)",
                              marginInlineEnd: 8,
                            }}
                          >
                            {language === "ar" ? "أونلاين" : "Online"}
                          </span>
                          {plan.price_online_before_discount > plan.price_online && (
                            <span
                              style={{
                                textDecoration: "line-through",
                                color: "rgba(240,240,255,.3)",
                                marginInlineEnd: 6,
                                fontSize: 16,
                              }}
                            >
                              {plan.price_online_before_discount}
                            </span>
                          )}
                          <span className="font-display grad-text" style={{ fontSize: 32 }}>
                            {plan.price_online}
                          </span>
                          <span style={{ color: "rgba(240,240,255,.35)", fontSize: 12, marginInlineStart: 4 }}>
                            {plan.price_currency}/{l(plan.billing_period_en, plan.billing_period_ar)}
                          </span>
                        </div>
                      )}
                      {plan.price_number <= 0 && plan.price_online <= 0 && (
                        <span className="font-display grad-text" style={{ fontSize: 24 }}>
                          {language === "ar" ? "تواصل معنا" : "Contact Us"}
                        </span>
                      )}
                    </div>

                    <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 16, marginBottom: 16 }}>
                      {plan.sessions_per_month && (
                        <div className="check-row">
                          <div className="check-icon">
                            <Check size={11} color="var(--kojo-violet)" />
                          </div>
                          <span>
                            {plan.sessions_per_month} {language === "ar" ? "حصص/شهر" : "sessions/month"}
                          </span>
                        </div>
                      )}
                      {plan.session_duration_minutes && (
                        <div className="check-row">
                          <div className="check-icon">
                            <Check size={11} color="var(--kojo-violet)" />
                          </div>
                          <span>
                            {plan.session_duration_minutes} {language === "ar" ? "دقيقة/حصة" : "min/session"}
                          </span>
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: 24 }}>
                      {plan.benefits.map((b) => (
                        <div key={b.id} className="check-row">
                          <div className="check-icon">
                            <Check size={11} color="var(--kojo-violet)" />
                          </div>
                          <span style={{ color: "rgba(240,240,255,.7)" }}>{l(b.text_en, b.text_ar)}</span>
                        </div>
                      ))}
                    </div>

                    <Button
                      asChild
                      className={plan.is_featured ? "grad-btn" : ""}
                      style={{
                        width: "100%",
                        borderRadius: 12,
                        height: 46,
                        ...(plan.is_featured
                          ? {}
                          : {
                              background: "rgba(255,255,255,.05)",
                              border: "1px solid rgba(255,255,255,.12)",
                              color: "rgba(240,240,255,.8)",
                            }),
                      }}
                    >
                      <Link to={s?.cta_url || "/auth"}>{l(s?.cta_text_en, s?.cta_text_ar)}</Link>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ══════════ FAQ ══════════ */}
        <section id="faq" style={{ padding: "100px 24px", position: "relative", zIndex: 1 }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, transparent 0%, rgba(100,85,240,.04) 50%, transparent 100%)",
              pointerEvents: "none",
            }}
          />
          <div style={{ maxWidth: 720, margin: "0 auto", position: "relative" }}>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <span className="section-label">{language === "ar" ? "الأسئلة الشائعة" : "FAQ"}</span>
              <h2 className="font-display" style={{ fontSize: "clamp(28px, 4vw, 46px)" }}>
                <span className="grad-text">{language === "ar" ? "إجابات على أسئلتك" : "Got Questions?"}</span>
              </h2>
            </div>

            <Accordion type="single" collapsible>
              {faqData.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="faq-item"
                  style={{ padding: "0 20px", marginBottom: 10, borderRadius: 16 }}
                >
                  <AccordionTrigger
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      paddingTop: 18,
                      paddingBottom: 18,
                      color: "var(--kojo-text)",
                    }}
                  >
                    {l(faq.q_en, faq.q_ar)}
                  </AccordionTrigger>
                  <AccordionContent
                    style={{ color: "rgba(240,240,255,.5)", fontSize: 14, lineHeight: 1.7, paddingBottom: 18 }}
                  >
                    {l(faq.a_en, faq.a_ar)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ══════════ CONTACT ══════════ */}
        <section id="contact" style={{ padding: "100px 24px", position: "relative", zIndex: 1 }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <span className="section-label">{language === "ar" ? "تواصل معنا" : "Contact"}</span>
              <h2 className="font-display" style={{ fontSize: "clamp(28px, 4vw, 46px)", marginBottom: 14 }}>
                <span className="grad-text">{language === "ar" ? "نحن هنا لك" : "We're Here for You"}</span>
              </h2>
              <p style={{ color: "rgba(240,240,255,.45)", maxWidth: 400, margin: "0 auto", fontSize: 16 }}>
                {language === "ar" ? "تواصل معنا بأي طريقة تناسبك" : "Reach out through any channel that suits you"}
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
              {socialLinks.map((link) => {
                const Icon = socialIconMap[link.platform] || MessageCircle;
                const label = socialLabelMap[link.platform] || { en: link.platform, ar: link.platform };
                return (
                  <a
                    key={link.platform}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="contact-card"
                  >
                    <div className="contact-icon">
                      <Icon className="w-7 h-7" style={{ color: "#fff" }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{language === "ar" ? label.ar : label.en}</span>
                  </a>
                );
              })}
              {s?.email && (
                <a href={`mailto:${s.email}`} className="contact-card">
                  <div className="contact-icon">
                    <Mail size={26} color="#fff" />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {language === "ar" ? "البريد الإلكتروني" : "Email"}
                  </span>
                  <span style={{ fontSize: 12, color: "rgba(240,240,255,.35)" }}>{s.email}</span>
                </a>
              )}
              {s?.phone && (
                <a href={`tel:${s.phone}`} className="contact-card">
                  <div className="contact-icon">
                    <Phone size={26} color="#fff" />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{language === "ar" ? "الهاتف" : "Phone"}</span>
                  <span style={{ fontSize: 12, color: "rgba(240,240,255,.35)" }}>{s.phone}</span>
                </a>
              )}
            </div>

            {(s?.address_en || s?.address_ar) && (
              <div style={{ textAlign: "center", marginTop: 32 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    color: "rgba(240,240,255,.45)",
                    fontSize: 14,
                  }}
                >
                  <MapPin size={16} color="var(--kojo-violet)" />
                  {l(s?.address_en, s?.address_ar)}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ══════════ FOOTER ══════════ */}
        <footer className="kojo-footer" style={{ position: "relative", zIndex: 1 }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src={kojobotLogo} alt="Kojobot" style={{ height: 28 }} />
              <span className="font-display grad-text" style={{ fontSize: 18 }}>
                Kojobot
              </span>
            </div>
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
                        background: "rgba(255,255,255,.04)",
                        border: "1px solid rgba(255,255,255,.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "rgba(240,240,255,.45)",
                        textDecoration: "none",
                        transition: "background .2s, color .2s, border-color .2s",
                      }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget;
                        el.style.background = "rgba(139,92,246,.15)";
                        el.style.color = "var(--kojo-violet)";
                        el.style.borderColor = "rgba(139,92,246,.3)";
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget;
                        el.style.background = "rgba(255,255,255,.04)";
                        el.style.color = "rgba(240,240,255,.45)";
                        el.style.borderColor = "rgba(255,255,255,.08)";
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </a>
                  );
                })}
              </div>
            )}
            <p style={{ color: "rgba(240,240,255,.3)", fontSize: 13, margin: 0 }}>
              {l(s?.footer_text_en, s?.footer_text_ar)}
            </p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Index;
