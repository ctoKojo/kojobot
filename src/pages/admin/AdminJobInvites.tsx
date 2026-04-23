import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Send, ArrowLeft, ArrowRight, Copy, Loader2, Mail, RefreshCw, Info } from "lucide-react";

interface Invite {
  id: string;
  email: string;
  token: string;
  status: string;
  personal_message: string | null;
  expires_at: string;
  created_at: string;
  opened_at: string | null;
  applied_at: string | null;
}

interface Job {
  id: string;
  slug: string;
  title_en: string;
  title_ar: string;
  type: string | null;
  location_en: string | null;
  location_ar: string | null;
  salary_range: string | null;
  description_en: string | null;
  description_ar: string | null;
  requirements_en: string | null;
  requirements_ar: string | null;
  benefits_en: string | null;
  benefits_ar: string | null;
  training_season: string | null;
  is_paid: boolean | null;
  deadline_at: string | null;
}

interface EmailLogRow {
  id: string;
  message_id: string | null;
  status: string;
  delivery_status: string | null;
  delivery_status_at: string | null;
  bounce_type: string | null;
  bounce_reason: string | null;
  error_message: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

type DeliveryState =
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "failed"
  | "deferred"
  | "accepted"
  | "pending"
  | "unknown";

const DELIVERY_BADGE: Record<DeliveryState, string> = {
  delivered: "bg-green-500/10 text-green-700 dark:text-green-300",
  opened: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  clicked: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  accepted: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  pending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  deferred: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  bounced: "bg-red-500/10 text-red-700 dark:text-red-300",
  complained: "bg-red-500/10 text-red-700 dark:text-red-300",
  failed: "bg-red-500/10 text-red-700 dark:text-red-300",
  unknown: "bg-muted text-muted-foreground",
};

const labelFor = (state: DeliveryState, isRTL: boolean): string => {
  const map: Record<DeliveryState, [string, string]> = {
    delivered: ["تم التسليم", "Delivered"],
    opened: ["تم الفتح", "Opened"],
    clicked: ["تم النقر", "Clicked"],
    accepted: ["تم القبول", "Accepted"],
    pending: ["قيد الإرسال", "Pending"],
    deferred: ["مؤجل", "Deferred"],
    bounced: ["مرتد", "Bounced"],
    complained: ["شكوى", "Complained"],
    failed: ["فشل", "Failed"],
    unknown: ["غير معروف", "Unknown"],
  };
  return map[state][isRTL ? 0 : 1];
};

const computeDelivery = (log?: EmailLogRow | null): DeliveryState => {
  if (!log) return "unknown";
  if (log.delivery_status) {
    const ds = log.delivery_status.toLowerCase();
    if (ds === "delivered") return "delivered";
    if (ds === "opened") return "opened";
    if (ds === "clicked") return "clicked";
    if (ds === "bounced") return "bounced";
    if (ds === "complained") return "complained";
    if (ds === "failed") return "failed";
    if (ds === "deferred") return "deferred";
  }
  if (log.status === "sent") return "accepted";
  if (log.status === "pending") return "pending";
  if (log.status === "failed") return "failed";
  return "unknown";
};

export default function AdminJobInvites() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const ArrowIcon = isRTL ? ArrowRight : ArrowLeft;

