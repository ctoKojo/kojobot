import { Link } from "react-router-dom";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scrollTo } from "./types";

interface HeroSectionProps {
  language: string;
  isRTL: boolean;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaUrl: string;
}

export const HeroSection = ({ language, isRTL, title, subtitle, ctaText, ctaUrl }: HeroSectionProps) => {
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <section className="hero-section" style={{ position: "relative", paddingTop: 160, paddingBottom: 100, overflow: "hidden", zIndex: 1 }}>
      <div className="hero-glow" style={{ width: 500, height: 500, top: -100, left: -150, background: "rgba(100,85,240,.18)" }} />
      <div className="hero-glow" style={{ width: 400, height: 400, top: 50, right: -100, background: "rgba(97,186,226,.12)" }} />
      <div className="hero-glow" style={{ width: 300, height: 300, bottom: -50, left: "40%", background: "rgba(97,186,226,.1)" }} />

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px", textAlign: "center", position: "relative", zIndex: 2 }}>
        <div className="badge-pill">
          <span className="dot" />{" "}
          {language === "ar" ? "منصة البرمجة للأجيال القادمة" : "Coding Platform for the Next Generation"}
        </div>

        <h1 className="font-display" style={{ fontSize: "clamp(36px, 6vw, 72px)", lineHeight: 1.08, marginBottom: 24 }}>
          <span className="grad-text">{title}</span>
        </h1>

        <p style={{ fontSize: "clamp(15px, 2vw, 19px)", color: "rgba(240,240,255,.55)", maxWidth: 540, margin: "0 auto 40px", lineHeight: 1.7 }}>
          {subtitle}
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Button asChild size="lg" className="grad-btn" style={{ borderRadius: 14, padding: "0 32px", height: 52, fontSize: 16 }}>
            <Link to={ctaUrl} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {ctaText} <Arrow size={18} />
            </Link>
          </Button>
          <button
            onClick={() => scrollTo("plans")}
            style={{
              height: 52, padding: "0 28px", borderRadius: 14,
              background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.12)",
              color: "rgba(240,240,255,.75)", fontSize: 15, cursor: "pointer",
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

        <div className="stat-bar" style={{ marginTop: 64 }}>
          {[
            { num: "500+", label: language === "ar" ? "طالب خريج" : "Active Students" },
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
  );
};
