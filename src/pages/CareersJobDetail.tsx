import { useEffect, useState, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Upload, CheckCircle2, AlertCircle, Loader2, Share2, Check } from "lucide-react";
import { publicSupabase } from "@/integrations/supabase/publicClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { LandingStyles } from "@/components/landing/LandingStyles";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { getCitiesForGovernorate } from "@/lib/egyptCities";

interface FormField {
  key: string;
  type: string;
  label_en: string;
  label_ar: string;
  required?: boolean;
  options?: { value: string; label_en: string; label_ar: string }[];
  accept?: string;
  placeholder_en?: string;
  placeholder_ar?: string;
  min?: number;
  max?: number;
  depends_on?: string;
}

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
  salary_range: string | null;
  description_en: string;
  description_ar: string;
  requirements_en: string | null;
  requirements_ar: string | null;
  benefits_en: string | null;
  benefits_ar: string | null;
  form_fields: FormField[];
  deadline_at: string | null;
  posted_at: string | null;
}

const TYPE_LABEL: Record<string, { en: string; ar: string; color: string }> = {
  full_time: { en: "Full Time", ar: "دوام كامل", color: "#6455F0" },
  part_time: { en: "Part Time", ar: "دوام جزئي", color: "#61BAE2" },
  internship: { en: "Internship", ar: "تدريب", color: "#f59e0b" },
  volunteer: { en: "Volunteer", ar: "تطوع", color: "#10b981" },
  freelance: { en: "Freelance", ar: "عمل حر", color: "#8b5cf6" },
};

const SEASON_LABEL: Record<string, { en: string; ar: string }> = {
  summer: { en: "Summer", ar: "الصيفي" },
  fall: { en: "Fall", ar: "الخريفي" },
  winter: { en: "Winter", ar: "الشتوي" },
  spring: { en: "Spring", ar: "الربيعي" },
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  background: "rgba(255,255,255,.04)",
  border: "1px solid var(--kojo-border)",
  color: "var(--kojo-text)",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
};

const SITE_URL = "https://kojobot.com";

