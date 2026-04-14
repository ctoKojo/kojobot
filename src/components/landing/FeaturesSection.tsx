import { Monitor } from "lucide-react";
import { iconMap, l } from "./types";
import type { LandingContent } from "./types";

interface FeaturesSectionProps {
  features: LandingContent["features"];
  language: string;
}

export const FeaturesSection = ({ features, language }: FeaturesSectionProps) => {
  if (features.length === 0) return null;

  return (
    <section id="features" className="section-pad" style={{ padding: "100px 24px", position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <span className="section-label">{language === "ar" ? "لماذا كوجوبوت" : "Why Kojobot"}</span>
          <h2 className="font-display" style={{ fontSize: "clamp(28px, 4vw, 46px)", marginBottom: 14 }}>
            <span className="grad-text">
              {language === "ar" ? "منصة تعليمية متكاملة" : "A Complete Learning Platform"}
            </span>
          </h2>
          <p style={{ color: "rgba(240,240,255,.45)", maxWidth: 480, margin: "0 auto", fontSize: 16, lineHeight: 1.7 }}>
            {language === "ar" ? "كل ما يحتاجه طفلك لرحلته في عالم التكنولوجيا" : "Everything your child needs for their tech journey"}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
          {features.map((f) => {
            const Icon = iconMap[f.icon_name] || Monitor;
            return (
              <div className="card" key={f.id} style={{ padding: "28px 24px" }}>
                <div className="icon-wrap">
                  <Icon size={22} color="#fff" />
                </div>
                <h3 className="font-display" style={{ fontSize: 17, marginBottom: 8 }}>
                  {l(f.title_en, f.title_ar, language)}
                </h3>
                <p style={{ color: "rgba(240,240,255,.45)", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                  {l(f.desc_en, f.desc_ar, language)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
