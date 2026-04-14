import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { publicSupabase } from "@/integrations/supabase/publicClient";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Button } from "@/components/ui/button";
import kojobotLogo from "@/assets/kojobot-main-logo.png";

import { LandingStyles } from "@/components/landing/LandingStyles";
import { ParticleGrid } from "@/components/landing/ParticleGrid";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { TracksSection } from "@/components/landing/TracksSection";
import { PlansSection } from "@/components/landing/PlansSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { ContactSection } from "@/components/landing/ContactSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { l, faqData, SITE_URL } from "@/components/landing/types";
import type { LandingContent, SocialLink } from "@/components/landing/types";

interface IndexProps {
  lang?: "ar" | "en";
}

const Index = ({ lang: routeLang }: IndexProps) => {
  const { language: ctxLanguage, setLanguage } = useLanguage();
  const navigate = useNavigate();

  const language = routeLang || ctxLanguage;
  const isRTL = language === "ar";

  useEffect(() => {
    if (routeLang && routeLang !== ctxLanguage) {
      setLanguage(routeLang);
    }
  }, [routeLang]);

  useEffect(() => {
    if (!routeLang) {
      const saved = localStorage.getItem("kojobot-language") as "ar" | "en" | null;
      navigate(`/${saved || "ar"}`, { replace: true });
    }
  }, [routeLang]);

  // SEO
  useEffect(() => {
    if (!routeLang) return;
    const title =
      language === "ar"
        ? "كوجوبوت اكاديمي - تعليم البرمجة للأطفال من 6 لـ 18 سنة"
        : "Kojobot Academy - Coding & Technology for Kids Aged 6-18";
    const description =
      language === "ar"
        ? "اكاديمية كوجوبوت لتعليم البرمجة والتكنولوجيا للأطفال من 6 لـ 18 سنة - اونلاين واوفلاين في المنصورة"
        : "Kojobot Academy teaches coding and technology to kids aged 6-18 - online and offline in Mansoura, Egypt";

    document.title = title;
    document.documentElement.lang = language;
    document.documentElement.dir = isRTL ? "rtl" : "ltr";

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.content = content;
    };
    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);

    const canonicalUrl = `${SITE_URL}/${language}`;
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    const hreflangs = [
      { lang: "ar", href: `${SITE_URL}/ar` },
      { lang: "en", href: `${SITE_URL}/en` },
      { lang: "x-default", href: `${SITE_URL}/en` },
    ];
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
    hreflangs.forEach(({ lang: hl, href }) => {
      const link = document.createElement("link");
      link.rel = "alternate";
      link.hreflang = hl;
      link.href = href;
      document.head.appendChild(link);
    });

    return () => {
      document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
      const can = document.querySelector('link[rel="canonical"]');
      if (can) can.remove();
    };
  }, [language, routeLang]);

  const [content, setContent] = useState<LandingContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    const loadContent = async () => {
      try {
        const { data, error } = await publicSupabase.rpc("get_landing_content");
        if (error) {
          console.error("Failed to load landing content:", error);
          setFetchError(true);
        } else if (data) {
          setContent(data as unknown as LandingContent);
        } else {
          setFetchError(true);
        }
      } catch (err) {
        console.error("Landing content fetch exception:", err);
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    };
    loadContent();
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // JSON-LD
  useEffect(() => {
    if (!routeLang || !content) return;
    const s = content.settings;

    const orgSchema = {
      "@context": "https://schema.org",
      "@type": "EducationalOrganization",
      name: language === "ar" ? "كوجوبوت اكاديمي" : "Kojobot Academy",
      alternateName: language === "ar" ? "Kojobot Academy" : "كوجوبوت اكاديمي",
      url: `${SITE_URL}/${language}`,
      description:
        language === "ar"
          ? "اكاديمية كوجوبوت لتعليم البرمجة والتكنولوجيا للأطفال من 6 لـ 18 سنة - اونلاين واوفلاين في المنصورة"
          : "Kojobot Academy teaches coding and technology to kids aged 6-18 - online and offline in Mansoura, Egypt",
      logo: `${SITE_URL}/kojobot-logo-white.png`,
      ...(s?.email ? { email: s.email } : {}),
      ...(s?.phone ? { telephone: s.phone } : {}),
      ...(s?.address_en
        ? {
            address: {
              "@type": "PostalAddress",
              addressLocality: "Mansoura",
              addressCountry: "EG",
              streetAddress: language === "ar" ? s?.address_ar : s?.address_en,
            },
          }
        : {}),
    };

    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqData.map((faq) => ({
        "@type": "Question",
        name: language === "ar" ? faq.q_ar : faq.q_en,
        acceptedAnswer: { "@type": "Answer", text: language === "ar" ? faq.a_ar : faq.a_en },
      })),
    };

    const courseSchemas = [
      {
        "@context": "https://schema.org",
        "@type": "Course",
        name: language === "ar" ? "مسار Software - كوجوبوت" : "Software Path - Kojobot",
        description:
          language === "ar" ? "تعلم البرمجة من سكراتش لبايثون وتطوير الويب" : "Learn coding from Scratch to Python and web development",
        provider: { "@type": "Organization", name: "Kojobot Academy" },
      },
      {
        "@context": "https://schema.org",
        "@type": "Course",
        name: language === "ar" ? "مسار Hardware - كوجوبوت" : "Hardware Path - Kojobot",
        description:
          language === "ar" ? "تعلم الإلكترونيات والروبوتيكس والاردوينو" : "Learn electronics, robotics, and Arduino",
        provider: { "@type": "Organization", name: "Kojobot Academy" },
      },
    ];

    const schemas = [orgSchema, faqSchema, ...courseSchemas];
    const scriptEls: HTMLScriptElement[] = [];
    schemas.forEach((schema) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
      scriptEls.push(script);
    });

    return () => {
      scriptEls.forEach((el) => el.remove());
    };
  }, [language, routeLang, content]);

  if (loading) return <LoadingScreen />;

  if (fetchError && !content) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-8" dir={isRTL ? "rtl" : "ltr"}>
        <img src={kojobotLogo} alt="Kojobot" className="h-16 mb-6" />
        <h1 className="text-2xl font-bold mb-2">
          {language === "ar" ? "تعذّر تحميل المحتوى" : "Unable to load content"}
        </h1>
        <p className="text-muted-foreground mb-6 text-center max-w-md">
          {language === "ar"
            ? "حدث خطأ أثناء تحميل بيانات الصفحة. يرجى المحاولة مرة أخرى."
            : "An error occurred while loading page data. Please try again."}
        </p>
        <Button onClick={() => window.location.reload()}>{language === "ar" ? "إعادة المحاولة" : "Retry"}</Button>
      </div>
    );
  }

  const s = content?.settings;
  const features = content?.features || [];
  const plans = content?.plans || [];
  const tracks = content?.tracks || [];
  const socialLinks: SocialLink[] = Array.isArray(s?.social_links) ? s.social_links : [];
  const testimonials = content?.testimonials || [];

  const ctaUrl = s?.cta_url || "/auth";
  const ctaText = l(s?.cta_text_en, s?.cta_text_ar, language);

  return (
    <>
      <LandingStyles isRTL={isRTL} />

      <div className="kojo-root" dir={isRTL ? "rtl" : "ltr"}>
        <ParticleGrid />

        <LandingNavbar language={language} isRTL={isRTL} scrolled={scrolled} ctaUrl={ctaUrl} ctaText={ctaText} />

        <main>
          <HeroSection
            language={language}
            isRTL={isRTL}
            title={l(s?.hero_title_en, s?.hero_title_ar, language)}
            subtitle={l(s?.hero_subtitle_en, s?.hero_subtitle_ar, language)}
            ctaText={ctaText}
            ctaUrl={ctaUrl}
          />

          <FeaturesSection features={features} language={language} />

          <TracksSection tracks={tracks} language={language} isRTL={isRTL} />

          <PlansSection plans={plans} language={language} />

          <TestimonialsSection testimonials={testimonials} language={language} isRTL={isRTL} />

          <FAQSection language={language} />

          <ContactSection
            socialLinks={socialLinks}
            email={s?.email}
            phone={s?.phone}
            addressEn={s?.address_en}
            addressAr={s?.address_ar}
            language={language}
          />
        </main>

        <LandingFooter socialLinks={socialLinks} footerTextEn={s?.footer_text_en} footerTextAr={s?.footer_text_ar} language={language} />
      </div>
    </>
  );
};

export default Index;
