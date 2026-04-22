import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { ClipboardList, Search, Inbox, Phone, CheckCircle2, XCircle, Clock, Mail } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type RequestStatus = "pending" | "contacted" | "closed";

const statusConfig: Record<RequestStatus, { color: string; icon: typeof Clock }> = {
  pending: {
    color: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
    icon: Clock,
  },
  contacted: {
    color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
    icon: Phone,
  },
  closed: {
    color: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
    icon: CheckCircle2,
  },
};

export default function SubscriptionRequests({ embedded = false }: { embedded?: boolean } = {}) {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const l = (en: string, ar: string) => (isRTL ? ar : en);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["subscription-requests", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("subscription_requests")
        .select("*, landing_plans(name_en, name_ar, slug)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RequestStatus }) => {
      const { error } = await supabase
        .from("subscription_requests")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-requests"] });
      toast({ title: l("Status updated", "تم تحديث الحالة") });
    },
    onError: () => {
      toast({ title: l("Failed to update", "فشل التحديث"), variant: "destructive" });
    },
  });

  const filtered = useMemo(() => {
    return requests?.filter((r) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        r.name?.toLowerCase().includes(s) ||
        r.email?.toLowerCase().includes(s) ||
        r.phone?.includes(s) ||
        r.id.substring(0, 8).toUpperCase().includes(s.toUpperCase())
      );
    });
  }, [requests, search]);

  // Stats — across all requests (not filter-restricted) for stable summary
  const { data: allCounts } = useQuery({
    queryKey: ["subscription-requests-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subscription_requests").select("status");
      if (error) throw error;
      const arr = data || [];
      return {
        total: arr.length,
        pending: arr.filter((r: any) => r.status === "pending").length,
        contacted: arr.filter((r: any) => r.status === "contacted").length,
        closed: arr.filter((r: any) => r.status === "closed").length,
      };
    },
  });

  const stats = allCounts || { total: 0, pending: 0, contacted: 0, closed: 0 };

  const summaryCards = [
    {
      key: "all",
      label: l("Total Requests", "إجمالي الطلبات"),
      value: stats.total,
      icon: Inbox,
      gradient: "from-violet-500 to-purple-600",
      glow: "shadow-violet-500/20",
    },
    {
      key: "pending",
      label: l("Pending", "معلقة"),
      value: stats.pending,
      icon: Clock,
      gradient: "from-amber-500 to-orange-500",
      glow: "shadow-amber-500/20",
    },
    {
      key: "contacted",
      label: l("Contacted", "تم التواصل"),
      value: stats.contacted,
      icon: Phone,
      gradient: "from-blue-500 to-indigo-600",
      glow: "shadow-blue-500/20",
    },
    {
      key: "closed",
      label: l("Closed", "مغلقة"),
      value: stats.closed,
      icon: CheckCircle2,
      gradient: "from-emerald-500 to-teal-600",
      glow: "shadow-emerald-500/20",
    },
  ];

  const inner = (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
            <ClipboardList className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{l("Subscription Requests", "طلبات الاشتراك")}</h1>
            <p className="text-sm text-muted-foreground">{l("Manage incoming subscription inquiries", "إدارة طلبات الاشتراك الواردة")}</p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((c) => (
          <Card
            key={c.key}
            className={cn(
              "relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-all cursor-pointer hover:-translate-y-0.5",
              c.glow,
              statusFilter === c.key && "ring-2 ring-primary/40"
            )}
            onClick={() => setStatusFilter(c.key)}
          >
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-[0.06]", c.gradient)} />
            <CardContent className="p-4 relative">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium mb-1">{c.label}</p>
                  <p className="text-2xl font-bold tabular-nums">{c.value}</p>
                </div>
                <div className={cn("p-2.5 rounded-xl bg-gradient-to-br shadow-md flex-shrink-0", c.gradient)}>
                  <c.icon className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={l("Search name, email, phone, ref #...", "ابحث بالاسم أو الإيميل أو التليفون أو رقم مرجعي...")}
            className="ps-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{l("All statuses", "كل الحالات")}</SelectItem>
            <SelectItem value="pending">{l("Pending", "معلقة")}</SelectItem>
            <SelectItem value="contacted">{l("Contacted", "تم التواصل")}</SelectItem>
            <SelectItem value="closed">{l("Closed", "مغلقة")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !filtered?.length ? (
            <div className="text-center py-16 px-6">
              <div className="inline-flex p-4 rounded-2xl bg-muted mb-4">
                <Inbox className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {search || statusFilter !== "all"
                  ? l("No requests match your filters", "لا توجد طلبات تطابق الفلاتر")
                  : l("No subscription requests yet", "لا توجد طلبات اشتراك حتى الآن")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-semibold">{l("Ref #", "رقم مرجعي")}</TableHead>
                    <TableHead className="font-semibold">{l("Name", "الاسم")}</TableHead>
                    <TableHead className="font-semibold">{l("Contact", "للتواصل")}</TableHead>
                    <TableHead className="font-semibold">{l("Plan", "الباقة")}</TableHead>
                    <TableHead className="font-semibold">{l("Mode", "النوع")}</TableHead>
                    <TableHead className="font-semibold">{l("Date", "التاريخ")}</TableHead>
                    <TableHead className="font-semibold">{l("Status", "الحالة")}</TableHead>
                    <TableHead className="font-semibold">{l("Actions", "إجراءات")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((req) => {
                    const plan = req.landing_plans as any;
                    const status = (req.status as RequestStatus) || "pending";
                    const StatusIcon = statusConfig[status]?.icon || Clock;
                    return (
                      <TableRow key={req.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-mono text-xs text-muted-foreground" dir="ltr">
                          {req.id.substring(0, 8).toUpperCase()}
                        </TableCell>
                        <TableCell className="font-medium">{req.name || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <a href={`tel:${req.phone}`} dir="ltr" className="text-xs text-foreground hover:text-primary inline-flex items-center gap-1.5">
                              <Phone className="h-3 w-3" />{req.phone}
                            </a>
                            <a href={`mailto:${req.email}`} dir="ltr" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1.5">
                              <Mail className="h-3 w-3" />{req.email}
                            </a>
                          </div>
                        </TableCell>
                        <TableCell>{plan ? l(plan.name_en, plan.name_ar) : "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {req.attendance_mode === "online" ? l("Online", "أونلاين") : l("In-Person", "حضوري")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground" dir="ltr">
                          {format(new Date(req.created_at), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("border gap-1.5 font-medium", statusConfig[status]?.color)}>
                            <StatusIcon className="h-3 w-3" />
                            {status === "pending"
                              ? l("Pending", "معلقة")
                              : status === "contacted"
                              ? l("Contacted", "تم التواصل")
                              : l("Closed", "مغلقة")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={status}
                            onValueChange={(v) => updateStatus.mutate({ id: req.id, status: v as RequestStatus })}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">{l("Pending", "معلقة")}</SelectItem>
                              <SelectItem value="contacted">{l("Contacted", "تم التواصل")}</SelectItem>
                              <SelectItem value="closed">{l("Closed", "مغلقة")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  if (embedded) return inner;
  return <DashboardLayout>{inner}</DashboardLayout>;
}
