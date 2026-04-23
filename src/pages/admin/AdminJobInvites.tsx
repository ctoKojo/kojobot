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
import { Send, ArrowLeft, ArrowRight, Copy, Loader2, Mail } from "lucide-react";

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
}

const STATUS_COLOR: Record<string, string> = {
  sent: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  opened: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  applied: "bg-green-500/10 text-green-700 dark:text-green-300",
  expired: "bg-red-500/10 text-red-700 dark:text-red-300",
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
  const [loading, setLoading] = useState(true);
  const [emailsText, setEmailsText] = useState("");
  const [personalMsg, setPersonalMsg] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [jobRes, invRes] = await Promise.all([
      supabase.from("jobs").select("id,slug,title_en,title_ar").eq("id", id).maybeSingle(),
      supabase.from("job_invites").select("*").eq("job_id", id).order("created_at", { ascending: false }),
    ]);
    if (jobRes.data) setJob(jobRes.data as Job);
    if (invRes.data) setInvites(invRes.data as Invite[]);
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

  const sendInvites = async () => {
    if (!job || !user || validEmails.length === 0) return;
    setSending(true);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const records = validEmails.map((email) => ({
      job_id: job.id,
      email,
      token: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8),
      personal_message: personalMsg.trim() || null,
      invited_by: user.id,
      status: "sent" as const,
      expires_at: expiresAt.toISOString(),
    }));

    const { data: inserted, error } = await supabase.from("job_invites").insert(records).select();

    if (error) {
      toast({ title: isRTL ? "فشل الإرسال" : "Failed to send", description: error.message, variant: "destructive" });
      setSending(false);
      return;
    }

    // Fire emails (non-blocking)
    const appUrl = window.location.origin;
    await Promise.allSettled(
      (inserted || []).map((inv: any) =>
        supabase.functions.invoke("send-email", {
          body: {
            to: inv.email,
            template_name: "job-invite-to-apply",
            variables: {
              job_title: job.title_en,
              job_title_ar: job.title_ar,
              apply_url: `${appUrl}/apply/${job.slug}?invite=${inv.token}`,
              personal_message: personalMsg.trim() || "",
              expires_at: new Date(inv.expires_at).toLocaleDateString("en-US"),
            },
          },
        }),
      ),
    );

    toast({ title: isRTL ? `تم إرسال ${validEmails.length} دعوة` : `Sent ${validEmails.length} invites` });
    setEmailsText("");
    setPersonalMsg("");
    setSending(false);
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
                <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                <TableHead>{isRTL ? "تم الإرسال" : "Sent"}</TableHead>
                <TableHead>{isRTL ? "ينتهي في" : "Expires"}</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">{isRTL ? "جاري التحميل…" : "Loading…"}</TableCell></TableRow>
              ) : invites.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">{isRTL ? "لم يتم إرسال دعوات بعد" : "No invites sent yet"}</TableCell></TableRow>
              ) : invites.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_COLOR[inv.status] || ""}>{inv.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(inv.created_at).toLocaleDateString(isRTL ? "ar-EG" : "en-US")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(inv.expires_at).toLocaleDateString(isRTL ? "ar-EG" : "en-US")}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => copyLink(inv.token)} title={isRTL ? "نسخ الرابط" : "Copy link"}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
