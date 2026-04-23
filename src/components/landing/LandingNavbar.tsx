import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import kojobotLogo from "@/assets/kojobot-main-logo.png";
import { navSections, scrollTo } from "./types";

interface LandingNavbarProps {
  language?: string;
  isRTL?: boolean;
  scrolled?: boolean;
  ctaUrl?: string;
  ctaText?: string;
}

export const LandingNavbar = ({
  language: languageProp,
  isRTL: isRTLProp,
  scrolled: scrolledProp,
  ctaUrl: ctaUrlProp,
  ctaText: ctaTextProp,
}: LandingNavbarProps) => {
  const ctx = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const language = languageProp ?? ctx.language;
  const isRTL = isRTLProp ?? ctx.isRTL;
  const ctaUrl = ctaUrlProp ?? "/auth";
  const ctaText = ctaTextProp ?? (isRTL ? "تسجيل الدخول" : "Sign In");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [internalScrolled, setInternalScrolled] = useState(false);

  // Track scroll for standalone usage
  useEffect(() => {
    if (scrolledProp !== undefined) return;
    const onScroll = () => setInternalScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [scrolledProp]);

  const scrolled = scrolledProp ?? internalScrolled;
  const isOnLanding = location.pathname === "/" || location.pathname === "/ar" || location.pathname === "/en";

  const handleSectionNav = (id: string) => {
    if (isOnLanding) {
      scrollTo(id);
    } else {
      navigate(`/${language}#${id}`);
    }
  };

  // After navigating with hash, scroll to the section
  useEffect(() => {
    if (isOnLanding && location.hash) {
      const id = location.hash.replace("#", "");
      // small delay to allow DOM to render
      setTimeout(() => scrollTo(id), 100);
    }
  }, [isOnLanding, location.hash]);

  return (
    <>
      <nav className={`kojo-nav${scrolled ? " scrolled" : ""}`}>
        <Link to={`/${language}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <img src={kojobotLogo} alt="Kojobot" style={{ height: 36 }} />
        </Link>

        <div
          style={{ gap: 4, flex: 1, justifyContent: "center", flexWrap: "nowrap" }}
          className="hidden md:flex"
        >
          {navSections.map((sec) => (
            <button
              key={sec.id}
              onClick={() => handleSectionNav(sec.id)}
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
          <Link
            to="/careers"
            style={{
              padding: "6px 14px",
              cursor: "pointer",
              color: "rgba(240,240,255,.5)",
              fontSize: 14,
              borderRadius: 8,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: "color .2s, background .2s",
              fontFamily: isRTL ? "Cairo" : "Poppins",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#f0f0ff";
              e.currentTarget.style.background = "rgba(100,85,240,.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(240,240,255,.5)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <Briefcase size={14} />
            {language === "ar" ? "الوظائف" : "Careers"}
          </Link>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <LanguageToggle />
          <button
            className="mobile-menu-btn md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Button
            asChild
            size="sm"
            className="grad-btn hidden sm:inline-flex"
            style={{ borderRadius: 10, padding: "0 18px", height: 36, fontSize: 14 }}
          >
            <Link to={ctaUrl}>{ctaText}</Link>
          </Button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="mobile-menu-overlay">
          <button
            onClick={() => setMobileMenuOpen(false)}
            style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "var(--kojo-text)", cursor: "pointer" }}
          >
            <X size={28} />
          </button>
          {navSections.map((sec) => (
            <button
              key={sec.id}
              onClick={() => { handleSectionNav(sec.id); setMobileMenuOpen(false); }}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--kojo-text)", fontSize: 20, fontWeight: 600,
                fontFamily: isRTL ? "Cairo" : "Poppins", padding: "8px 0",
              }}
            >
              {language === "ar" ? sec.ar : sec.en}
            </button>
          ))}
          <Link
            to="/careers"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              color: "var(--kojo-text)", fontSize: 20, fontWeight: 600,
              fontFamily: isRTL ? "Cairo" : "Poppins", padding: "8px 0",
              textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
            }}
          >
            <Briefcase size={20} />
            {language === "ar" ? "الوظائف" : "Careers"}
          </Link>
          <Button
            asChild
            className="grad-btn"
            style={{ borderRadius: 14, padding: "0 32px", height: 48, fontSize: 16, marginTop: 16 }}
          >
            <Link to={ctaUrl} onClick={() => setMobileMenuOpen(false)}>
              {ctaText}
            </Link>
          </Button>
        </div>
      )}
    </>
  );
};
