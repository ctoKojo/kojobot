import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Briefcase, Calendar, MapPin, Clock } from "lucide-react";
import { publicSupabase } from "@/integrations/supabase/publicClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { LandingStyles } from "@/components/landing/LandingStyles";

interface Job {
  id: string;
  slug: string;
  title_en: string;
  title_ar: string;
  type: string;
  training_season: string | null;
  is_paid: boolean;
  location_en: string | null;
  location_ar: string | null;
  posted_at: string | null;
  deadline_at: string | null;
  is_featured: boolean;
}

const jobTypeLabel: Record<string, { en: string; ar: string; color: string }> = {
  full_time: { en: "Full Time", ar: "دوام كامل", color: "#6455F0" },
  part_time: { en: "Part Time", ar: "دوام جزئي", color: "#61BAE2" },
  internship: { en: "Internship", ar: "تدريب", color: "#f59e0b" },
  volunteer: { en: "Volunteer", ar: "تطوع", color: "#10b981" },
  freelance: { en: "Freelance", ar: "عمل حر", color: "#8b5cf6" },
};

const seasonLabel: Record<string, { en: string; ar: string }> = {
  summer: { en: "Summer", ar: "صيفي" },
  fall: { en: "Fall", ar: "خريفي" },
  winter: { en: "Winter", ar: "شتوي" },
  spring: { en: "Spring", ar: "ربيعي" },
};

