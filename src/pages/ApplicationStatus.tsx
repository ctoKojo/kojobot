import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Search, Loader2, CheckCircle2, Clock, XCircle, Briefcase, ArrowRight, ArrowLeft } from "lucide-react";
import { publicSupabase } from "@/integrations/supabase/publicClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { LandingStyles } from "@/components/landing/LandingStyles";

interface StatusResult {
  applicant_name: string;
  job_title_en: string;
  job_title_ar: string;
  job_slug: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  tracking_code: string;
}

const STATUS_META: Record<string, { en: string; ar: string; color: string; icon: typeof Clock }> = {
  new: { en: "New", ar: "جديد", color: "#3b82f6", icon: Clock },
  under_review: { en: "Under Review", ar: "قيد المراجعة", color: "#f59e0b", icon: Clock },
  shortlisted: { en: "Shortlisted", ar: "قائمة مختصرة", color: "#a855f7", icon: CheckCircle2 },
  interviewing: { en: "Interview Stage", ar: "مرحلة المقابلة", color: "#6366f1", icon: CheckCircle2 },
  hired: { en: "Hired 🎉", ar: "تم التوظيف 🎉", color: "#10b981", icon: CheckCircle2 },
  rejected: { en: "Not Selected", ar: "لم يتم الاختيار", color: "#ef4444", icon: XCircle },
};

export default function ApplicationStatus() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isRTL } = useLanguage();
  const ArrowIcon = isRTL ? ArrowRight : ArrowLeft;

  const [code, setCode] = useState(searchParams.get("code") || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StatusResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookup = async (lookupCode: string) => {
    const trimmed = lookupCode.trim().toUpperCase();
    if (!trimmed) {
      setError(isRTL ? "اكتب كود التتبع" : "Enter tracking code");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: rpcErr } = await publicSupabase.rpc("get_application_status_by_code", { p_code: trimmed });
      if (rpcErr) throw rpcErr;
      if (!data || (Array.isArray(data) && data.length === 0)) {
        setError(isRTL ? "كود غير صحيح. تأكد من الكود اللي وصلك في الإيميل." : "Code not found. Check the code from your email.");
      } else {
        setResult((Array.isArray(data) ? data[0] : data) as StatusResult);
      }
    } catch (e: any) {
      setError(e.message || (isRTL ? "حدث خطأ" : "An error occurred"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = searchParams.get("code");
    if (initial) {
      void lookup(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = isRTL ? "تتبع طلب التوظيف — Kojobot" : "Application Status — Kojobot";
  }, [isRTL]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ code: code.trim().toUpperCase() });
    void lookup(code);
  };

  const status = result?.status || "new";
  const meta = STATUS_META[status] || STATUS_META.new;
  const StatusIcon = meta.icon;

  return (
    <div className="kojo-root" dir={isRTL ? "rtl" : "ltr"} style={{ minHeight: "100vh" }}>
      <LandingStyles isRTL={isRTL} />

      <header style={{ padding: "24px 0", borderBottom: "1px solid var(--kojo-border)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px" }}>
          <Link to="/careers" style={{ color: "var(--kojo-muted)", display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", fontSize: 14 }}>
            <ArrowIcon className="w-4 h-4" />
            {isRTL ? "كل الوظائف" : "All jobs"}
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Briefcase className="w-12 h-12" style={{ color: "var(--kojo-violet)", margin: "0 auto 16px" }} />
          <h1 className="font-display" style={{ fontSize: "clamp(28px, 4vw, 40px)", margin: "0 0 12px" }}>
            <span className="grad-text">{isRTL ? "تتبع طلب التوظيف" : "Track Your Application"}</span>
          </h1>
          <p style={{ color: "var(--kojo-muted)", fontSize: 15, lineHeight: 1.6 }}>
            {isRTL
              ? "ادخل كود التتبع اللي وصلك في الإيميل عشان تشوف حالة طلبك."
              : "Enter the tracking code from your confirmation email to see your application status."}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            background: "var(--kojo-surface)",
            padding: 24,
            borderRadius: 16,
            border: "1px solid var(--kojo-border)",
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={isRTL ? "KJB-XXXXXX" : "KJB-XXXXXX"}
            style={{
              flex: "1 1 220px",
              padding: "12px 16px",
              borderRadius: 12,
              background: "rgba(255,255,255,.04)",
              border: "1px solid var(--kojo-border)",
              color: "var(--kojo-text)",
              fontSize: 16,
              fontFamily: "monospace",
              letterSpacing: 1,
              outline: "none",
              textTransform: "uppercase",
            }}
            maxLength={20}
          />
          <button
            type="submit"
            className="grad-btn"
            disabled={loading}
            style={{
              padding: "12px 24px",
              borderRadius: 12,
              fontWeight: 600,
              border: "none",
              cursor: loading ? "wait" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {isRTL ? "بحث" : "Search"}
          </button>
        </form>

        {error && (
          <div
            style={{
              background: "rgba(239,68,68,.1)",
              border: "1px solid rgba(239,68,68,.3)",
              color: "#ef4444",
              padding: "14px 18px",
              borderRadius: 12,
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {result && (
          <div
            style={{
              background: "var(--kojo-surface)",
              padding: 28,
              borderRadius: 20,
              border: "1px solid var(--kojo-border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: `${meta.color}22`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <StatusIcon className="w-7 h-7" style={{ color: meta.color }} />
              </div>
              <div>
                <div style={{ fontSize: 13, color: "var(--kojo-muted)", marginBottom: 4 }}>
                  {isRTL ? "الحالة الحالية" : "Current status"}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: meta.color }}>
                  {isRTL ? meta.ar : meta.en}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 14, fontSize: 14 }}>
              <Row label={isRTL ? "الاسم" : "Applicant"} value={result.applicant_name} />
              <Row
                label={isRTL ? "الوظيفة" : "Job"}
                value={
                  <Link
                    to={`/careers/${result.job_slug}`}
                    style={{ color: "var(--kojo-violet)", textDecoration: "none", fontWeight: 600 }}
                  >
                    {isRTL ? result.job_title_ar : result.job_title_en}
                  </Link>
                }
              />
              <Row
                label={isRTL ? "تاريخ التقديم" : "Submitted"}
                value={new Date(result.submitted_at).toLocaleString(isRTL ? "ar-EG" : "en-US")}
              />
              {result.reviewed_at && (
                <Row
                  label={isRTL ? "آخر مراجعة" : "Last reviewed"}
                  value={new Date(result.reviewed_at).toLocaleString(isRTL ? "ar-EG" : "en-US")}
                />
              )}
              <Row
                label={isRTL ? "كود التتبع" : "Tracking code"}
                value={
                  <span style={{ fontFamily: "monospace", letterSpacing: 1, fontWeight: 600 }}>
                    {result.tracking_code}
                  </span>
                }
              />
            </div>

            <div
              style={{
                marginTop: 24,
                paddingTop: 20,
                borderTop: "1px solid var(--kojo-border)",
                fontSize: 13,
                color: "var(--kojo-muted)",
                lineHeight: 1.6,
              }}
            >
              {isRTL
                ? "هتوصلك رسالة على الإيميل في كل مرة بنحدّث فيها حالة طلبك."
                : "You'll receive an email each time we update your application status."}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, paddingBottom: 12, borderBottom: "1px solid var(--kojo-border)" }}>
      <span style={{ color: "var(--kojo-muted)" }}>{label}</span>
      <span style={{ color: "var(--kojo-text)", textAlign: "end" }}>{value}</span>
    </div>
  );
}
