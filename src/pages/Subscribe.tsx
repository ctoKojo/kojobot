import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { KojobotLogo } from "@/components/KojobotLogo";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

interface Plan {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
}

export default function Subscribe() {
  const { language, isRTL } = useLanguage();
  const [searchParams] = useSearchParams();
  const planSlug = searchParams.get("plan");

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [attendanceMode, setAttendanceMode] = useState("offline");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const l = (en: string, ar: string) => (language === "ar" ? ar : en);

  useEffect(() => {
    const fetchPlans = async () => {
      const { data } = await supabase
        .from("landing_plans")
        .select("id, slug, name_en, name_ar")
        .eq("is_active", true)
        .order("sort_order");
      
      if (data) {
        setPlans(data);
        // Auto-select plan from URL
        if (planSlug) {
          const match = data.find((p) => p.slug === planSlug);
          if (match) setSelectedPlanId(match.id);
        }
      }
      setLoading(false);
    };
    fetchPlans();
  }, [planSlug]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    
    if (!name.trim() || name.trim().length < 2) {
      errs.name = l("Name must be at least 2 characters", "الاسم لازم يكون حرفين على الأقل");
    }
    
    const phoneClean = phone.replace(/[\s\-()]/g, "");
    if (!phoneClean || !/^(\+?\d{10,15})$/.test(phoneClean)) {
      errs.phone = l("Enter a valid phone number", "ادخل رقم تليفون صحيح");
    }
    
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = l("Enter a valid email", "ادخل إيميل صحيح");
    }
    
    if (!selectedPlanId) {
      errs.plan = l("Select a plan", "اختر باقة");
    }
    
    if (!consent) {
      errs.consent = l("You must agree to be contacted", "لازم توافق على التواصل");
    }
    
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await supabase.functions.invoke("submit-subscription", {
        body: {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          plan_id: selectedPlanId,
          attendance_mode: attendanceMode,
          honeypot,
        },
      });

      if (res.error) {
        const msg = res.error.message || "";
        if (msg.includes("429") || msg.includes("Too many")) {
          setErrors({ form: l("Too many requests. Please try again later.", "طلبات كتير. حاول تاني بعدين.") });
        } else {
          setErrors({ form: l("Something went wrong. Please try again.", "حصل مشكلة. حاول تاني.") });
        }
        return;
      }

      const data = res.data;
      if (data?.success) {
        setSuccess(data.request_id?.substring(0, 8).toUpperCase() || "OK");
      } else if (data?.error) {
        setErrors({ form: data.details?.join(", ") || data.error });
      }
    } catch {
      setErrors({ form: l("Network error. Please try again.", "خطأ في الشبكة. حاول تاني.") });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--kojo-bg, #0a0a14)" }}>
        <Loader2 className="h-8 w-8 animate-spin text-[var(--kojo-violet)]" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      dir={isRTL ? "rtl" : "ltr"}
      style={{
        background: "linear-gradient(180deg, #0a0a14 0%, #12122a 100%)",
        color: "rgba(240,240,255,.85)",
        fontFamily: isRTL ? "'Cairo','Tajawal',sans-serif" : "'Inter','DM Sans',sans-serif",
      }}
    >
      {/* Header */}
      <div className="mb-8 text-center">
        <Link to="/" className="inline-block mb-4">
          <KojobotLogo size="md" showText />
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "rgba(240,240,255,.95)" }}>
          {l("Subscribe Now", "اشترك الآن")}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "rgba(240,240,255,.5)" }}>
          {l("Fill in your details and we'll contact you to complete the subscription", "املأ بياناتك وهنتواصل معاك لإتمام الاشتراك")}
        </p>
      </div>

      {success ? (
        <div
          className="w-full max-w-md rounded-2xl p-8 text-center"
          style={{
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(100,85,240,.3)",
          }}
        >
          <CheckCircle2 className="mx-auto h-16 w-16 mb-4" style={{ color: "#22c55e" }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: "rgba(240,240,255,.95)" }}>
            {l("Request Submitted!", "تم إرسال الطلب!")}
          </h2>
          <p className="text-sm mb-4" style={{ color: "rgba(240,240,255,.6)" }}>
            {l("We'll contact you soon to complete your subscription.", "هنتواصل معاك قريباً لإتمام الاشتراك.")}
          </p>
          <div
            className="inline-block rounded-lg px-4 py-2 mb-6"
            style={{ background: "rgba(100,85,240,.15)", border: "1px solid rgba(100,85,240,.3)" }}
          >
            <span className="text-xs" style={{ color: "rgba(240,240,255,.5)" }}>
              {l("Reference #", "رقم المرجع #")}
            </span>
            <span className="font-mono font-bold ms-1" style={{ color: "var(--kojo-violet, #6455F0)" }}>
              {success}
            </span>
          </div>
          <div>
            <Link to="/">
              <Button
                variant="outline"
                className="gap-2"
                style={{
                  borderColor: "rgba(255,255,255,.12)",
                  color: "rgba(240,240,255,.8)",
                  background: "rgba(255,255,255,.05)",
                }}
              >
                {isRTL ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                {l("Back to Home", "الرجوع للرئيسية")}
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-2xl p-6 md:p-8 space-y-5"
          style={{
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(255,255,255,.08)",
          }}
        >
          {/* Honeypot - hidden from users */}
          <div className="absolute" style={{ left: "-9999px", opacity: 0, height: 0, overflow: "hidden" }} aria-hidden="true">
            <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label style={{ color: "rgba(240,240,255,.7)" }}>
              {l("Full Name", "الاسم الكامل")} <span style={{ color: "#ef4444" }}>*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={l("e.g. Ahmed Mohamed", "مثال: أحمد محمد")}
              maxLength={100}
              dir={isRTL ? "rtl" : "ltr"}
              className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-[var(--kojo-violet)]"
            />
            {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label style={{ color: "rgba(240,240,255,.7)" }}>
              {l("Phone Number", "رقم التليفون")} <span style={{ color: "#ef4444" }}>*</span>
            </Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01xxxxxxxxx"
              maxLength={15}
              dir="ltr"
              type="tel"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-[var(--kojo-violet)]"
            />
            {errors.phone && <p className="text-xs text-red-400">{errors.phone}</p>}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label style={{ color: "rgba(240,240,255,.7)" }}>
              {l("Email", "البريد الإلكتروني")} <span style={{ color: "#ef4444" }}>*</span>
            </Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              maxLength={255}
              dir="ltr"
              type="email"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-[var(--kojo-violet)]"
            />
            {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
          </div>

          {/* Plan */}
          <div className="space-y-2">
            <Label style={{ color: "rgba(240,240,255,.7)" }}>
              {l("Plan", "الباقة")} <span style={{ color: "#ef4444" }}>*</span>
            </Label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger className="border-white/10 bg-white/5 text-white focus:ring-[var(--kojo-violet)]">
                <SelectValue placeholder={l("Select a plan", "اختر باقة")} />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {l(p.name_en, p.name_ar)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.plan && <p className="text-xs text-red-400">{errors.plan}</p>}
          </div>

          {/* Attendance Mode */}
          <div className="space-y-2">
            <Label style={{ color: "rgba(240,240,255,.7)" }}>
              {l("Attendance Mode", "نوع الحضور")}
            </Label>
            <Select value={attendanceMode} onValueChange={setAttendanceMode}>
              <SelectTrigger className="border-white/10 bg-white/5 text-white focus:ring-[var(--kojo-violet)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="offline">{l("In-Person", "حضوري")}</SelectItem>
                <SelectItem value="online">{l("Online", "أونلاين")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Consent */}
          <div className="flex items-start gap-2">
            <Checkbox
              id="consent"
              checked={consent}
              onCheckedChange={(c) => setConsent(c === true)}
              className="mt-1 border-white/20 data-[state=checked]:bg-[var(--kojo-violet)] data-[state=checked]:border-[var(--kojo-violet)]"
            />
            <label htmlFor="consent" className="text-xs cursor-pointer" style={{ color: "rgba(240,240,255,.5)" }}>
              {l(
                "I agree to be contacted regarding this subscription request.",
                "أوافق على التواصل معي بخصوص طلب الاشتراك ده."
              )}
            </label>
          </div>
          {errors.consent && <p className="text-xs text-red-400">{errors.consent}</p>}

          {/* Error */}
          {errors.form && (
            <div className="rounded-lg p-3 text-sm text-red-300" style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.2)" }}>
              {errors.form}
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 text-base font-semibold grad-btn"
            style={{ borderRadius: 12 }}
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              l("Submit Request", "إرسال الطلب")
            )}
          </Button>

          {/* Back link */}
          <div className="text-center pt-2">
            <Link
              to="/"
              className="text-xs inline-flex items-center gap-1 hover:underline"
              style={{ color: "rgba(240,240,255,.4)" }}
            >
              {isRTL ? <ArrowRight className="h-3 w-3" /> : <ArrowLeft className="h-3 w-3" />}
              {l("Back to Home", "الرجوع للرئيسية")}
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
