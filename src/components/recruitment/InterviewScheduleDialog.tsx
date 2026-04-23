import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CalendarClock, Video, MapPin, Phone } from "lucide-react";

interface Props {
  applicationId: string | null;
  applicantName?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onScheduled: () => void;
}

const DURATIONS = [15, 30, 45, 60];

export function InterviewScheduleDialog({ applicationId, applicantName, open, onOpenChange, onScheduled }: Props) {
  const { isRTL } = useLanguage();
  const { toast } = useToast();

  // Default: tomorrow 10:00 Cairo
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(30);
  const [mode, setMode] = useState<"online" | "onsite" | "phone">("online");
  const [meetingLink, setMeetingLink] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDate(tomorrow.toISOString().split("T")[0]);
      setTime("10:00");
      setDuration(30);
      setMode("online");
      setMeetingLink("");
      setLocation("");
      setNotes("");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!applicationId) return;
    if (!date || !time) {
      toast({ title: isRTL ? "حدد التاريخ والوقت" : "Pick date and time", variant: "destructive" });
      return;
    }
    if (mode === "online" && !meetingLink.trim()) {
      toast({ title: isRTL ? "أضف رابط الاجتماع" : "Add meeting link", variant: "destructive" });
      return;
    }
    if (mode === "onsite" && !location.trim()) {
      toast({ title: isRTL ? "أضف عنوان المقابلة" : "Add interview location", variant: "destructive" });
      return;
    }

    // Build Cairo-local datetime, then convert to UTC ISO.
    // Cairo offset is +02:00 (or +03:00 with DST). Use Intl trick to find offset for that date.
    const cairoLocalString = `${date}T${time}:00`;
    // Construct as if it were UTC, then compute the actual UTC time that corresponds to Cairo local.
    const asIfUtc = new Date(cairoLocalString + "Z");
    // Get the Cairo offset for that instant
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Cairo",
      timeZoneName: "shortOffset",
    });
    const parts = fmt.formatToParts(asIfUtc);
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+2";
    const match = tzPart.match(/GMT([+-])(\d{1,2})/);
    const sign = match?.[1] === "-" ? -1 : 1;
    const offsetHours = match ? parseInt(match[2], 10) * sign : 2;
    const utcMillis = asIfUtc.getTime() - offsetHours * 60 * 60_000;
    const scheduledAtIso = new Date(utcMillis).toISOString();

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("schedule-job-interview", {
      body: {
        application_id: applicationId,
        scheduled_at: scheduledAtIso,
        duration_minutes: duration,
        mode,
        meeting_link: mode === "online" ? meetingLink.trim() : null,
        location: mode === "onsite" ? location.trim() : null,
        notes: notes.trim() || null,
      },
    });
    setSubmitting(false);

    if (error || data?.error) {
      toast({
        title: isRTL ? "فشل جدولة المقابلة" : "Failed to schedule interview",
        description: error?.message || data?.error || "Unknown error",
        variant: "destructive",
      });
      return;
    }

    // Offer .ics download
    if (data?.ics_base64) {
      try {
        const blob = new Blob([atob(data.ics_base64)], { type: "text/calendar" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `kojobot-interview-${data.interview.id}.ics`;
        link.click();
        URL.revokeObjectURL(url);
      } catch (_) { /* ignore */ }
    }

    toast({
      title: isRTL ? "تم جدولة المقابلة" : "Interview scheduled",
      description: data?.email_sent
        ? (isRTL ? "تم إرسال إيميل التأكيد" : "Confirmation email sent")
        : (isRTL ? "تم الحفظ، لكن إرسال الإيميل فشل" : "Saved, but email failed"),
    });
    onScheduled();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" />
            {isRTL ? "جدولة مقابلة" : "Schedule interview"}
            {applicantName && <span className="text-sm font-normal text-muted-foreground">— {applicantName}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="date">{isRTL ? "التاريخ" : "Date"}</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
            </div>
            <div>
              <Label htmlFor="time">{isRTL ? "الوقت (القاهرة)" : "Time (Cairo)"}</Label>
              <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{isRTL ? "المدة" : "Duration"}</Label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(parseInt(v, 10))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} {isRTL ? "دقيقة" : "min"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isRTL ? "النوع" : "Mode"}</Label>
              <Select value={mode} onValueChange={(v: any) => setMode(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="online"><span className="flex items-center gap-2"><Video className="w-4 h-4" />{isRTL ? "أونلاين" : "Online"}</span></SelectItem>
                  <SelectItem value="onsite"><span className="flex items-center gap-2"><MapPin className="w-4 h-4" />{isRTL ? "حضوري" : "Onsite"}</span></SelectItem>
                  <SelectItem value="phone"><span className="flex items-center gap-2"><Phone className="w-4 h-4" />{isRTL ? "هاتفية" : "Phone"}</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {mode === "online" && (
            <div>
              <Label htmlFor="link">{isRTL ? "رابط الاجتماع" : "Meeting link"}</Label>
              <Input id="link" type="url" placeholder="https://meet.google.com/…" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} />
            </div>
          )}
          {mode === "onsite" && (
            <div>
              <Label htmlFor="loc">{isRTL ? "العنوان" : "Location"}</Label>
              <Input id="loc" placeholder={isRTL ? "العنوان كامل…" : "Full address…"} value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          )}

          <div>
            <Label htmlFor="notes">{isRTL ? "ملاحظات (اختياري)" : "Notes (optional)"}</Label>
            <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={isRTL ? "تعليمات للمتقدم…" : "Instructions for the applicant…"} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>{isRTL ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
            {isRTL ? "جدولة وإرسال" : "Schedule & send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
