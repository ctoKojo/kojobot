import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, ArrowLeft, ArrowRight, Search, Download, Send, Users, Eye, FileText, CalendarClock, CheckCircle2, XCircle } from "lucide-react";
import { ApplicationDetailDialog } from "@/components/recruitment/ApplicationDetailDialog";

const STATUS_LIST = ["new", "under_review", "shortlisted", "interviewing", "hired", "rejected"] as const;
type AppStatus = typeof STATUS_LIST[number];

const STATUS_META: Record<AppStatus, { en: string; ar: string; color: string }> = {
  new: { en: "New", ar: "جديد", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  under_review: { en: "Under Review", ar: "قيد المراجعة", color: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  shortlisted: { en: "Shortlisted", ar: "قائمة مختصرة", color: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30" },
  interviewing: { en: "Interviewing", ar: "مقابلة", color: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30" },
  hired: { en: "Hired", ar: "تم التوظيف", color: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30" },
  rejected: { en: "Rejected", ar: "مرفوض", color: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30" },
};

interface InterviewLite {
  id: string;
  application_id: string;
  scheduled_at: string;
  status: string;
  applicant_confirmed_at: string | null;
  reschedule_requested_at: string | null;
  cancelled_by_applicant_at: string | null;
}

interface Application {
  id: string;
  job_id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  cv_url: string | null;
  status: AppStatus;
  source: string;
  answers: any;
  admin_notes: any;
  submitted_at: string;
}

interface Job {
  id: string;
  title_en: string;
  title_ar: string;
  slug: string;
  status: string;
  applications_count: number;
  form_fields: any;
}

export default function AdminJobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const ArrowIcon = isRTL ? ArrowRight : ArrowLeft;

  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Application | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [jobRes, appsRes] = await Promise.all([
      supabase.from("jobs").select("id,title_en,title_ar,slug,status,applications_count,form_fields").eq("id", id).maybeSingle(),
      supabase.from("job_applications").select("*").eq("job_id", id).order("submitted_at", { ascending: false }),
    ]);
    if (jobRes.error) {
      toast({ title: isRTL ? "فشل تحميل الوظيفة" : "Failed to load job", description: jobRes.error.message, variant: "destructive" });
    } else {
      setJob(jobRes.data as Job | null);
    }
    if (!appsRes.error) setApplications((appsRes.data || []) as Application[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [id]);

  const filtered = useMemo(() => {
    return applications.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return a.applicant_name.toLowerCase().includes(q) || a.applicant_email.toLowerCase().includes(q);
    });
  }, [applications, search, statusFilter]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: applications.length };
    STATUS_LIST.forEach((s) => { c[s] = applications.filter((a) => a.status === s).length; });
    return c;
  }, [applications]);

  const exportCsv = () => {
    if (!applications.length) return;
    const header = ["Name", "Email", "Phone", "Status", "Source", "Submitted", "Answers"];
    const rows = applications.map((a) => [
      a.applicant_name,
      a.applicant_email,
      a.applicant_phone || "",
      a.status,
      a.source,
      new Date(a.submitted_at).toISOString(),
      JSON.stringify(a.answers || {}),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `applications-${job?.slug}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/jobs")}>
          <ArrowIcon className="w-4 h-4 me-2" />
          {isRTL ? "كل الوظائف" : "All jobs"}
        </Button>
      </div>

      <PageHeader
        title={job ? (isRTL ? job.title_ar : job.title_en) : "—"}
        subtitle={job ? `/${job.slug} · ${applications.length} ${isRTL ? "متقدم" : "applicants"}` : ""}
        icon={Briefcase}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={!applications.length}>
              <Download className="w-4 h-4 me-2" />
              CSV
            </Button>
            <Button onClick={() => navigate(`/admin/jobs/${id}/invites`)}>
              <Send className="w-4 h-4 me-2" />
              {isRTL ? "إرسال دعوات" : "Send invites"}
            </Button>
          </div>
        }
      />

      {/* Status tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mt-6">
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="all">
            {isRTL ? "الكل" : "All"} ({statusCounts.all})
          </TabsTrigger>
          {STATUS_LIST.map((s) => (
            <TabsTrigger key={s} value={s}>
              {isRTL ? STATUS_META[s].ar : STATUS_META[s].en} ({statusCounts[s] || 0})
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4 mb-3">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={isRTL ? "ابحث بالاسم أو البريد…" : "Search by name or email…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
            />
          </div>
        </div>

        <TabsContent value={statusFilter}>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? "المتقدم" : "Applicant"}</TableHead>
                    <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                    <TableHead>{isRTL ? "المصدر" : "Source"}</TableHead>
                    <TableHead>{isRTL ? "السيرة الذاتية" : "CV"}</TableHead>
                    <TableHead>{isRTL ? "تاريخ التقديم" : "Submitted"}</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">{isRTL ? "جاري التحميل…" : "Loading…"}</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      {isRTL ? "لا يوجد متقدمين" : "No applicants yet"}
                    </TableCell></TableRow>
                  ) : filtered.map((a) => (
                    <TableRow key={a.id} className="cursor-pointer" onClick={() => setSelected(a)}>
                      <TableCell>
                        <div className="font-medium">{a.applicant_name}</div>
                        <div className="text-xs text-muted-foreground">{a.applicant_email}</div>
                        {a.applicant_phone && <div className="text-xs text-muted-foreground">{a.applicant_phone}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_META[a.status].color}>
                          {isRTL ? STATUS_META[a.status].ar : STATUS_META[a.status].en}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {a.source === "invite" ? (isRTL ? "دعوة" : "Invite") : (isRTL ? "مباشر" : "Direct")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {a.cv_url ? <FileText className="w-4 h-4 text-primary" /> : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(a.submitted_at).toLocaleString(isRTL ? "ar-EG" : "en-US")}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => setSelected(a)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ApplicationDetailDialog
        application={selected}
        formFields={job?.form_fields || []}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onUpdated={() => { void load(); }}
      />
    </DashboardLayout>
  );
}
