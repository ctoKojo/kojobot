import { Star } from "lucide-react";
import type { LandingContent } from "./types";

interface TestimonialsSectionProps {
  testimonials: NonNullable<LandingContent["testimonials"]>;
  language: string;
  isRTL: boolean;
}

export const TestimonialsSection = ({ testimonials, language, isRTL }: TestimonialsSectionProps) => {
  if (testimonials.length === 0) return null;

  return (
    <section id="testimonials" className="section-pad" style={{ padding: "100px 24px", position: "relative", zIndex: 1 }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 0%, rgba(100,85,240,.06) 50%, transparent 100%)", pointerEvents: "none" }} />
      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <span className="section-label">{language === "ar" ? "آراء أولياء الأمور" : "Parent Reviews"}</span>
          <h2 className="font-display" style={{ fontSize: "clamp(28px, 4vw, 46px)" }}>
            <span className="grad-text">{language === "ar" ? "ماذا يقول أولياء الأمور" : "What Parents Say"}</span>
          </h2>
          <p style={{ color: "rgba(240,240,255,.45)", maxWidth: 500, margin: "12px auto 0", fontSize: 16 }}>
            {language === "ar" ? "آراء حقيقية من أولياء أمور طلابنا" : "Real feedback from our students' parents"}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          {testimonials.map((t) => (
            <div
              key={t.id}
              style={{
                background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 20, padding: "28px 24px", transition: "border-color .3s, transform .3s, box-shadow .3s",
                position: "relative", overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.borderColor = "rgba(139,92,246,.3)";
                el.style.transform = "translateY(-4px)";
                el.style.boxShadow = "0 12px 40px rgba(139,92,246,.12)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.borderColor = "rgba(255,255,255,.08)";
                el.style.transform = "translateY(0)";
                el.style.boxShadow = "none";
              }}
            >
              <div style={{
                position: "absolute", top: 16, [isRTL ? "left" : "right"]: 20,
                fontSize: 48, lineHeight: 1, color: "rgba(139,92,246,.15)", fontFamily: "Georgia, serif", fontWeight: 700,
              }}>
                "
              </div>

              <div style={{ display: "flex", gap: 3, marginBottom: 16 }}>
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} size={16} fill="#f59e0b" color="#f59e0b" />
                ))}
              </div>

              <p style={{ color: "rgba(240,240,255,.7)", fontSize: 15, lineHeight: 1.8, marginBottom: 20, minHeight: 60 }}>
                {t.content_en || t.content_ar}
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: 12, borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 16 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: "linear-gradient(135deg, rgba(139,92,246,.3), rgba(100,85,240,.2))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 700, color: "rgba(240,240,255,.8)",
                }}>
                  {t.parent_name.charAt(0)}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(240,240,255,.85)", margin: 0 }}>{t.parent_name}</p>
                  <p style={{ fontSize: 12, color: "rgba(240,240,255,.35)", margin: 0 }}>
                    {language === "ar" ? "ولي أمر" : "Parent"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
