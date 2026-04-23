import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, FileText, Download, MessageSquare, Calendar, Loader2, Send } from "lucide-react";

const STATUS_LIST = ["new", "under_review", "shortlisted", "interviewing", "hired", "rejected"] as const;
const STATUS_LABEL: Record<string, { en: string; ar: string }> = {
  new: { en: "New", ar: "جديد" },
  under_review: { en: "Under Review", ar: "قيد المراجعة" },
  shortlisted: { en: "Shortlisted", ar: "قائمة مختصرة" },
  interviewing: { en: "Interviewing", ar: "مقابلة" },
  hired: { en: "Hired", ar: "تم التوظيف" },
  rejected: { en: "Rejected", ar: "مرفوض" },
};

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

  useEffect(() => {
    if (application) setStatus(application.status);
  }, [application]);

  if (!application) return null;

  const fieldByKey: Record<string, any> = {};
  (formFields || []).forEach((f) => { fieldByKey[f.key] = f; });

  const updateStatus = async (newStatus: string) => {
    setSaving(true);
    const { error } = await supabase.from("job_applications").update({ status: newStatus as any }).eq("id", application.id);
    setSaving(false);
    if (error) {
      toast({ title: isRTL ? "فشل التحديث" : "Update failed", description: error.message, variant: "destructive" });
    } else {
      setStatus(newStatus);
      toast({ title: isRTL ? "تم تحديث الحالة" : "Status updated" });
      onUpdated();
    }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{application.applicant_name}</DialogTitle>
        </DialogHeader>

        {/* Contact + status */}
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
                {new Date(application.submitted_at).toLocaleString(isRTL ? "ar-EG" : "en-US")}
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Badge variant="outline">{application.source === "invite" ? (isRTL ? "دعوة مباشرة" : "Invite") : (isRTL ? "تقديم مباشر" : "Direct")}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="text-sm font-medium">{isRTL ? "الحالة" : "Status"}</div>
              <Select value={status} onValueChange={updateStatus} disabled={saving}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_LIST.map((s) => (
                    <SelectItem key={s} value={s}>{isRTL ? STATUS_LABEL[s].ar : STATUS_LABEL[s].en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {application.cv_url && (
                <Button variant="outline" className="w-full" onClick={downloadCv} disabled={downloadingCv}>
                  {downloadingCv ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Download className="w-4 h-4 me-2" />}
                  {isRTL ? "تنزيل السيرة الذاتية" : "Download CV"}
                </Button>
              )}

              <Button variant="outline" className="w-full" asChild>
                <a href={`mailto:${application.applicant_email}`}>
                  <Send className="w-4 h-4 me-2" />
                  {isRTL ? "إرسال إيميل" : "Send email"}
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>

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
  );
}