export default function Careers() {
  const { language, isRTL } = useLanguage();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const title = isRTL ? "الوظائف — Kojobot Academy" : "Careers — Kojobot Academy";
    const desc = isRTL
      ? "انضم لفريق Kojobot Academy — استكشف الوظائف، التدريب الصيفي، وفرص التطوع المتاحة."
      : "Join the Kojobot Academy team — explore open jobs, summer training, and volunteer opportunities.";
    const url = "https://kojobot.com/careers";
    const ogImg = "https://kojobot.com/kojobot-logo-white.png";

    document.title = title;

    const setMeta = (attr: "name" | "property", key: string, content: string) => {
      let el = document.head.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    const setLink = (rel: string, href: string) => {
      let el = document.head.querySelector(`link[rel="${rel}"]`);
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", rel);
        document.head.appendChild(el);
      }
      el.setAttribute("href", href);
    };

    setMeta("name", "description", desc);
    setLink("canonical", url);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", ogImg);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", desc);
    setMeta("name", "twitter:image", ogImg);
  }, [isRTL]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await publicSupabase
        .from("jobs")
        .select("id,slug,title_en,title_ar,type,training_season,is_paid,location_en,location_ar,posted_at,deadline_at,is_featured")
        .eq("status", "published")
        .order("is_featured", { ascending: false })
        .order("posted_at", { ascending: false });
      setJobs((data as Job[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = filter === "all" ? jobs : jobs.filter((j) => j.type === filter);
  const getJobPath = (job: Job) => `/careers/${job.slug || job.id}`;

  const ArrowIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <div className="kojo-root" dir={isRTL ? "rtl" : "ltr"}>
      <LandingStyles isRTL={isRTL} />

      {/* Header */}
      <header style={{ padding: "24px 0", borderBottom: "1px solid var(--kojo-border)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link to={`/${language}`} style={{ color: "var(--kojo-muted)", display: "flex", alignItems: "center", gap: 8, textDecoration: "none", fontSize: 14 }}>
            <ArrowIcon className="w-4 h-4" />
            {isRTL ? "العودة للرئيسية" : "Back to home"}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section style={{ padding: "80px 24px 40px", textAlign: "center" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: "rgba(100,85,240,.12)", border: "1px solid rgba(100,85,240,.3)", marginBottom: 24, fontSize: 13, color: "var(--kojo-violet)" }}>
            <Briefcase className="w-4 h-4" />
            {isRTL ? "انضم لفريقنا" : "Join our team"}
          </div>
          <h1 className="font-display" style={{ fontSize: "clamp(36px, 6vw, 64px)", margin: "0 0 16px", lineHeight: 1.1 }}>
            <span className="grad-text">{isRTL ? "ابني مستقبلك معنا" : "Build the future with us"}</span>
          </h1>
          <p style={{ color: "var(--kojo-muted)", fontSize: 18, lineHeight: 1.6, margin: 0 }}>
            {isRTL
              ? "اكتشف الفرص المتاحة في Kojobot Academy — وظائف، تدريب صيفي، وفرص تطوع لتأثير حقيقي في تعليم الجيل القادم."
              : "Discover opportunities at Kojobot Academy — jobs, summer training, and volunteer roles to make a real impact on the next generation."}
          </p>
        </div>
      </section>

      {/* Filters */}
      <section style={{ padding: "0 24px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {(["all", ...Object.keys(jobTypeLabel)] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                background: filter === t ? "linear-gradient(135deg, var(--kojo-pink), var(--kojo-violet))" : "rgba(255,255,255,.04)",
                border: filter === t ? "1px solid transparent" : "1px solid var(--kojo-border)",
                color: filter === t ? "#fff" : "var(--kojo-muted)",
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {t === "all" ? (isRTL ? "الكل" : "All") : (isRTL ? jobTypeLabel[t].ar : jobTypeLabel[t].en)}
            </button>
          ))}
        </div>
      </section>

      {/* Jobs grid */}
      <section style={{ padding: "24px 24px 80px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "var(--kojo-muted)", padding: 60 }}>
              {isRTL ? "جاري التحميل…" : "Loading…"}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 80, background: "rgba(255,255,255,.02)", borderRadius: 24, border: "1px dashed var(--kojo-border)" }}>
              <Briefcase className="w-12 h-12" style={{ margin: "0 auto 16px", color: "var(--kojo-muted)" }} />
              <h3 style={{ fontSize: 22, margin: "0 0 8px" }}>{isRTL ? "لا توجد وظائف متاحة حالياً" : "No openings right now"}</h3>
              <p style={{ color: "var(--kojo-muted)", margin: 0 }}>
                {isRTL ? "تابعنا، هنطرح فرص جديدة قريباً." : "Stay tuned — we'll post new roles soon."}
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
              {filtered.map((job) => {
                const typeMeta = jobTypeLabel[job.type];
                return (
                  <Link
                    key={job.id}
                    to={getJobPath(job)}
                    style={{
                      background: "var(--kojo-surface)",
                      border: "1px solid var(--kojo-border)",
                      borderRadius: 20,
                      padding: 24,
                      textDecoration: "none",
                      color: "inherit",
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                      transition: "transform .2s, border-color .2s, box-shadow .2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px)";
                      e.currentTarget.style.borderColor = "rgba(100,85,240,.5)";
                      e.currentTarget.style.boxShadow = "0 12px 32px rgba(100,85,240,.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.borderColor = "var(--kojo-border)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 999, background: `${typeMeta?.color || "#6455F0"}22`, color: typeMeta?.color || "#6455F0", fontSize: 11, fontWeight: 600 }}>
                          {job.type === "internship" && job.training_season
                            ? (isRTL ? `تدريب ${seasonLabel[job.training_season].ar}` : `${seasonLabel[job.training_season].en} Internship`)
                            : (isRTL ? typeMeta?.ar : typeMeta?.en)}
                        </span>
                        <span style={{ padding: "4px 10px", borderRadius: 999, background: job.is_paid ? "rgba(16,185,129,.15)" : "rgba(148,163,184,.15)", color: job.is_paid ? "#10b981" : "#94a3b8", fontSize: 11, fontWeight: 600 }}>
                          {job.is_paid ? (isRTL ? "مدفوع" : "Paid") : (isRTL ? "غير مدفوع" : "Unpaid")}
                        </span>
                      </div>
                      {job.is_featured && (
                        <span style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(245,158,11,.15)", color: "var(--kojo-gold)", fontSize: 11, fontWeight: 600 }}>
                          {isRTL ? "مميزة" : "Featured"}
                        </span>
                      )}
                    </div>
                    <h3 className="font-display" style={{ fontSize: 22, margin: 0, lineHeight: 1.3 }}>
                      {isRTL ? job.title_ar : job.title_en}
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, color: "var(--kojo-muted)", fontSize: 13 }}>
                      {(job.location_en || job.location_ar) && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <MapPin className="w-4 h-4" />
                          {isRTL ? (job.location_ar || job.location_en) : (job.location_en || job.location_ar)}
                        </div>
                      )}
                      {job.deadline_at && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Clock className="w-4 h-4" />
                          {isRTL ? "آخر يوم تقديم: " : "Apply by: "}
                          {new Date(job.deadline_at).toLocaleDateString(isRTL ? "ar-EG" : "en-US")}
                        </div>
                      )}
                      {job.posted_at && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Calendar className="w-4 h-4" />
                          {isRTL ? "تم النشر: " : "Posted: "}
                          {new Date(job.posted_at).toLocaleDateString(isRTL ? "ar-EG" : "en-US")}
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: "auto", color: "var(--kojo-violet)", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      {isRTL ? "اعرف المزيد" : "View details"}
                      <ArrowIcon className="w-4 h-4" style={{ transform: isRTL ? "rotate(180deg)" : "none" }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
