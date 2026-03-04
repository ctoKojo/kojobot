import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { KojobotLogo } from "@/components/KojobotLogo";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, ArrowLeft, ArrowRight } from "lucide-react";

export default function PaymentCallback() {
  const { language, isRTL } = useLanguage();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");

  const l = (en: string, ar: string) => (language === "ar" ? ar : en);

  useEffect(() => {
    // Paymob redirects with query params including success, txn_response_code, etc.
    const success = searchParams.get("success");
    const txnResponseCode = searchParams.get("txn_response_code");

    // Give a brief loading moment for UX
    const timer = setTimeout(() => {
      if (success === "true" && txnResponseCode === "APPROVED") {
        setStatus("success");
      } else if (success === "false" || txnResponseCode) {
        setStatus("failed");
      } else {
        // No clear indication - check if we have any params at all
        if (searchParams.toString()) {
          setStatus(success === "true" ? "success" : "failed");
        } else {
          setStatus("failed");
        }
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [searchParams]);

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
      <div className="mb-8">
        <Link to="/" className="inline-block">
          <KojobotLogo size="md" showText />
        </Link>
      </div>

      <div
        className="w-full max-w-md rounded-2xl p-8 text-center"
        style={{
          background: "rgba(255,255,255,.04)",
          border: "1px solid rgba(100,85,240,.3)",
        }}
      >
        {status === "loading" && (
          <>
            <Loader2 className="mx-auto h-16 w-16 mb-4 animate-spin" style={{ color: "var(--kojo-violet, #6455F0)" }} />
            <h2 className="text-xl font-bold mb-2" style={{ color: "rgba(240,240,255,.95)" }}>
              {l("Processing Payment...", "جاري معالجة الدفع...")}
            </h2>
            <p className="text-sm" style={{ color: "rgba(240,240,255,.5)" }}>
              {l("Please wait while we confirm your payment.", "من فضلك انتظر بنأكد الدفع.")}
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="mx-auto h-16 w-16 mb-4" style={{ color: "#22c55e" }} />
            <h2 className="text-xl font-bold mb-2" style={{ color: "rgba(240,240,255,.95)" }}>
              {l("Payment Successful!", "تم الدفع بنجاح!")}
            </h2>
            <p className="text-sm mb-6" style={{ color: "rgba(240,240,255,.6)" }}>
              {l(
                "Your payment has been confirmed. We'll contact you soon to complete your subscription.",
                "تم تأكيد الدفع. هنتواصل معاك قريباً لإتمام الاشتراك."
              )}
            </p>
          </>
        )}

        {status === "failed" && (
          <>
            <XCircle className="mx-auto h-16 w-16 mb-4" style={{ color: "#ef4444" }} />
            <h2 className="text-xl font-bold mb-2" style={{ color: "rgba(240,240,255,.95)" }}>
              {l("Payment Failed", "فشل الدفع")}
            </h2>
            <p className="text-sm mb-6" style={{ color: "rgba(240,240,255,.6)" }}>
              {l(
                "Something went wrong with your payment. Please try again or contact us.",
                "حصلت مشكلة في الدفع. حاول تاني أو تواصل معانا."
              )}
            </p>
          </>
        )}

        {status !== "loading" && (
          <div className="flex flex-col gap-3">
            <Link to="/subscribe">
              <Button
                className="w-full gap-2"
                style={{
                  background: "var(--kojo-violet, #6455F0)",
                  color: "white",
                }}
              >
                {status === "failed"
                  ? l("Try Again", "حاول تاني")
                  : l("Submit Another Request", "قدّم طلب تاني")}
              </Button>
            </Link>
            <Link to="/">
              <Button
                variant="outline"
                className="w-full gap-2"
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
        )}
      </div>
    </div>
  );
}
