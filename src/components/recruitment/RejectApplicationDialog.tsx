import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, XCircle } from "lucide-react";

interface Reason {
  code: string;
  label_en: string;
  label_ar: string;
}

interface Props {
  application: { id: string; applicant_name: string; applicant_email: string; status?: string; jobs?: { title_en: string; title_ar: string } } | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onRejected: () => void;
}

export function RejectApplicationDialog({ application, open, onOpenChange, onRejected }: Props) {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [reasonCode, setReasonCode] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setReasonCode("");
      setNotes("");
      void supabase
        .from("job_rejection_reasons")
        .select("code,label_en,label_ar")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .then(({ data }) => setReasons(data || []));
    }
  }, [open]);

  const handleReject = async () => {
    if (!application || !reasonCode) {
      toast({ title: isRTL ? "اختر سبب الرفض" : "Pick a rejection reason", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase
      .from("job_applications")
      .update({
        status: "rejected",
        rejection_reason_code: reasonCode,
        rejection_notes: notes.trim() || null,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", application.id);

    if (error) {
      setSubmitting(false);
      toast({ title: isRTL ? "فشل الحفظ" : "Save failed", description: error.message, variant: "destructive" });
      return;
    }

    // Send rejection email (non-blocking)
    const reason = reasons.find((r) => r.code === reasonCode);
    const reasonTextEn = reason && reasonCode !== "other" ? `Reason: ${reason.label_en}.` : "";
    const reasonTextAr = reason && reasonCode !== "other" ? `السبب: ${reason.label_ar}.` : "";
    const jobTitle = application.jobs?.title_ar || application.jobs?.title_en || "";

    const { error: emailErr } = await supabase.functions.invoke("send-email", {
      body: {
        to: application.applicant_email,
        templateName: "job-application-rejected",
        audience: "staff",
        idempotencyKey: `rejection-${application.id}`,
        templateData: {
          applicant_name: application.applicant_name,
          job_title: jobTitle,
          rejection_reason_text: reasonTextEn,
          rejection_reason_text_ar: reasonTextAr,
        },
      },
    });

    setSubmitting(false);
    if (emailErr) {
      toast({
        title: isRTL ? "تم الرفض، لكن الإيميل فشل" : "Rejected, but email failed",
        description: emailErr.message,
        variant: "destructive",
      });
    } else {
      toast({ title: isRTL ? "تم رفض الطلب وإرسال الإيميل" : "Application rejected & email sent" });
    }
    onRejected();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="w-5 h-5" />
            {isRTL ? "رفض الطلب" : "Reject application"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {application && (
            <div className="text-sm">
              <div className="font-medium">{application.applicant_name}</div>
              <div className="text-muted-foreground text-xs">{application.applicant_email}</div>
            </div>
          )}

          <div>
            <Label>{isRTL ? "سبب الرفض" : "Rejection reason"}</Label>
            <Select value={reasonCode} onValueChange={setReasonCode}>
              <SelectTrigger>
                <SelectValue placeholder={isRTL ? "اختر سبب…" : "Select a reason…"} />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {isRTL ? r.label_ar : r.label_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="rej-notes">{isRTL ? "ملاحظات داخلية (اختياري)" : "Internal notes (optional)"}</Label>
            <Textarea
              id="rej-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isRTL ? "ملاحظات للفريق فقط، لن تُرسل للمتقدم…" : "For team only, not sent to applicant…"}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {isRTL ? "إلغاء" : "Cancel"}
          </Button>
          <Button variant="destructive" onClick={handleReject} disabled={submitting || !reasonCode}>
            {submitting && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
            {isRTL ? "رفض وإرسال إيميل" : "Reject & send email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
