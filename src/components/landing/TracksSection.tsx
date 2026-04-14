import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { l } from "./types";
import type { LandingContent } from "./types";

interface TracksSectionProps {
  tracks: LandingContent["tracks"];
  language: string;
  isRTL: boolean;
}

export const TracksSection = ({ tracks, language, isRTL }: TracksSectionProps) => {
  if (tracks.length === 0) return null;

  return (
    <section id="tracks" className="section-pad" style={{ padding: "100px 24px", position: "relative", zIndex: 1 }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 0%, rgba(100,85,240,.04) 50%, transparent 100%)", pointerEvents: "none" }} />
      <div style={{ maxWidth: 900, margin: "0 auto", position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <span className="section-label">{language === "ar" ? "المسارات التعليمية" : "Learning Tracks"}</span>
          <h2 className="font-display" style={{ fontSize: "clamp(28px, 4vw, 46px)", marginBottom: 14 }}>
            <span className="grad-text">{language === "ar" ? "مسار مصمم لكل فئة عمرية" : "Designed for Every Age Group"}</span>
          </h2>
        </div>

        <Tabs defaultValue={tracks[0]?.age_group} className="w-full">
          <TabsList
            className="w-full max-w-xl mx-auto mb-12"
            style={{ display: "grid", gridTemplateColumns: `repeat(${tracks.length}, minmax(0, 1fr))` }}
          >
            {tracks.map((tr) => (
              <TabsTrigger key={tr.age_group} value={tr.age_group}>
                {l(tr.title_en, tr.title_ar, language)}
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
                <p style={{ textAlign: "center", color: "rgba(240,240,255,.5)", marginBottom: 48, fontSize: 15, lineHeight: 1.7 }}>
                  {l(tr.intro_en, tr.intro_ar, language)}
                </p>

                <div className="timeline-container" style={{ position: "relative", ...(isRTL ? { paddingRight: 48 } : { paddingLeft: 48 }) }}>
                  <div className="timeline-line" />
                  {generalSteps.map((step) => (
                    <div key={step.id} style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 28, position: "relative" }}>
                      <div style={{
                        position: "absolute",
                        ...(isRTL ? { right: -48 + 4 } : { left: -48 + 4 }),
                        width: 24, height: 24, borderRadius: "50%",
                        background: "linear-gradient(135deg, var(--kojo-violet), var(--kojo-pink))",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0, zIndex: 1,
                        boxShadow: "0 0 0 4px rgba(100,85,240,.15)",
                      }}>
                        {step.step_number}
                      </div>
                      <div className="card" style={{ padding: "16px 20px", flex: 1, marginBottom: 0, textAlign: isRTL ? "right" : "left" }}>
                        <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{l(step.title_en, step.title_ar, language)}</h4>
                        <p style={{ color: "rgba(240,240,255,.45)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>{l(step.desc_en, step.desc_ar, language)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {hasBranches && (
                  <div style={{ marginTop: 32 }}>
                    <h4 className="font-display grad-text" style={{ textAlign: "center", fontSize: 18, marginBottom: 20 }}>
                      {language === "ar" ? "اختر مسارك" : "Choose Your Path"}
                    </h4>
                    <div className="branch-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      {[
                        { label: language === "ar" ? "💻 مسار Software" : "💻 Software Path", steps: softwareSteps },
                        { label: language === "ar" ? "🔧 مسار Hardware" : "🔧 Hardware Path", steps: hardwareSteps },
                      ].map(({ label, steps: bs }) =>
                        bs.length > 0 && (
                          <div className="card" key={label} style={{ padding: "20px 18px", textAlign: isRTL ? "right" : "left" }}>
                            <h5 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{label}</h5>
                            {bs.map((step) => (
                              <div key={step.id} style={{ display: "flex", flexDirection: isRTL ? "row-reverse" : "row", gap: 10, marginBottom: 12 }}>
                                <div style={{
                                  width: 22, height: 22, borderRadius: "50%",
                                  background: "rgba(100,85,240,.15)",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 10, fontWeight: 700, color: "var(--kojo-violet)", flexShrink: 0,
                                }}>
                                  {step.step_number}
                                </div>
                                <div>
                                  <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 2px" }}>{l(step.title_en, step.title_ar, language)}</p>
                                  <p style={{ fontSize: 12, color: "rgba(240,240,255,.4)", margin: 0, lineHeight: 1.5 }}>{l(step.desc_en, step.desc_ar, language)}</p>
                                  {step.specializations && step.specializations.length > 0 && (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, justifyContent: isRTL ? "flex-end" : "flex-start" }}>
                                      {step.specializations.map((sp) => (
                                        <span key={sp} style={{
                                          fontSize: 11, padding: "2px 8px", borderRadius: 999,
                                          background: "rgba(97,186,226,.1)", color: "var(--kojo-cyan)",
                                          border: "1px solid rgba(97,186,226,.2)",
                                        }}>
                                          {sp}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
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
  );
};
