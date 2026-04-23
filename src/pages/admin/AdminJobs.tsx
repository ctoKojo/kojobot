import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Briefcase, Plus, Search, MoreVertical, Eye, Pencil, Trash2, Send, Users, ExternalLink, Copy } from "lucide-react";
import { JobFormDialog } from "@/components/recruitment/JobFormDialog";
import { RecruitmentMetricsCard } from "@/components/recruitment/RecruitmentMetricsCard";

type JobStatus = "draft" | "published" | "closed" | "archived";

interface JobRow {
  id: string;
  slug: string;
  title_en: string;
  title_ar: string;
  type: string;
  status: JobStatus;
  is_featured: boolean;
  posted_at: string | null;
  deadline_at: string | null;
  applications_count: number;
  created_at: string;
}

const STATUS_STYLES: Record<JobStatus, { label_en: string; label_ar: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label_en: "Draft", label_ar: "مسودة", variant: "secondary" },
  published: { label_en: "Published", label_ar: "منشور", variant: "default" },
  closed: { label_en: "Closed", label_ar: "مغلق", variant: "outline" },
  archived: { label_en: "Archived", label_ar: "مؤرشف", variant: "destructive" },
};

const TYPE_LABEL: Record<string, { en: string; ar: string }> = {
  full_time: { en: "Full Time", ar: "دوام كامل" },
  part_time: { en: "Part Time", ar: "دوام جزئي" },
  internship: { en: "Internship", ar: "تدريب" },
  summer_training: { en: "Summer Training", ar: "تدريب صيفي" },
  volunteer: { en: "Volunteer", ar: "تطوع" },
  freelance: { en: "Freelance", ar: "عمل حر" },
};

