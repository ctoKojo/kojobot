import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, FileText, Download, MessageSquare, Calendar, Loader2, Send, CalendarPlus, UserCheck, XCircle, Star, ClipboardCheck, Video, MapPin, AlertCircle, CalendarClock, CheckCircle2 } from "lucide-react";
import { InterviewScheduleDialog } from "./InterviewScheduleDialog";
import { RejectApplicationDialog } from "./RejectApplicationDialog";
import { HireApplicationDialog } from "./HireApplicationDialog";
import { InterviewOutcomeDialog } from "./InterviewOutcomeDialog";

const STATUS_META: Record<string, { en: string; ar: string; color: string }> = {
  new: { en: "New", ar: "جديد", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  under_review: { en: "Under Review", ar: "قيد المراجعة", color: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  shortlisted: { en: "Shortlisted", ar: "قائمة مختصرة", color: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30" },
  interviewing: { en: "Interviewing", ar: "مقابلة", color: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30" },
  hired: { en: "Hired", ar: "تم التوظيف", color: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30" },
  rejected: { en: "Rejected", ar: "مرفوض", color: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30" },
};

interface Interview {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  mode: "online" | "onsite" | "phone";
  meeting_link: string | null;
  location: string | null;
  status: string;
  outcome: string | null;
  notes: string | null;
}

interface Props {
  application: any | null;
  formFields: any[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUpdated: () => void;
}

export function ApplicationDetailDialog({ application, formFields, open, onOpenChange, onUpdated }: Props) {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState("new");
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [downloadingCv, setDownloadingCv] = useState(false);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [hireOpen, setHireOpen] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState<string | null>(null);
  const [jobMeta, setJobMeta] = useState<{ title_en: string; title_ar: string } | null>(null);

  useEffect(() => {
    if (application) setStatus(application.status);
  }, [application]);

  const loadInterviews = useCallback(async () => {
    if (!application?.id) return;
    const { data } = await supabase
      .from("job_interviews")
      .select("id,scheduled_at,duration_minutes,mode,meeting_link,location,status,outcome,notes")
      .eq("application_id", application.id)
      .order("scheduled_at", { ascending: false });
    setInterviews((data || []) as Interview[]);
  }, [application?.id]);

  const loadJobMeta = useCallback(async () => {
    if (!application?.job_id) return;
    const { data } = await supabase.from("jobs").select("title_en,title_ar").eq("id", application.job_id).maybeSingle();
    if (data) setJobMeta(data);
  }, [application?.job_id]);

  useEffect(() => {
    if (open && application) {
      void loadInterviews();
      void loadJobMeta();
    }
  }, [open, application, loadInterviews, loadJobMeta]);

  if (!application) return null;

  const fieldByKey: Record<string, any> = {};
  (formFields || []).forEach((f) => { fieldByKey[f.key] = f; });

  const updateStatus = async (newStatus: string) => {
    setSaving(true);
    const { error } = await supabase.from("job_applications").update({
      status: newStatus as any,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", application.id);
    setSaving(false);
    if (error) {
      toast({ title: isRTL ? "فشل التحديث" : "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    setStatus(newStatus);
    application.status = newStatus;
    toast({ title: isRTL ? "تم تحديث الحالة" : "Status updated" });

    // Send shortlisted email if new status is shortlisted
    if (newStatus === "shortlisted") {
      void supabase.functions.invoke("send-email", {
        body: {
          to: application.applicant_email,
          templateName: "job-application-shortlisted",
          audience: "staff",
          idempotencyKey: `shortlisted-${application.id}`,
          templateData: {
            applicant_name: application.applicant_name,
            job_title: jobMeta?.title_ar || jobMeta?.title_en || "",
          },
        },
      });
    }

    onUpdated();
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    const note = { id: crypto.randomUUID(), text: newNote.trim(), author_id: user?.id, created_at: new Date().toISOString() };
    const updated = Array.isArray(application.admin_notes) ? [...application.admin_notes, note] : [note];
    setSaving(true);
    const { error } = await supabase.from("job_applications").update({ admin_notes: updated }).eq("id", application.id);
    setSaving(false);
    if (error) {
      toast({ title: isRTL ? "فشل الحفظ" : "Save failed", description: error.message, variant: "destructive" });
    } else {
      application.admin_notes = updated;
      setNewNote("");
      toast({ title: isRTL ? "تمت إضافة الملاحظة" : "Note added" });
      onUpdated();
    }
  };

  const downloadCv = async () => {
    if (!application.cv_url) return;
    setDownloadingCv(true);
    const { data, error } = await supabase.storage.from("job-applications").createSignedUrl(application.cv_url, 60);
    setDownloadingCv(false);
    if (error || !data?.signedUrl) {
      toast({ title: isRTL ? "فشل تنزيل الملف" : "Download failed", description: error?.message, variant: "destructive" });
    } else {
      window.open(data.signedUrl, "_blank");
    }
  };

  const isFinalStatus = status === "hired" || status === "rejected";
  const interviewModeIcon = (mode: string) => mode === "online" ? Video : mode === "onsite" ? MapPin : Phone;
  const cairoDate = (iso: string) => new Date(iso).toLocaleString(isRTL ? "ar-EG" : "en-US", { timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {application.applicant_name}
              <Badge variant="outline" className={STATUS_META[status]?.color}>
                {isRTL ? STATUS_META[status]?.ar : STATUS_META[status]?.en}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {/* Contact + actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <a href={`mailto:${application.applicant_email}`} className="text-primary hover:underline">{application.applicant_email}</a>
                </div>
                {application.applicant_phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <a href={`tel:${application.applicant_phone}`} className="text-primary hover:underline">{application.applicant_phone}</a>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  {cairoDate(application.submitted_at)}
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Badge variant="outline">{application.source === "invite" ? (isRTL ? "دعوة مباشرة" : "Invite") : (isRTL ? "تقديم مباشر" : "Direct")}</Badge>
                  {application.converted_employee_id && (
                    <Badge className="bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30">
                      <UserCheck className="w-3 h-3 me-1" />
                      {isRTL ? "تم التحويل لموظف" : "Converted"}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="text-sm font-medium mb-2">{isRTL ? "الإجراءات" : "Actions"}</div>

                {!isFinalStatus && (
                  <>
                    {/* Pre-interview actions: only for new/under_review/shortlisted */}
                    {status === "new" && (
                      <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => updateStatus("under_review")} disabled={saving}>
                        <ClipboardCheck className="w-4 h-4 me-2" />
                        {isRTL ? "بدء المراجعة" : "Start review"}
                      </Button>
                    )}
                    {(status === "new" || status === "under_review") && (
                      <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => updateStatus("shortlisted")} disabled={saving}>
                        <Star className="w-4 h-4 me-2 text-purple-500" />
                        {isRTL ? "ضمن القائمة المختصرة" : "Shortlist"}
                      </Button>
                    )}
                    {/* Schedule interview: hidden when an active scheduled interview already exists */}
                    {!interviews.some((iv) => iv.status === "scheduled") && (
                      <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setScheduleOpen(true)}>
                        <CalendarPlus className="w-4 h-4 me-2 text-indigo-500" />
                        {status === "interviewing"
                          ? (isRTL ? "إعادة جدولة مقابلة" : "Reschedule interview")
                          : (isRTL ? "جدولة مقابلة" : "Schedule interview")}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setHireOpen(true)}>
                      <UserCheck className="w-4 h-4 me-2 text-green-600" />
                      {isRTL ? "توظيف" : "Hire"}
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start text-destructive hover:text-destructive" onClick={() => setRejectOpen(true)}>
                      <XCircle className="w-4 h-4 me-2" />
                      {isRTL ? "رفض" : "Reject"}
                    </Button>
                  </>
                )}

                {isFinalStatus && (
                  <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                    {status === "hired"
                      ? (isRTL ? "تم توظيف هذا المتقدم" : "This applicant has been hired")
                      : (isRTL ? "تم رفض هذا الطلب" : "This application was rejected")}
                    {application.rejection_reason_code && status === "rejected" && (
                      <div className="mt-1 font-medium">
                        {isRTL ? "السبب: " : "Reason: "}{application.rejection_reason_code}
                      </div>
                    )}
                  </div>
                )}

                {application.cv_url && (
                  <Button variant="ghost" size="sm" className="w-full justify-start" onClick={downloadCv} disabled={downloadingCv}>
                    {downloadingCv ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Download className="w-4 h-4 me-2" />}
                    {isRTL ? "تنزيل السيرة الذاتية" : "Download CV"}
                  </Button>
                )}

                <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
                  <a href={`mailto:${application.applicant_email}`}>
                    <Send className="w-4 h-4 me-2" />
                    {isRTL ? "إرسال إيميل" : "Send email"}
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Interviews */}
          <Card className="mt-3">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {isRTL ? "المقابلات" : "Interviews"}
                  <Badge variant="outline">{interviews.length}</Badge>
                </div>
                <Button size="sm" variant="outline" onClick={() => setScheduleOpen(true)}>
                  <CalendarPlus className="w-4 h-4 me-2" />
                  {isRTL ? "جدولة" : "Schedule"}
                </Button>
              </div>

              {interviews.length === 0 ? (
                <div className="text-xs text-muted-foreground italic py-2">{isRTL ? "لا توجد مقابلات بعد" : "No interviews scheduled yet"}</div>
              ) : (
                <div className="space-y-2">
                  {interviews.map((iv) => {
                    const Icon = interviewModeIcon(iv.mode);
                    const isPast = new Date(iv.scheduled_at) < new Date();
                    const needsOutcome = isPast && iv.status === "scheduled";
                    return (
                      <div key={iv.id} className="flex items-start gap-3 p-3 rounded-lg border">
                        <div className="rounded-md bg-muted p-2"><Icon className="w-4 h-4 text-primary" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{cairoDate(iv.scheduled_at)}</span>
                            <span className="text-xs text-muted-foreground">· {iv.duration_minutes} {isRTL ? "د" : "min"}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {iv.status === "scheduled" ? (isRTL ? "مجدولة" : "Scheduled")
                                : iv.status === "completed" ? (isRTL ? "تمت" : "Completed")
                                : iv.status === "no_show" ? (isRTL ? "لم يحضر" : "No-show")
                                : (isRTL ? "ملغاة" : "Cancelled")}
                            </Badge>
                            {iv.outcome && (
                              <Badge variant="outline" className={
                                iv.outcome === "pass" ? "text-green-700 dark:text-green-300 border-green-500/30"
                                : iv.outcome === "fail" ? "text-red-700 dark:text-red-300 border-red-500/30"
                                : "text-amber-700 dark:text-amber-300 border-amber-500/30"
                              }>
                                {iv.outcome === "pass" ? (isRTL ? "نجح" : "Pass")
                                  : iv.outcome === "fail" ? (isRTL ? "لم ينجح" : "Fail")
                                  : (isRTL ? "جولة أخرى" : "Another round")}
                              </Badge>
                            )}
                            {needsOutcome && (
                              <Badge variant="outline" className="text-amber-700 border-amber-500/30">
                                <AlertCircle className="w-3 h-3 me-1" />
                                {isRTL ? "بانتظار النتيجة" : "Awaiting outcome"}
                              </Badge>
                            )}
                          </div>
                          {iv.meeting_link && (
                            <a href={iv.meeting_link} target="_blank" rel="noopener" className="text-xs text-primary hover:underline truncate block mt-1">
                              {iv.meeting_link}
                            </a>
                          )}
                          {iv.location && <div className="text-xs text-muted-foreground mt-1">{iv.location}</div>}
                          {iv.notes && <div className="text-xs text-muted-foreground mt-1 italic">"{iv.notes}"</div>}
                        </div>
                        {iv.status === "scheduled" && (
                          <Button size="sm" variant="ghost" onClick={() => setOutcomeOpen(iv.id)}>
                            <ClipboardCheck className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Answers */}
          {application.answers && Object.keys(application.answers).length > 0 && (
            <Card className="mt-3">
              <CardContent className="p-4">
                <div className="text-sm font-medium mb-3">{isRTL ? "إجابات النموذج" : "Form Answers"}</div>
                <div className="space-y-3">
                  {Object.entries(application.answers).map(([key, value]) => {
                    const field = fieldByKey[key];
                    const label = field ? (isRTL ? field.label_ar : field.label_en) : key;
                    return (
                      <div key={key}>
                        <div className="text-xs text-muted-foreground mb-1">{label}</div>
                        <div className="text-sm whitespace-pre-wrap break-words">{String(value || "—")}</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Admin notes */}
          <Card className="mt-3">
            <CardContent className="p-4 space-y-3">
              <div className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                {isRTL ? "ملاحظات داخلية" : "Internal Notes"}
              </div>
              {Array.isArray(application.admin_notes) && application.admin_notes.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {application.admin_notes.map((n: any) => (
                    <div key={n.id} className="text-sm p-2 rounded bg-muted">
                      <div className="whitespace-pre-wrap">{n.text}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString(isRTL ? "ar-EG" : "en-US")}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic">{isRTL ? "لا توجد ملاحظات بعد" : "No notes yet"}</div>
              )}
              <div className="flex gap-2">
                <Textarea
                  rows={2}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder={isRTL ? "أضف ملاحظة…" : "Add a note…"}
                />
                <Button onClick={addNote} disabled={!newNote.trim() || saving}>{isRTL ? "إضافة" : "Add"}</Button>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>

      <InterviewScheduleDialog
        applicationId={application.id}
        applicantName={application.applicant_name}
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onScheduled={() => {
          void loadInterviews();
          // Auto-set status to interviewing if it isn't already final
          if (!isFinalStatus && status !== "interviewing") void updateStatus("interviewing");
          else onUpdated();
        }}
      />

      <RejectApplicationDialog
        application={{
          id: application.id,
          applicant_name: application.applicant_name,
          applicant_email: application.applicant_email,
          status,
          jobs: jobMeta || undefined,
        }}
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onRejected={() => {
          setStatus("rejected");
          application.status = "rejected";
          onUpdated();
        }}
      />

      <HireApplicationDialog
        application={{
          id: application.id,
          applicant_name: application.applicant_name,
          applicant_email: application.applicant_email,
          converted_employee_id: application.converted_employee_id,
        }}
        open={hireOpen}
        onOpenChange={setHireOpen}
        onConverted={() => {
          setStatus("hired");
          application.status = "hired";
          onUpdated();
        }}
      />

      <InterviewOutcomeDialog
        interviewId={outcomeOpen}
        open={!!outcomeOpen}
        onOpenChange={(o) => { if (!o) setOutcomeOpen(null); }}
        onSaved={() => { void loadInterviews(); onUpdated(); }}
      />
    </>
  );
}
