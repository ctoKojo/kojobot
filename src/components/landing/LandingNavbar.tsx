import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/LanguageToggle";
import kojobotLogo from "@/assets/kojobot-main-logo.png";
import { navSections, scrollTo, l } from "./types";

interface LandingNavbarProps {
  language: string;
  isRTL: boolean;
  scrolled: boolean;
  ctaUrl: string;
  ctaText: string;
}

export const LandingNavbar = ({ language, isRTL, scrolled, ctaUrl, ctaText }: LandingNavbarProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
              onClick={() => { scrollTo(sec.id); setMobileMenuOpen(false); }}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--kojo-text)", fontSize: 20, fontWeight: 600,
                fontFamily: isRTL ? "Cairo" : "Poppins", padding: "8px 0",
              }}
            >
              {language === "ar" ? sec.ar : sec.en}
            </button>
          ))}
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