export default function AdminJobs() {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<any | null>(null);
  const [openForm, setOpenForm] = useState(false);

  const openEdit = async (jobId: string) => {
    // Fetch the FULL job row (the list query only selects a subset of columns)
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();
    if (error || !data) {
      toast({ title: isRTL ? "فشل تحميل بيانات الوظيفة" : "Failed to load job", description: error?.message, variant: "destructive" });
      return;
    }
    setEditing(data);
    setOpenForm(true);
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("jobs")
      .select("id,slug,title_en,title_ar,type,status,is_featured,posted_at,deadline_at,applications_count,created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: isRTL ? "فشل التحميل" : "Failed to load", description: error.message, variant: "destructive" });
    } else {
      setJobs((data || []) as JobRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return j.title_en.toLowerCase().includes(q) || j.title_ar.includes(search) || j.slug.includes(q);
    });
  }, [jobs, search, statusFilter]);

  const stats = useMemo(() => ({
    total: jobs.length,
    published: jobs.filter((j) => j.status === "published").length,
    draft: jobs.filter((j) => j.status === "draft").length,
    totalApps: jobs.reduce((sum, j) => sum + (j.applications_count || 0), 0),
  }), [jobs]);

  const handleDelete = async (job: JobRow) => {
    if (!confirm(isRTL ? `حذف الوظيفة "${job.title_ar}"؟` : `Delete job "${job.title_en}"?`)) return;
    const { error } = await supabase.from("jobs").delete().eq("id", job.id);
    if (error) {
      toast({ title: isRTL ? "فشل الحذف" : "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: isRTL ? "تم الحذف" : "Deleted" });
      void load();
    }
  };

  const handleStatusChange = async (job: JobRow, status: JobStatus) => {
    const update: any = { status };
    if (status === "published" && !job.posted_at) update.posted_at = new Date().toISOString();
    const { error } = await supabase.from("jobs").update(update).eq("id", job.id);
    if (error) {
      toast({ title: isRTL ? "فشل التحديث" : "Update failed", description: error.message, variant: "destructive" });
    } else {
      void load();
    }
  };

  const copyJobLink = (slug: string) => {
    const url = `${window.location.origin}/careers/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: isRTL ? "تم نسخ الرابط" : "Link copied" });
  };

  return (
    <DashboardLayout>
      <PageHeader
        title={isRTL ? "إدارة الوظائف" : "Jobs Management"}
        subtitle={isRTL ? "إنشاء، تعديل، ومتابعة الوظائف والمتقدمين" : "Create, edit, and track jobs and applicants"}
        icon={Briefcase}
        actions={
          <Button onClick={() => { setEditing(null); setOpenForm(true); }}>
            <Plus className="w-4 h-4 me-2" />
            {isRTL ? "وظيفة جديدة" : "New Job"}
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label={isRTL ? "إجمالي" : "Total"} value={stats.total} />
        <StatCard label={isRTL ? "منشور" : "Published"} value={stats.published} accent="text-green-600 dark:text-green-400" />
        <StatCard label={isRTL ? "مسودة" : "Draft"} value={stats.draft} accent="text-amber-600 dark:text-amber-400" />
        <StatCard label={isRTL ? "متقدمين" : "Applicants"} value={stats.totalApps} accent="text-primary" />
      </div>

      {/* Recruitment KPIs (last 90 days) */}
      <div className="mb-6">
        <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
          {isRTL ? "مؤشرات الأداء (آخر 90 يوم)" : "Performance Indicators (Last 90 days)"}
        </div>
        <RecruitmentMetricsCard />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={isRTL ? "ابحث بالعنوان أو الـ slug…" : "Search by title or slug…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isRTL ? "كل الحالات" : "All statuses"}</SelectItem>
            <SelectItem value="published">{isRTL ? "منشور" : "Published"}</SelectItem>
            <SelectItem value="draft">{isRTL ? "مسودة" : "Draft"}</SelectItem>
            <SelectItem value="closed">{isRTL ? "مغلق" : "Closed"}</SelectItem>
            <SelectItem value="archived">{isRTL ? "مؤرشف" : "Archived"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isRTL ? "الوظيفة" : "Job"}</TableHead>
                <TableHead>{isRTL ? "النوع" : "Type"}</TableHead>
                <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                <TableHead className="text-center">{isRTL ? "متقدمين" : "Apps"}</TableHead>
                <TableHead>{isRTL ? "آخر يوم" : "Deadline"}</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">{isRTL ? "جاري التحميل…" : "Loading…"}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">{isRTL ? "لا توجد وظائف" : "No jobs"}</TableCell></TableRow>
              ) : filtered.map((job) => {
                const tStyle = STATUS_STYLES[job.status];
                const typeMeta = TYPE_LABEL[job.type] || { en: job.type, ar: job.type };
                return (
                  <TableRow key={job.id} className="cursor-pointer" onClick={() => navigate(`/admin/jobs/${job.id}`)}>
                    <TableCell>
                      <div className="font-medium">{isRTL ? job.title_ar : job.title_en}</div>
                      <div className="text-xs text-muted-foreground">/{job.slug}</div>
                      {job.is_featured && <Badge variant="outline" className="mt-1 text-[10px]">{isRTL ? "مميزة" : "Featured"}</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">{isRTL ? typeMeta.ar : typeMeta.en}</TableCell>
                    <TableCell>
                      <Badge variant={tStyle.variant}>{isRTL ? tStyle.label_ar : tStyle.label_en}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold">{job.applications_count}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {job.deadline_at ? new Date(job.deadline_at).toLocaleDateString(isRTL ? "ar-EG" : "en-US") : "—"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/admin/jobs/${job.id}`)}>
                            <Eye className="w-4 h-4 me-2" />{isRTL ? "عرض المتقدمين" : "View applicants"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(job.id)}>
                            <Pencil className="w-4 h-4 me-2" />{isRTL ? "تعديل" : "Edit"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/admin/jobs/${job.id}/invites`)}>
                            <Send className="w-4 h-4 me-2" />{isRTL ? "إرسال دعوات" : "Send invites"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {job.status === "draft" && (
                            <DropdownMenuItem onClick={() => handleStatusChange(job, "published")}>
                              <Send className="w-4 h-4 me-2" />{isRTL ? "نشر" : "Publish"}
                            </DropdownMenuItem>
                          )}
                          {job.status === "published" && (
                            <DropdownMenuItem onClick={() => handleStatusChange(job, "closed")}>
                              {isRTL ? "إغلاق" : "Close"}
                            </DropdownMenuItem>
                          )}
                          {(job.status === "closed" || job.status === "draft") && (
                            <DropdownMenuItem onClick={() => handleStatusChange(job, "archived")}>
                              {isRTL ? "أرشفة" : "Archive"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => copyJobLink(job.slug)}>
                            <Copy className="w-4 h-4 me-2" />{isRTL ? "نسخ الرابط" : "Copy link"}
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={`/careers/${job.slug}`} target="_blank" rel="noopener">
                              <ExternalLink className="w-4 h-4 me-2" />{isRTL ? "فتح في تبويب جديد" : "Open public page"}
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(job)}>
                            <Trash2 className="w-4 h-4 me-2" />{isRTL ? "حذف" : "Delete"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <JobFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        job={editing}
        onSaved={() => { setOpenForm(false); void load(); }}
      />
    </DashboardLayout>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold mt-1 ${accent || ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