  const [job, setJob] = useState<Job | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [emailLogs, setEmailLogs] = useState<Record<string, EmailLogRow>>({});
  const [loading, setLoading] = useState(true);
  const [emailsText, setEmailsText] = useState("");
  const [personalMsg, setPersonalMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [detailsInvite, setDetailsInvite] = useState<Invite | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [jobRes, invRes] = await Promise.all([
      supabase
        .from("jobs")
        .select(
          "id,slug,title_en,title_ar,type,location_en,location_ar,salary_range,description_en,description_ar,requirements_en,requirements_ar,benefits_en,benefits_ar,training_season,is_paid,deadline_at",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.from("job_invites").select("*").eq("job_id", id).order("created_at", { ascending: false }),
    ]);
    if (jobRes.data) setJob(jobRes.data as Job);
    const inviteRows = (invRes.data ?? []) as Invite[];
    setInvites(inviteRows);

    if (inviteRows.length > 0) {
      const keys = inviteRows.map((i) => `job-invite-${i.id}`);
      const { data: logs } = await supabase
        .from("email_send_log")
        .select("id, message_id, status, delivery_status, delivery_status_at, bounce_type, bounce_reason, error_message, created_at, metadata")
        .in("message_id", keys)
        .order("created_at", { ascending: false });
      const map: Record<string, EmailLogRow> = {};
      for (const row of (logs ?? []) as EmailLogRow[]) {
        if (row.message_id && !map[row.message_id]) map[row.message_id] = row;
      }
      setEmailLogs(map);
    } else {
      setEmailLogs({});
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [id]);

  const parseEmails = (): string[] => {
    return emailsText
      .split(/[,;\n\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  };

  const validEmails = useMemo(() => parseEmails(), [emailsText]);

  const copyLink = (token: string) => {
    if (!job) return;
    const url = `${window.location.origin}/apply/${job.slug}?invite=${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: isRTL ? "تم نسخ الرابط" : "Link copied" });
  };

  const dispatchInviteEmail = async (
    inv: { id: string; email: string; token: string; expires_at: string },
    msg: string,
  ) => {
    if (!job) return { ok: false, error: "no-job" } as const;
    const appUrl = window.location.origin;

    const jobTypeLabelEn = (() => {
      const t = (job.type ?? "").toLowerCase();
      if (t === "full_time") return "Full-time";
      if (t === "part_time") return "Part-time";
      if (t === "contract") return "Contract";
      if (t === "internship") return "Internship";
      return job.type ?? "";
    })();
    const jobTypeLabelAr = (() => {
      const t = (job.type ?? "").toLowerCase();
      if (t === "full_time") return "دوام كامل";
      if (t === "part_time") return "دوام جزئي";
      if (t === "contract") return "عقد";
      if (t === "internship") return "تدريب";
      return job.type ?? "";
    })();

    const { data, error } = await supabase.functions.invoke("send-email", {
      body: {
        to: inv.email,
        templateName: "job-invite-to-apply",
        idempotencyKey: `job-invite-${inv.id}`,
        audience: "staff",
        templateData: {
          job_title: job.title_en,
          job_title_ar: job.title_ar,
          job_type_en: jobTypeLabelEn,
          job_type_ar: jobTypeLabelAr,
          location_en: job.location_en ?? "",
          location_ar: job.location_ar ?? "",
          salary_range: job.salary_range ?? "",
          description_en: job.description_en ?? "",
          description_ar: job.description_ar ?? "",
          requirements_en: job.requirements_en ?? "",
          requirements_ar: job.requirements_ar ?? "",
          benefits_en: job.benefits_en ?? "",
          benefits_ar: job.benefits_ar ?? "",
          training_season: job.training_season ?? "",
          is_paid_label_en: job.is_paid ? "Paid" : "Unpaid",
          is_paid_label_ar: job.is_paid ? "مدفوع" : "غير مدفوع",
          deadline_at: job.deadline_at
            ? new Date(job.deadline_at).toLocaleDateString("en-US")
            : "",
          apply_url: `${appUrl}/apply/${job.slug}?invite=${inv.token}`,
          personal_message: msg,
          expires_at: new Date(inv.expires_at).toLocaleDateString("en-US"),
        },
      },
    });
    if (error) return { ok: false, error: error.message } as const;
    return { ok: true, data } as const;
  };

  const sendInvites = async () => {
    if (!job || !user || validEmails.length === 0) return;
    setSending(true);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const trimmedMessage = personalMsg.trim();
    const records = validEmails.map((email) => ({
      id: crypto.randomUUID(),
      job_id: job.id,
      email,
      token: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8),
      personal_message: trimmedMessage || null,
      invited_by: user.id,
      status: "sent" as const,
      expires_at: expiresAt.toISOString(),
    }));

    const { error } = await supabase.from("job_invites").insert(records);

    if (error) {
      toast({ title: isRTL ? "فشل الإرسال" : "Failed to send", description: error.message, variant: "destructive" });
      setSending(false);
      return;
    }

    const sendResults = await Promise.allSettled(
      records.map((inv) => dispatchInviteEmail(inv, trimmedMessage)),
    );

    const failedCount = sendResults.filter(
      (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok),
    ).length;
    const acceptedCount = records.length - failedCount;

    if (failedCount > 0) {
      toast({
        title: isRTL
          ? `قُبل ${acceptedCount} وفشل ${failedCount}`
          : `Accepted ${acceptedCount}, ${failedCount} failed`,
        description: isRTL
          ? "الدعوة اتسجلت لكن مزود البريد رفضها لبعض العناوين. اضغط 'إعادة إرسال' من الجدول."
          : "Some sends were rejected by the email provider. Use 'Resend' in the table.",
        variant: "destructive",
      });
    } else {
      toast({
        title: isRTL ? `تم قبول ${records.length} دعوة` : `${records.length} invites accepted`,
        description: isRTL
          ? "القبول لا يضمن التسليم. ستظهر حالة التسليم الفعلية في عمود 'حالة البريد'."
          : "Accepted ≠ delivered. Real delivery status will appear in the table.",
      });
    }

    setEmailsText("");
    setPersonalMsg("");
    setSending(false);
    void load();
  };

  const resendInvite = async (inv: Invite) => {
    setResendingId(inv.id);
    // Clear the existing log row so the new send isn't blocked by idempotency
    await supabase
      .from("email_send_log")
      .delete()
      .eq("message_id", `job-invite-${inv.id}`);

    const result = await dispatchInviteEmail(inv, inv.personal_message ?? "");
    if (!result.ok) {
      toast({
        title: isRTL ? "فشل إعادة الإرسال" : "Resend failed",
        description: result.error,
        variant: "destructive",
      });
    } else {
      toast({
        title: isRTL ? "تم قبول الدعوة من جديد" : "Invite re-accepted",
        description: isRTL
          ? "في انتظار تأكيد التسليم من مزود البريد."
          : "Waiting for delivery confirmation.",
      });
    }
    setResendingId(null);
    void load();
  };

  return (
    <DashboardLayout>
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/jobs/${id}`)}>
          <ArrowIcon className="w-4 h-4 me-2" />
          {isRTL ? "العودة للوظيفة" : "Back to job"}
        </Button>
      </div>

      <PageHeader
        title={isRTL ? "إرسال دعوات تقديم" : "Send Application Invites"}
        subtitle={job ? (isRTL ? job.title_ar : job.title_en) : ""}
        icon={Send}
      />

      {/* Composer */}
      <Card className="mt-6">
        <CardContent className="p-6 space-y-4">
          <div>
            <Label>{isRTL ? "إيميلات (مفصولة بفاصلة أو سطر جديد)" : "Emails (comma or newline-separated)"}</Label>
            <Textarea
              rows={4}
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              placeholder="user1@example.com, user2@example.com"
            />
            <div className="text-xs text-muted-foreground mt-1">
              {isRTL ? `إيميلات صحيحة: ${validEmails.length}` : `Valid emails: ${validEmails.length}`}
            </div>
          </div>

          <div>
            <Label>{isRTL ? "رسالة شخصية (اختياري)" : "Personal message (optional)"}</Label>
            <Textarea
              rows={3}
              value={personalMsg}
              onChange={(e) => setPersonalMsg(e.target.value)}
              placeholder={isRTL ? "نحب نشوفك جزء من فريقنا…" : "We'd love to see you on our team…"}
            />
          </div>

          <Button onClick={sendInvites} disabled={sending || validEmails.length === 0}>
            {sending ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Mail className="w-4 h-4 me-2" />}
            {isRTL ? `إرسال ${validEmails.length} دعوة` : `Send ${validEmails.length} invites`}
          </Button>
        </CardContent>
      </Card>

      {/* Invites table */}
      <Card className="mt-6">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isRTL ? "البريد" : "Email"}</TableHead>
                <TableHead>{isRTL ? "حالة الدعوة" : "Invite status"}</TableHead>
                <TableHead>{isRTL ? "حالة البريد" : "Email status"}</TableHead>
                <TableHead>{isRTL ? "تم الإرسال" : "Sent"}</TableHead>
                <TableHead>{isRTL ? "ينتهي في" : "Expires"}</TableHead>
                <TableHead className="w-32 text-end">{isRTL ? "إجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">{isRTL ? "جاري التحميل…" : "Loading…"}</TableCell></TableRow>
              ) : invites.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">{isRTL ? "لم يتم إرسال دعوات بعد" : "No invites sent yet"}</TableCell></TableRow>
              ) : invites.map((inv) => {
                const log = emailLogs[`job-invite-${inv.id}`];
                const delivery = computeDelivery(log);
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-muted text-muted-foreground">
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={DELIVERY_BADGE[delivery]}>
                        {labelFor(delivery, isRTL)}
                      </Badge>
                      {log?.bounce_reason && (
                        <div className="text-xs text-destructive mt-1 max-w-[220px] truncate" title={log.bounce_reason}>
                          {log.bounce_reason}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(inv.created_at).toLocaleDateString(isRTL ? "ar-EG" : "en-US")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(inv.expires_at).toLocaleDateString(isRTL ? "ar-EG" : "en-US")}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDetailsInvite(inv)}
                          title={isRTL ? "تفاصيل التسليم" : "Delivery details"}
                        >
                          <Info className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => resendInvite(inv)}
                          disabled={resendingId === inv.id}
                          title={isRTL ? "إعادة إرسال" : "Resend"}
                        >
                          {resendingId === inv.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <RefreshCw className="w-4 h-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => copyLink(inv.token)} title={isRTL ? "نسخ الرابط" : "Copy link"}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Details dialog */}
      <Dialog open={!!detailsInvite} onOpenChange={(open) => !open && setDetailsInvite(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isRTL ? "تفاصيل تسليم البريد" : "Email delivery details"}</DialogTitle>
            <DialogDescription>{detailsInvite?.email}</DialogDescription>
          </DialogHeader>
          {(() => {
            if (!detailsInvite) return null;
            const log = emailLogs[`job-invite-${detailsInvite.id}`];
            if (!log) {
              return (
                <p className="text-sm text-muted-foreground">
                  {isRTL ? "لا يوجد سجل بريد لهذه الدعوة." : "No email log found for this invite."}
                </p>
              );
            }
            const meta = (log.metadata ?? {}) as Record<string, unknown>;
            const resendId = (meta.resend_id as string | undefined) ?? null;
            return (
              <div className="space-y-2 text-sm">
                <Row label={isRTL ? "حالة الإرسال" : "Send status"} value={log.status} />
                <Row label={isRTL ? "حالة التسليم" : "Delivery"} value={log.delivery_status ?? "—"} />
                <Row
                  label={isRTL ? "آخر حدث في" : "Last event at"}
                  value={log.delivery_status_at
                    ? new Date(log.delivery_status_at).toLocaleString(isRTL ? "ar-EG" : "en-US")
                    : "—"}
                />
                <Row
                  label={isRTL ? "وقت الإرسال" : "Sent at"}
                  value={new Date(log.created_at).toLocaleString(isRTL ? "ar-EG" : "en-US")}
                />
                <Row label={isRTL ? "Resend ID" : "Resend ID"} value={resendId ?? "—"} mono />
                <Row label={isRTL ? "Idempotency Key" : "Idempotency Key"} value={log.message_id ?? "—"} mono />
                {log.bounce_type && (
                  <Row label={isRTL ? "نوع الارتداد" : "Bounce type"} value={log.bounce_type} />
                )}
                {log.bounce_reason && (
                  <Row label={isRTL ? "سبب الارتداد" : "Bounce reason"} value={log.bounce_reason} />
                )}
                {log.error_message && (
                  <Row label={isRTL ? "رسالة الخطأ" : "Error"} value={log.error_message} />
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-end ${mono ? "font-mono text-xs" : ""} break-all max-w-[60%]`}>
        {value}
      </span>
    </div>
  );
}