/** Set or replace a meta tag */
function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function setJsonLd(id: string, data: Record<string, unknown>) {
  let el = document.head.querySelector(`script[data-jsonld="${id}"]`) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.setAttribute("data-jsonld", id);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export default function CareersJobDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const { language, isRTL } = useLanguage();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{ tracking_code?: string } | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [trackingCode, setTrackingCode] = useState<string | null>(null);

  const handleShare = async () => {
    if (!job) return;
    const slug = job.slug || job.id;
    const shareUrl = `${window.location.origin}/careers/${slug}`;
    // Try native share first (mobile + modern browsers)
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ url: shareUrl });
        return;
      } catch {
        // user cancelled — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const ArrowIcon = isRTL ? ArrowRight : ArrowLeft;

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      // UUID format: 8-4-4-4-12 hex chars (e.g. e27d9880-d777-4a51-b049-1341e81859c0)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
      const query = publicSupabase.from("jobs").select("*").eq("status", "published");
      const { data } = isUuid
        ? await query.eq("id", slug).maybeSingle()
        : await query.eq("slug", slug).maybeSingle();
      setJob(data as unknown as Job | null);
      setLoading(false);
    })();
  }, [slug]);

  // SEO: title, meta, OG, canonical, JSON-LD
  useEffect(() => {
    if (!job) return;
    const title = isRTL ? job.title_ar : job.title_en;
    const desc = (isRTL ? job.description_ar : job.description_en).replace(/\s+/g, " ").slice(0, 155);
    const jobPathSegment = job.slug || job.id;
    const url = `${SITE_URL}/careers/${jobPathSegment}`;
    const ogImg = `${SITE_URL}/kojobot-logo-white.png`;

    document.title = `${title} — Kojobot Careers`;
    setMeta("name", "description", desc);
    setLink("canonical", url);

    setMeta("property", "og:type", "website");
    setMeta("property", "og:title", `${title} — Kojobot Careers`);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", ogImg);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", `${title} — Kojobot Careers`);
    setMeta("name", "twitter:description", desc);
    setMeta("name", "twitter:image", ogImg);

    // JobPosting structured data
    const employmentTypeMap: Record<string, string> = {
      full_time: "FULL_TIME",
      part_time: "PART_TIME",
      internship: "INTERN",
      summer_training: "INTERN",
      volunteer: "VOLUNTEER",
      freelance: "CONTRACTOR",
    };
    setJsonLd("job-posting", {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title,
      description: isRTL ? job.description_ar : job.description_en,
      datePosted: job.posted_at || new Date().toISOString(),
      validThrough: job.deadline_at || undefined,
      employmentType: employmentTypeMap[job.type] || "OTHER",
      hiringOrganization: {
        "@type": "Organization",
        name: "Kojobot Academy",
        sameAs: SITE_URL,
        logo: ogImg,
      },
      jobLocation: (job.location_en || job.location_ar)
        ? {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressLocality: isRTL ? job.location_ar : job.location_en,
              addressCountry: "EG",
            },
          }
        : undefined,
      directApply: true,
    });

    return () => {
      const el = document.head.querySelector('script[data-jsonld="job-posting"]');
      el?.remove();
    };
  }, [job, isRTL]);

  const fields = useMemo<FormField[]>(() => (Array.isArray(job?.form_fields) ? job!.form_fields : []), [job]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;
    setError(null);
    setDuplicateInfo(null);
    setSubmitting(true);

    try {
      // Validators per field type
      const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 255;
      const isPhone = (v: string) => /^(\+?\d{8,15})$/.test(v.replace(/[\s\-()]/g, ""));
      const isUrl = (v: string) => {
        try { const u = new URL(v); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; }
      };
      const isDate = (v: string) => !Number.isNaN(new Date(v).getTime());

      // Per-field validation (required + format for typed fields)
      for (const f of fields) {
        if (["full_name", "email", "phone", "cv"].includes(f.key)) continue;
        const raw = formValues[f.key];
        const v = typeof raw === "string" ? raw.trim() : raw;
        const isEmpty = v === undefined || v === null || (typeof v === "string" && v === "") || (Array.isArray(v) && v.length === 0);

        if (f.required && isEmpty) {
          throw new Error(isRTL ? `الحقل "${f.label_ar}" مطلوب` : `Field "${f.label_en}" is required`);
        }
        if (isEmpty) continue; // skip format check for empty optional fields

        const label = isRTL ? f.label_ar : f.label_en;
        if (f.type === "email" && !isEmail(String(v))) {
          throw new Error(isRTL ? `"${label}" يجب أن يكون بريد إلكتروني صحيح` : `"${label}" must be a valid email`);
        }
        if (f.type === "phone" && !isPhone(String(v))) {
          throw new Error(isRTL ? `"${label}" يجب أن يكون رقم هاتف صحيح (8-15 رقم)` : `"${label}" must be a valid phone (8-15 digits)`);
        }
        if (f.type === "url" && !isUrl(String(v))) {
          throw new Error(isRTL ? `"${label}" يجب أن يكون رابط صحيح يبدأ بـ http(s)` : `"${label}" must be a valid http(s) URL`);
        }
        if (f.type === "number") {
          const n = Number(v);
          if (Number.isNaN(n)) {
            throw new Error(isRTL ? `"${label}" يجب أن يكون رقم` : `"${label}" must be a number`);
          }
          if (typeof f.min === "number" && n < f.min) {
            throw new Error(isRTL ? `"${label}" يجب ألا يقل عن ${f.min}` : `"${label}" must be ≥ ${f.min}`);
          }
          if (typeof f.max === "number" && n > f.max) {
            throw new Error(isRTL ? `"${label}" يجب ألا يزيد عن ${f.max}` : `"${label}" must be ≤ ${f.max}`);
          }
        }
        if (f.type === "date" && !isDate(String(v))) {
          throw new Error(isRTL ? `"${label}" تاريخ غير صحيح` : `"${label}" is not a valid date`);
        }
        if ((f.type === "short_text" || f.type === "long_text") && typeof v === "string") {
          const max = f.type === "short_text" ? 200 : 2000;
          if (v.length > max) {
            throw new Error(isRTL ? `"${label}" يجب ألا يزيد عن ${max} حرف` : `"${label}" must be ≤ ${max} characters`);
          }
        }
        if (f.type === "multi_choice" && !Array.isArray(v)) {
          throw new Error(isRTL ? `"${label}" قيمة غير صحيحة` : `"${label}" has an invalid value`);
        }
      }

      const fullName = String(formValues.full_name || "").trim();
      const email = String(formValues.email || "").trim();
      const phone = String(formValues.phone || "").trim();
      if (!fullName || fullName.length < 2 || fullName.length > 100) {
        throw new Error(isRTL ? "الاسم يجب أن يكون من 2 إلى 100 حرف" : "Name must be 2-100 characters");
      }
      if (!isEmail(email)) {
        throw new Error(isRTL ? "بريد إلكتروني غير صحيح (مثال: name@example.com)" : "Invalid email (e.g. name@example.com)");
      }
      if (!phone) {
        throw new Error(isRTL ? "رقم الهاتف مطلوب" : "Phone is required");
      }
      if (!isPhone(phone)) {
        throw new Error(isRTL ? "رقم الهاتف غير صحيح (8-15 رقم، يمكن البدء بـ +)" : "Invalid phone (8-15 digits, may start with +)");
      }

      // Upload CV if provided
      let cvUrl: string | null = null;
      if (cvFile) {
        if (cvFile.size > 5 * 1024 * 1024) throw new Error(isRTL ? "الملف أكبر من 5MB" : "File exceeds 5MB");
        const ext = cvFile.name.split(".").pop() || "pdf";
        const path = `${job.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await publicSupabase.storage.from("job-applications").upload(path, cvFile, {
          contentType: cvFile.type || "application/octet-stream",
        });
        if (upErr) throw new Error(isRTL ? "فشل رفع السيرة الذاتية" : "Failed to upload CV");
        cvUrl = path;
      } else {
        const cvField = fields.find((f) => f.key === "cv");
        if (cvField?.required) throw new Error(isRTL ? "السيرة الذاتية مطلوبة" : "CV is required");
      }

      // Build answers (exclude reserved keys)
      const answers: Record<string, any> = {};
      for (const f of fields) {
        if (!["full_name", "email", "phone", "cv"].includes(f.key)) {
          answers[f.key] = formValues[f.key] ?? null;
        }
      }

      const { data: result, error: fnError } = await publicSupabase.functions.invoke("submit-job-application", {
        body: {
          job_id: job.id,
          applicant_name: fullName,
          applicant_email: email,
          applicant_phone: phone || null,
          cv_url: cvUrl,
          answers,
          invite_token: inviteToken,
          honeypot: formValues.__company_website || "",
        },
      });

      if (fnError) {
        // FunctionsHttpError doesn't include body on non-2xx; try to extract
        const ctx = (fnError as any)?.context;
        if (ctx?.status === 409) {
          try {
            const body = await ctx.json();
            setDuplicateInfo({ tracking_code: body?.tracking_code });
            throw new Error(isRTL ? (body?.message_ar || "لقد قدمت بالفعل") : (body?.message || "Already applied"));
          } catch (parseErr) {
            // fall through
          }
        }
        throw new Error(fnError.message);
      }
      if (result?.error === "duplicate_application") {
        setDuplicateInfo({ tracking_code: result?.tracking_code });
        throw new Error(isRTL ? (result?.message_ar || "لقد قدمت بالفعل") : (result?.message || "Already applied"));
      }
      if (result?.error) throw new Error(Array.isArray(result.details) ? result.details.join(", ") : result.error);

      setTrackingCode(result?.tracking_code || null);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setError(err.message || (isRTL ? "حدث خطأ" : "An error occurred"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="kojo-root" dir={isRTL ? "rtl" : "ltr"} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <LandingStyles isRTL={isRTL} />
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--kojo-violet)" }} />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="kojo-root" dir={isRTL ? "rtl" : "ltr"} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", flexDirection: "column", gap: 16 }}>
        <LandingStyles isRTL={isRTL} />
        <h1 className="font-display" style={{ fontSize: 32 }}>{isRTL ? "الوظيفة غير متاحة" : "Job not available"}</h1>
        <Link to="/careers" style={{ color: "var(--kojo-violet)" }}>{isRTL ? "كل الوظائف" : "Browse all jobs"}</Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="kojo-root" dir={isRTL ? "rtl" : "ltr"} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 }}>
        <LandingStyles isRTL={isRTL} />
        <div style={{ maxWidth: 520, textAlign: "center", background: "var(--kojo-surface)", padding: 48, borderRadius: 24, border: "1px solid var(--kojo-border)" }}>
          <CheckCircle2 className="w-16 h-16" style={{ color: "#10b981", margin: "0 auto 24px" }} />
          <h2 className="font-display" style={{ fontSize: 28, margin: "0 0 12px" }}>
            {isRTL ? "تم استلام طلبك بنجاح!" : "Application submitted!"}
          </h2>
          <p style={{ color: "var(--kojo-muted)", lineHeight: 1.6, margin: "0 0 20px" }}>
            {isRTL ? "هنراجع طلبك ونتواصل معاك قريباً على الإيميل." : "We'll review your application and reach out via email soon."}
          </p>
          {trackingCode && (
            <div style={{ background: "rgba(100,85,240,.1)", border: "1px solid rgba(100,85,240,.3)", padding: 16, borderRadius: 12, marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: "var(--kojo-muted)", marginBottom: 6 }}>
                {isRTL ? "كود التتبع بتاعك" : "Your tracking code"}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "monospace", letterSpacing: 1, color: "var(--kojo-text)" }}>
                {trackingCode}
              </div>
              <div style={{ fontSize: 12, color: "var(--kojo-muted)", marginTop: 8 }}>
                {isRTL ? "احتفظ بالكود ده — هنبعتهولك في الإيميل برضه" : "Save this — we also sent it to your email"}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            {trackingCode && (
              <Link
                to={`/application-status?code=${trackingCode}`}
                className="grad-btn"
                style={{ padding: "12px 20px", borderRadius: 12, textDecoration: "none", display: "inline-block", fontWeight: 600 }}
              >
                {isRTL ? "تابع طلبك" : "Track application"}
              </Link>
            )}
            <Link
              to="/careers"
              style={{ padding: "12px 20px", borderRadius: 12, textDecoration: "none", display: "inline-block", fontWeight: 600, border: "1px solid var(--kojo-border)", color: "var(--kojo-text)" }}
            >
              {isRTL ? "تصفح وظائف أخرى" : "Browse more jobs"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="kojo-root" dir={isRTL ? "rtl" : "ltr"}>
      <LandingStyles isRTL={isRTL} />
      <LandingNavbar />

      <header style={{ padding: "24px 0", borderBottom: "1px solid var(--kojo-border)", marginTop: 68 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <Link to="/careers" style={{ color: "var(--kojo-muted)", display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", fontSize: 14 }}>
            <ArrowIcon className="w-4 h-4" />
            {isRTL ? "كل الوظائف" : "All jobs"}
          </Link>
        </div>
      </header>

      <div className="job-detail-grid" style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        {/* Job details */}
        <div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            <h1 className="font-display" style={{ fontSize: "clamp(28px, 4vw, 44px)", margin: 0, lineHeight: 1.2, flex: "1 1 auto", minWidth: 0 }}>
              <span className="grad-text">{isRTL ? job.title_ar : job.title_en}</span>
            </h1>
            <button
              type="button"
              onClick={handleShare}
              aria-label={isRTL ? "مشاركة الوظيفة" : "Share job"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                borderRadius: 12,
                background: shareCopied ? "rgba(16,185,129,.15)" : "rgba(255,255,255,.06)",
                border: `1px solid ${shareCopied ? "rgba(16,185,129,.4)" : "var(--kojo-border)"}`,
                color: shareCopied ? "#10b981" : "var(--kojo-text)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.2s ease",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {shareCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              {shareCopied ? (isRTL ? "تم النسخ" : "Copied") : (isRTL ? "مشاركة" : "Share")}
            </button>
          </div>

          {/* Type / Season / Paid badges */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
            {(() => {
              const typeMeta = TYPE_LABEL[job.type];
              return (
                <span style={{ padding: "5px 12px", borderRadius: 999, background: `${typeMeta?.color || "#6455F0"}22`, color: typeMeta?.color || "#6455F0", fontSize: 12, fontWeight: 600 }}>
                  {job.type === "internship" && job.training_season
                    ? (isRTL ? `تدريب ${SEASON_LABEL[job.training_season].ar}` : `${SEASON_LABEL[job.training_season].en} Internship`)
                    : (isRTL ? typeMeta?.ar : typeMeta?.en)}
                </span>
              );
            })()}
            <span style={{ padding: "5px 12px", borderRadius: 999, background: job.is_paid ? "rgba(16,185,129,.15)" : "rgba(148,163,184,.15)", color: job.is_paid ? "#10b981" : "#94a3b8", fontSize: 12, fontWeight: 600 }}>
              {job.is_paid ? (isRTL ? "مدفوع" : "Paid") : (isRTL ? "غير مدفوع" : "Unpaid")}
            </span>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32, color: "var(--kojo-muted)", fontSize: 14 }}>
            {(job.location_en || job.location_ar) && <span>📍 {isRTL ? (job.location_ar || job.location_en) : (job.location_en || job.location_ar)}</span>}
            {job.is_paid && job.salary_range && <span>💰 {job.salary_range}</span>}
            {job.deadline_at && <span>⏰ {isRTL ? "آخر يوم: " : "Deadline: "}{new Date(job.deadline_at).toLocaleDateString(isRTL ? "ar-EG" : "en-US")}</span>}
          </div>

          <Section title={isRTL ? "الوصف" : "Description"} content={isRTL ? job.description_ar : job.description_en} />
          {(job.requirements_en || job.requirements_ar) && (
            <Section title={isRTL ? "المتطلبات" : "Requirements"} content={isRTL ? (job.requirements_ar || "") : (job.requirements_en || "")} />
          )}
          {(job.benefits_en || job.benefits_ar) && (
            <Section title={isRTL ? "المميزات" : "Benefits"} content={isRTL ? (job.benefits_ar || "") : (job.benefits_en || "")} />
          )}
        </div>

        {/* Application form */}
        <aside className="job-apply-aside">
          <form onSubmit={handleSubmit} style={{ background: "var(--kojo-surface)", padding: 28, borderRadius: 20, border: "1px solid var(--kojo-border)", display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 className="font-display" style={{ fontSize: 22, margin: 0 }}>
              {isRTL ? "قدّم على هذه الوظيفة" : "Apply for this job"}
            </h2>

            {/* Honeypot */}
            <input type="text" name="__company_website" tabIndex={-1} autoComplete="off"
              value={formValues.__company_website || ""}
              onChange={(e) => setFormValues((p) => ({ ...p, __company_website: e.target.value }))}
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
              aria-hidden="true" />

            {fields.map((f) => (
              <FieldRenderer
                key={f.key}
                field={f}
                isRTL={isRTL}
                value={formValues[f.key]}
                allValues={formValues}
                onChange={(v) => setFormValues((p) => {
                  // If governorate (location) changes, reset dependent city
                  if (f.key === "location" && p.city) {
                    return { ...p, [f.key]: v, city: "" };
                  }
                  return { ...p, [f.key]: v };
                })}
                onFileChange={f.key === "cv" ? setCvFile : undefined}
                fileName={f.key === "cv" ? cvFile?.name : undefined}
              />
            ))}

            {error && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: 12, borderRadius: 10, background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", color: "#fca5a5", fontSize: 13, flexDirection: "column" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <AlertCircle className="w-4 h-4" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{error}</span>
                </div>
                {duplicateInfo?.tracking_code && (
                  <Link
                    to={`/application-status?code=${duplicateInfo.tracking_code}`}
                    style={{ color: "#6455F0", textDecoration: "underline", fontWeight: 600, fontSize: 13, marginInlineStart: 24 }}
                  >
                    {isRTL ? `تابع طلبك السابق (${duplicateInfo.tracking_code}) ←` : `Track your previous application (${duplicateInfo.tracking_code}) →`}
                  </Link>
                )}
              </div>
            )}

            <button type="submit" disabled={submitting} className="grad-btn"
              style={{ padding: "14px 24px", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1, fontFamily: "inherit" }}>
              {submitting ? (isRTL ? "جاري الإرسال…" : "Submitting…") : (isRTL ? "تقديم الطلب" : "Submit Application")}
            </button>
          </form>
        </aside>
      </div>

      <style>{`
        .job-detail-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
          gap: 40px;
        }
        .job-apply-aside {
          position: sticky;
          top: 24px;
          align-self: start;
        }
        @media (max-width: 900px) {
          .job-detail-grid {
            grid-template-columns: 1fr;
            gap: 24px;
            padding: 24px 16px !important;
          }
          .job-apply-aside {
            position: static;
          }
        }
      `}</style>
    </div>
  );
}

function Section({ title, content }: { title: string; content: string }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 className="font-display" style={{ fontSize: 20, margin: "0 0 12px" }}>{title}</h3>
      <div style={{ color: "rgba(240,240,255,.7)", lineHeight: 1.7, whiteSpace: "pre-wrap", fontSize: 15 }}>
        {content}
      </div>
    </div>
  );
}

function FieldRenderer({ field, isRTL, value, allValues, onChange, onFileChange, fileName }: {
  field: FormField; isRTL: boolean; value: any; allValues?: Record<string, any>;
  onChange: (v: any) => void;
  onFileChange?: (f: File | null) => void; fileName?: string;
}) {
  const label = isRTL ? field.label_ar : field.label_en;
  const placeholder = isRTL ? (field.placeholder_ar || "") : (field.placeholder_en || "");

  if (field.type === "file_upload") {
    return (
      <div>
        <Label text={label} required={field.required} />
        <label style={{ ...inputStyle, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, color: fileName ? "var(--kojo-text)" : "var(--kojo-muted)" }}>
          <Upload className="w-4 h-4" />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {fileName || (isRTL ? "اختر ملف (PDF/DOC) — حتى 5MB" : "Choose file (PDF/DOC) — up to 5MB")}
          </span>
          <input type="file" accept={field.accept || ".pdf,.doc,.docx"} hidden
            onChange={(e) => onFileChange?.(e.target.files?.[0] || null)} />
        </label>
      </div>
    );
  }

  if (field.type === "long_text") {
    return (
      <div>
        <Label text={label} required={field.required} />
        <textarea
          required={field.required}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          style={{ ...inputStyle, resize: "vertical", minHeight: 100 }}
        />
      </div>
    );
  }

  // Multi-choice: render as checkboxes; value is an array of strings
  if (field.type === "multi_choice" && field.options) {
    const selected: string[] = Array.isArray(value) ? value : [];
    const toggle = (v: string) => {
      const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
      onChange(next);
    };
    return (
      <div>
        <Label text={label} required={field.required} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 8,
            padding: 10,
            borderRadius: 12,
            background: "rgba(255,255,255,.04)",
            border: "1px solid var(--kojo-border)",
          }}
        >
          {field.options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 10,
                  cursor: "pointer",
                  background: checked ? "rgba(100,85,240,.15)" : "rgba(255,255,255,.03)",
                  border: `1px solid ${checked ? "rgba(100,85,240,.5)" : "transparent"}`,
                  transition: "all 0.15s ease",
                  fontSize: 13,
                  color: "var(--kojo-text)",
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt.value)}
                  style={{ accentColor: "#6455F0", cursor: "pointer" }}
                />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {isRTL ? opt.label_ar : opt.label_en}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  // City field is ALWAYS rendered as a dependent dropdown based on selected governorate (location),
  // regardless of how it was configured in the form builder (e.g. short_text legacy fields).
  const isCityDependent = field.key === "city";
  const isSingleChoice = field.type === "single_choice" && (field.options || field.depends_on);

  if (isSingleChoice || isCityDependent) {
    // Resolve options: if this field depends on another (e.g. city depends on location),
    // pull the city list dynamically based on the chosen governorate.
    let options = field.options || [];
    let disabled = false;
    let dynamicPlaceholder: string | null = null;
    if (isCityDependent || field.depends_on === "location") {
      const govValue: string | undefined = allValues?.location;
      if (!govValue) {
        options = [];
        disabled = true;
        dynamicPlaceholder = isRTL ? "اختر المحافظة أولاً" : "Select governorate first";
      } else {
        options = getCitiesForGovernorate(govValue);
        if (options.length === 0) {
          dynamicPlaceholder = isRTL ? "لا توجد مدن متاحة" : "No cities available";
        }
      }
    }

    return (
      <div>
        <Label text={label} required={field.required} />
        <div style={{ position: "relative" }}>
          <select
            required={field.required}
            value={value || ""}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            style={{
              ...inputStyle,
              appearance: "none",
              WebkitAppearance: "none",
              MozAppearance: "none",
              paddingInlineEnd: 36,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.6 : 1,
              colorScheme: "dark",
            }}
          >
            <option value="" style={{ background: "#0d1027", color: "rgba(240,240,255,.55)" }}>
              {dynamicPlaceholder || (isRTL ? "اختر…" : "Select…")}
            </option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ background: "#0d1027", color: "#f0f0ff", padding: 8 }}>
                {isRTL ? opt.label_ar : opt.label_en}
              </option>
            ))}
          </select>
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "50%",
              transform: "translateY(-50%)",
              ...(isRTL ? { left: 14 } : { right: 14 }),
              pointerEvents: "none",
              color: "var(--kojo-muted)",
              fontSize: 12,
            }}
          >
            ▾
          </span>
        </div>
      </div>
    );
  }

  const inputType =
    field.type === "email" ? "email" :
    field.type === "phone" ? "tel" :
    field.type === "url" ? "url" :
    field.type === "number" ? "number" :
    field.type === "date" ? "date" : "text";

  // Mobile keyboard hints
  const inputMode =
    field.type === "phone" ? "tel" :
    field.type === "email" ? "email" :
    field.type === "number" ? "numeric" :
    field.type === "url" ? "url" : undefined;

  return (
    <div>
      <Label text={label} required={field.required} />
      <input
        type={inputType}
        inputMode={inputMode as any}
        autoComplete={
          field.key === "full_name" ? "name" :
          field.type === "email" ? "email" :
          field.type === "phone" ? "tel" : "off"
        }
        required={field.required}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  );
}

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <label style={{ display: "block", fontSize: 13, color: "var(--kojo-muted)", marginBottom: 6, fontWeight: 500 }}>
      {text} {required && <span style={{ color: "#f87171" }}>*</span>}
    </label>
  );
}
