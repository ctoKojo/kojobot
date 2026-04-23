import { MessageCircle, Briefcase } from "lucide-react";
import { Link } from "react-router-dom";
import kojobotLogo from "@/assets/kojobot-main-logo.png";
import { socialIconMap, l } from "./types";
import type { SocialLink } from "./types";

interface LandingFooterProps {
  socialLinks: SocialLink[];
  footerTextEn?: string;
  footerTextAr?: string;
  language: string;
}

export const LandingFooter = ({ socialLinks, footerTextEn, footerTextAr, language }: LandingFooterProps) => (
  <footer className="kojo-footer" style={{ position: "relative", zIndex: 1 }}>
    <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <img src={kojobotLogo} alt="Kojobot" style={{ height: 28 }} />
        <Link
          to="/careers"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            color: "rgba(240,240,255,.55)", textDecoration: "none",
            fontSize: 13, padding: "6px 12px", borderRadius: 8,
            border: "1px solid rgba(255,255,255,.08)",
            transition: "color .2s, border-color .2s, background .2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--kojo-violet)";
            e.currentTarget.style.borderColor = "rgba(139,92,246,.3)";
            e.currentTarget.style.background = "rgba(139,92,246,.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "rgba(240,240,255,.55)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,.08)";
            e.currentTarget.style.background = "transparent";
          }}
        >
          <Briefcase className="w-3.5 h-3.5" />
          {language === "ar" ? "الوظائف" : "Careers"}
        </Link>
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
                  width: 36, height: 36, borderRadius: 10,
                  background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "rgba(240,240,255,.45)", textDecoration: "none",
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
        {l(footerTextEn, footerTextAr, language)}
      </p>
    </div>
  </footer>
);
