import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ClipboardCheck } from "lucide-react";

interface Props {
  interviewId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}

export function InterviewOutcomeDialog({ interviewId, open, onOpenChange, onSaved }: Props) {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [status, setStatus] = useState<"completed" | "no_show" | "cancelled">("completed");
  const [outcome, setOutcome] = useState<"pass" | "fail" | "another_round">("pass");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStatus("completed");
      setOutcome("pass");
      setNotes("");
    }
  }, [open]);

  const handleSave = async () => {
    if (!interviewId) return;
    setSubmitting(true);
    const update: any = { status, notes: notes.trim() || null };
    if (status === "completed") update.outcome = outcome;
    else update.outcome = null;

    const { error } = await supabase.from("job_interviews").update(update).eq("id", interviewId);
    setSubmitting(false);
    if (error) {
      toast({ title: isRTL ? "فشل الحفظ" : "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: isRTL ? "تم تحديث المقابلة" : "Interview updated" });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            {isRTL ? "تسجيل نتيجة المقابلة" : "Record interview outcome"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>{isRTL ? "الحالة" : "Status"}</Label>
            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="completed">{isRTL ? "تمت" : "Completed"}</SelectItem>
                <SelectItem value="no_show">{isRTL ? "لم يحضر" : "No-show"}</SelectItem>
                <SelectItem value="cancelled">{isRTL ? "ملغاة" : "Cancelled"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {status === "completed" && (
            <div>
              <Label>{isRTL ? "النتيجة" : "Outcome"}</Label>
              <Select value={outcome} onValueChange={(v: any) => setOutcome(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pass">{isRTL ? "نجح" : "Pass"}</SelectItem>
                  <SelectItem value="fail">{isRTL ? "لم ينجح" : "Fail"}</SelectItem>
                  <SelectItem value="another_round">{isRTL ? "جولة أخرى مطلوبة" : "Another round needed"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="oc-notes">{isRTL ? "ملاحظات" : "Notes"}</Label>
            <Textarea id="oc-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={isRTL ? "تعليقات على أداء المتقدم…" : "Comments on the candidate…"} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>{isRTL ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
            {isRTL ? "حفظ" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
