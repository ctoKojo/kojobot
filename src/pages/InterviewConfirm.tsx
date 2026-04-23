import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, CheckCircle2, Calendar, Clock, MapPin, Video, Phone, AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { publicSupabase } from "@/integrations/supabase/publicClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { LandingStyles } from "@/components/landing/LandingStyles";
import { toast } from "sonner";

interface InterviewData {
  interview_id: string;
  application_id: string;
  scheduled_at: string;
  duration_minutes: number;
  mode: string;
  meeting_link: string | null;
  location: string | null;
  notes: string | null;
  applicant_name: string;
  applicant_email: string;
  job_title_en: string;
  job_title_ar: string;
  applicant_confirmed_at: string | null;
  reschedule_requested_at: string | null;
  cancelled_by_applicant_at: string | null;
}

const formatCairo = (iso: string, isRTL: boolean) => {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat(isRTL ? "ar-EG" : "en-GB", {
    timeZone: "Africa/Cairo",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat(isRTL ? "ar-EG" : "en-GB", {
    timeZone: "Africa/Cairo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return { date, time };
};

export default function InterviewConfirm() {
  const { token } = useParams<{ token: string }>();
  const { isRTL } = useLanguage();
  const ArrowIcon = isRTL ? ArrowRight : ArrowLeft;

  const [loading, setLoading] = useState(true);
  const [interview, setInterview] = useState<InterviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  useEffect(() => {
    document.title = isRTL ? "تأكيد المقابلة — Kojobot" : "Confirm Interview — Kojobot";
  }, [isRTL]);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setError(isRTL ? "رابط غير صحيح" : "Invalid link");
        setLoading(false);
        return;
      }
      try {
        const { data, error: rpcErr } = await publicSupabase.rpc("get_interview_by_token", { p_token: token });
        if (rpcErr) throw rpcErr;
        if (!data || (Array.isArray(data) && data.length === 0)) {
          setError(isRTL ? "الرابط غير صحيح أو منتهي الصلاحية" : "Link invalid or expired");
        } else {
          setInterview((Array.isArray(data) ? data[0] : data) as unknown as InterviewData);
        }
      } catch (e: any) {
        setError(e.message || (isRTL ? "حدث خطأ" : "Error loading interview"));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [token, isRTL]);

  const handleConfirm = async () => {
    if (!token) return;
    setConfirming(true);
    try {
      const { data, error: rpcErr } = await publicSupabase.rpc("confirm_interview_by_token", { p_token: token });
      if (rpcErr) throw rpcErr;
      const result = data as { success: boolean; error?: string; already_confirmed?: boolean };
      if (!result?.success) {
        toast.error(isRTL ? "حصل خطأ. حاول تاني." : "Failed. Please try again.");
      } else {
        toast.success(isRTL ? "تم تأكيد المقابلة ✓" : "Interview confirmed ✓");
        setInterview((prev) => (prev ? { ...prev, applicant_confirmed_at: new Date().toISOString() } : prev));
      }
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally {
      setConfirming(false);
    }
  };

  const handleReschedule = async () => {
    if (!token || rescheduleReason.trim().length < 5) {
      toast.error(isRTL ? "اكتب سبب لا يقل عن 5 حروف" : "Reason must be at least 5 characters");
      return;
    }
    setSubmittingReschedule(true);
    try {
      const { data, error: rpcErr } = await publicSupabase.rpc("request_reschedule_by_token", {
        p_token: token,
        p_reason: rescheduleReason.trim(),
      });
      if (rpcErr) throw rpcErr;
      const result = data as { success: boolean; error?: string };
      if (!result?.success) {
        toast.error(isRTL ? "حصل خطأ. حاول تاني." : "Failed. Please try again.");
      } else {
        toast.success(isRTL ? "تم إرسال طلبك. هنتواصل معاك قريب." : "Request sent. We'll contact you soon.");
        setInterview((prev) => (prev ? { ...prev, reschedule_requested_at: new Date().toISOString(), reschedule_reason: rescheduleReason.trim() } : prev));
        setShowReschedule(false);
      }
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally {
      setSubmittingReschedule(false);
    }
  };

  const ModeIcon = interview?.mode === "online" ? Video : interview?.mode === "phone" ? Phone : MapPin;
  const cairo = interview ? formatCairo(interview.scheduled_at, isRTL) : null;

  return (
    <div className="kojo-root" dir={isRTL ? "rtl" : "ltr"} style={{ minHeight: "100vh" }}>
      <LandingStyles isRTL={isRTL} />

      <header style={{ padding: "24px 0", borderBottom: "1px solid var(--kojo-border)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px" }}>
          <Link to="/careers" style={{ color: "var(--kojo-muted)", display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", fontSize: 14 }}>
            <ArrowIcon className="w-4 h-4" />
            {isRTL ? "وظائف Kojobot" : "Kojobot Careers"}
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 64 }}>
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--kojo-violet)", margin: "0 auto" }} />
          </div>
        )}

        {error && !loading && (
          <div style={{
            background: "rgba(239,68,68,.1)",
            border: "1px solid rgba(239,68,68,.3)",
            color: "#ef4444",
            padding: 24,
            borderRadius: 16,
            textAlign: "center",
          }}>
            <AlertCircle className="w-8 h-8" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: 16, fontWeight: 600 }}>{error}</div>
          </div>
        )}

        {interview && !loading && (
          <>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <Calendar className="w-12 h-12" style={{ color: "var(--kojo-violet)", margin: "0 auto 16px" }} />
              <h1 className="font-display" style={{ fontSize: "clamp(28px, 4vw, 36px)", margin: "0 0 12px" }}>
                <span className="grad-text">{isRTL ? "موعد المقابلة" : "Your Interview"}</span>
              </h1>
              <p style={{ color: "var(--kojo-muted)", fontSize: 15 }}>
                {isRTL ? interview.job_title_ar : interview.job_title_en}
              </p>
            </div>

            {interview.cancelled_by_applicant_at && (
              <div style={{
                background: "rgba(239,68,68,.1)",
                border: "1px solid rgba(239,68,68,.3)",
                color: "#ef4444",
                padding: 16,
                borderRadius: 12,
                marginBottom: 20,
                textAlign: "center",
                fontWeight: 600,
              }}>
                {isRTL ? "تم إلغاء هذه المقابلة" : "This interview was cancelled"}
              </div>
            )}

            {interview.applicant_confirmed_at && !interview.cancelled_by_applicant_at && (
              <div style={{
                background: "rgba(16,185,129,.1)",
                border: "1px solid rgba(16,185,129,.3)",
                color: "#10b981",
                padding: 16,
                borderRadius: 12,
                marginBottom: 20,
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontWeight: 600,
              }}>
                <CheckCircle2 className="w-5 h-5" />
                {isRTL ? "تم تأكيد حضورك للمقابلة" : "You confirmed this interview"}
              </div>
            )}

            {interview.reschedule_requested_at && !interview.applicant_confirmed_at && (
              <div style={{
                background: "rgba(245,158,11,.1)",
                border: "1px solid rgba(245,158,11,.3)",
                color: "#f59e0b",
                padding: 16,
                borderRadius: 12,
                marginBottom: 20,
                textAlign: "center",
                fontWeight: 600,
              }}>
                {isRTL ? "تم استلام طلب إعادة الجدولة. هنتواصل معاك قريب." : "Reschedule request received. We'll contact you soon."}
              </div>
            )}

            <div style={{
              background: "var(--kojo-surface)",
              padding: 28,
              borderRadius: 20,
              border: "1px solid var(--kojo-border)",
              marginBottom: 24,
            }}>
              <div style={{ display: "grid", gap: 18 }}>
                <DetailRow icon={Calendar} label={isRTL ? "التاريخ" : "Date"} value={cairo!.date} />
                <DetailRow icon={Clock} label={isRTL ? "الوقت (القاهرة)" : "Time (Cairo)"} value={`${cairo!.time} • ${interview.duration_minutes} ${isRTL ? "دقيقة" : "min"}`} />
                <DetailRow
                  icon={ModeIcon}
                  label={isRTL ? "النوع" : "Type"}
                  value={
                    interview.mode === "online" ? (isRTL ? "أونلاين" : "Online")
                    : interview.mode === "onsite" ? (isRTL ? "حضوري" : "Onsite")
                    : (isRTL ? "مكالمة هاتفية" : "Phone call")
                  }
                />
                {interview.mode === "online" && interview.meeting_link && (
                  <DetailRow
                    icon={Video}
                    label={isRTL ? "رابط الاجتماع" : "Meeting link"}
                    value={
                      <a href={interview.meeting_link} target="_blank" rel="noreferrer" style={{ color: "var(--kojo-violet)", wordBreak: "break-all" }}>
                        {interview.meeting_link}
                      </a>
                    }
                  />
                )}
                {interview.mode === "onsite" && interview.location && (
                  <DetailRow icon={MapPin} label={isRTL ? "المكان" : "Location"} value={interview.location} />
                )}
                {interview.notes && (
                  <DetailRow icon={AlertCircle} label={isRTL ? "ملاحظات" : "Notes"} value={interview.notes} />
                )}
              </div>
            </div>

            {!interview.applicant_confirmed_at && !interview.cancelled_by_applicant_at && !interview.reschedule_requested_at && !showReschedule && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="grad-btn"
                  style={{
                    flex: "1 1 200px",
                    padding: "14px 24px",
                    borderRadius: 12,
                    fontWeight: 600,
                    border: "none",
                    cursor: confirming ? "wait" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    fontSize: 15,
                  }}
                >
                  {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  {isRTL ? "أكّد حضوري" : "Confirm attendance"}
                </button>
                <button
                  onClick={() => setShowReschedule(true)}
                  style={{
                    flex: "1 1 200px",
                    padding: "14px 24px",
                    borderRadius: 12,
                    fontWeight: 600,
                    background: "transparent",
                    border: "1px solid var(--kojo-border)",
                    color: "var(--kojo-text)",
                    cursor: "pointer",
                    fontSize: 15,
                  }}
                >
                  {isRTL ? "اطلب إعادة جدولة" : "Request reschedule"}
                </button>
              </div>
            )}

            {showReschedule && !interview.reschedule_requested_at && (
              <div style={{
                background: "var(--kojo-surface)",
                padding: 24,
                borderRadius: 16,
                border: "1px solid var(--kojo-border)",
              }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px" }}>
                  {isRTL ? "طلب إعادة جدولة" : "Request reschedule"}
                </h3>
                <p style={{ color: "var(--kojo-muted)", fontSize: 13, margin: "0 0 16px" }}>
                  {isRTL ? "وضّحلنا سبب الطلب وإيه المواعيد المناسبة لك. هنرد عليك على الإيميل." : "Tell us why and what times work for you. We'll reply by email."}
                </p>
                <textarea
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  rows={4}
                  placeholder={isRTL ? "مثال: عندي ظرف طارئ يوم كذا. هل تقدروا تأجلوها لـ..." : "e.g. I have a conflict that day. Could we move to..."}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 12,
                    background: "rgba(255,255,255,.04)",
                    border: "1px solid var(--kojo-border)",
                    color: "var(--kojo-text)",
                    fontSize: 14,
                    fontFamily: "inherit",
                    resize: "vertical",
                    marginBottom: 12,
                  }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handleReschedule}
                    disabled={submittingReschedule}
                    className="grad-btn"
                    style={{
                      padding: "10px 20px",
                      borderRadius: 10,
                      fontWeight: 600,
                      border: "none",
                      cursor: submittingReschedule ? "wait" : "pointer",
                      fontSize: 14,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {submittingReschedule && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isRTL ? "إرسال الطلب" : "Send request"}
                  </button>
                  <button
                    onClick={() => { setShowReschedule(false); setRescheduleReason(""); }}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 10,
                      background: "transparent",
                      border: "1px solid var(--kojo-border)",
                      color: "var(--kojo-muted)",
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    {isRTL ? "إلغاء" : "Cancel"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: "rgba(124,58,237,.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <Icon className="w-4 h-4" style={{ color: "var(--kojo-violet)" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: "var(--kojo-muted)", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, color: "var(--kojo-text)", wordBreak: "break-word" }}>{value}</div>
      </div>
    </div>
  );
}
