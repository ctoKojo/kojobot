import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { l } from "./types";
import type { LandingContent } from "./types";

interface PlansSectionProps {
  plans: LandingContent["plans"];
  language: string;
}

export const PlansSection = ({ plans, language }: PlansSectionProps) => {
  if (plans.length === 0) return null;

  return (
    <section id="plans" className="section-pad" style={{ padding: "100px 24px", position: "relative", zIndex: 1 }}>
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

        <div className="plan-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, alignItems: "start" }}>
          {plans.map((plan, planIndex) => {
            const inheritedBenefits: typeof plan.benefits = [];
            for (let i = 0; i < planIndex; i++) {
              plans[i].benefits.forEach((b) => {
                if (!inheritedBenefits.some((pb) => pb.text_en === b.text_en)) {
                  inheritedBenefits.push(b);
                }
              });
            }
            const ownBenefits = plan.benefits.filter((b) => !inheritedBenefits.some((ib) => ib.text_en === b.text_en));

            return (
              <div
                key={plan.id}
                className={`card${plan.is_featured ? " plan-featured" : ""}`}
                style={{ padding: "32px 28px", position: "relative", display: "flex", flexDirection: "column" }}
              >
                {plan.is_featured && (
                  <div style={{
                    position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                    padding: "4px 18px", borderRadius: 999,
                    background: "linear-gradient(135deg, var(--kojo-violet), var(--kojo-pink))",
                    fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap",
                    boxShadow: "0 6px 20px rgba(100,85,240,.4)",
                  }}>
                    {language === "ar" ? "⭐ الأكثر طلباً" : "⭐ Most Popular"}
                  </div>
                )}

                <div style={{ minHeight: 210, display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
                  <h3 className="font-display" style={{ fontSize: 20, marginBottom: 6, textAlign: "center" }}>
                    {l(plan.name_en, plan.name_ar, language)}
                  </h3>

                  {(plan.description_en || plan.description_ar) && (
                    <p style={{ textAlign: "center", fontSize: 13, color: "rgba(240,240,255,.45)", marginBottom: 16 }}>
                      {l(plan.description_en, plan.description_ar, language)}
                    </p>
                  )}

                  <div style={{ textAlign: "center", marginBottom: 16 }}>
                    {plan.price_number > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 999, background: "rgba(255,255,255,.06)", color: "rgba(240,240,255,.5)", marginInlineEnd: 8 }}>
                          {language === "ar" ? "أوفلاين" : "Offline"}
                        </span>
                        {plan.price_before_discount > plan.price_number && (
                          <span style={{ textDecoration: "line-through", color: "rgba(240,240,255,.3)", marginInlineEnd: 6, fontSize: 16 }}>
                            {plan.price_before_discount}
                          </span>
                        )}
                        <span className="font-display grad-text" style={{ fontSize: 32 }}>{plan.price_number}</span>
                        <span style={{ color: "rgba(240,240,255,.35)", fontSize: 12, marginInlineStart: 4 }}>
                          {plan.price_currency}/{l(plan.billing_period_en, plan.billing_period_ar, language)}
                        </span>
                      </div>
                    )}
                    {plan.price_online > 0 && (
                      <div>
                        <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 999, background: "rgba(100,85,240,.12)", color: "var(--kojo-violet)", marginInlineEnd: 8 }}>
                          {language === "ar" ? "أونلاين" : "Online"}
                        </span>
                        {plan.price_online_before_discount > plan.price_online && (
                          <span style={{ textDecoration: "line-through", color: "rgba(240,240,255,.3)", marginInlineEnd: 6, fontSize: 16 }}>
                            {plan.price_online_before_discount}
                          </span>
                        )}
                        <span className="font-display grad-text" style={{ fontSize: 32 }}>{plan.price_online}</span>
                        <span style={{ color: "rgba(240,240,255,.35)", fontSize: 12, marginInlineStart: 4 }}>
                          {plan.price_currency}/{l(plan.billing_period_en, plan.billing_period_ar, language)}
                        </span>
                      </div>
                    )}
                    {plan.price_number <= 0 && plan.price_online <= 0 && (
                      <span className="font-display grad-text" style={{ fontSize: 24 }}>
                        {language === "ar" ? "تواصل معنا" : "Contact Us"}
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  asChild
                  className={plan.is_featured ? "grad-btn" : "plan-cta-btn"}
                  style={{
                    width: "100%", borderRadius: 12, height: 46, marginBottom: 20,
                    ...(plan.is_featured ? {} : { background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)", color: "rgba(240,240,255,.8)" }),
                  }}
                >
                  <Link to={`/subscribe?plan=${plan.slug || ""}`}>{language === "ar" ? "اشتراك" : "Subscribe"}</Link>
                </Button>

                <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 16, marginBottom: 16 }}>
                  {plan.sessions_per_month && (
                    <div className="check-row">
                      <div className="check-icon"><Check size={11} color="var(--kojo-violet)" /></div>
                      <span>{plan.sessions_per_month} {language === "ar" ? "حصص/شهر" : "sessions/month"}</span>
                    </div>
                  )}
                  {plan.session_duration_minutes && (
                    <div className="check-row">
                      <div className="check-icon"><Check size={11} color="var(--kojo-violet)" /></div>
                      <span>{plan.session_duration_minutes} {language === "ar" ? "دقيقة/حصة" : "min/session"}</span>
                    </div>
                  )}
                </div>

                {inheritedBenefits.length > 0 && planIndex > 0 && (
                  <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(100,85,240,.06)", border: "1px solid rgba(100,85,240,.12)" }}>
                    <p style={{ fontSize: 13, color: "rgba(240,240,255,.55)", margin: 0 }}>
                      {language === "ar"
                        ? `✅ كل مميزات ${planIndex === 2 ? l(plans[0].name_en, plans[0].name_ar, language) + " و " + l(plans[1].name_en, plans[1].name_ar, language) : l(plans[planIndex - 1].name_en, plans[planIndex - 1].name_ar, language)}`
                        : `✅ All ${planIndex === 2 ? l(plans[0].name_en, plans[0].name_ar, language) + " & " + l(plans[1].name_en, plans[1].name_ar, language) : l(plans[planIndex - 1].name_en, plans[planIndex - 1].name_ar, language)} features`}
                    </p>
                  </div>
                )}

                {ownBenefits.length > 0 && (
                  <div style={{ marginBottom: 8, ...(inheritedBenefits.length > 0 ? { borderTop: "1px dashed rgba(100,85,240,.2)", paddingTop: 12 } : {}) }}>
                    {inheritedBenefits.length > 0 && (
                      <p style={{ fontSize: 11, fontWeight: 700, color: "var(--kojo-violet)", marginBottom: 8, letterSpacing: ".05em" }}>
                        {language === "ar" ? "✨ بالإضافة إلى" : "✨ Plus"}
                      </p>
                    )}
                    {ownBenefits.map((b) => (
                      <div key={b.id} className="check-row">
                        <div className="check-icon"><Check size={11} color="var(--kojo-violet)" /></div>
                        <span style={{ color: "rgba(240,240,255,.7)" }}>{l(b.text_en, b.text_ar, language)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
