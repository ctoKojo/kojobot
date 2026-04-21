import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { ClipboardList, Search, Loader2 } from "lucide-react";
import { format } from "date-fns";

type RequestStatus = "pending" | "contacted" | "closed";

const statusColors: Record<RequestStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  contacted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  closed: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
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
        .select("*, landing_plans!inner(name_en, name_ar, slug)")
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

  const filtered = requests?.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(s) ||
      r.email.toLowerCase().includes(s) ||
      r.phone.includes(s) ||
      r.id.substring(0, 8).toUpperCase().includes(s.toUpperCase())
    );
  });

  const pendingCount = requests?.filter((r) => r.status === "pending").length || 0;

  const inner = (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg">
                <ClipboardList className="h-5 w-5 text-white" />
              </div>
              {l("Subscription Requests", "طلبات الاشتراك")}
              {pendingCount > 0 && (
                <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                  {pendingCount} {l("pending", "معلق")}
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{l("Manage incoming subscription requests", "إدارة طلبات الاشتراك الواردة")}</p>
          </div>
        </div>
      )}

      {embedded && pendingCount > 0 && (
        <div className="flex items-center justify-end">
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            {pendingCount} {l("pending", "معلق")}
          </Badge>
        </div>
      )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative w-64">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={l("Search name, email, phone...", "ابحث بالاسم أو الإيميل أو التليفون...")}
              className="ps-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{l("All", "الكل")}</SelectItem>
              <SelectItem value="pending">{l("Pending", "معلق")}</SelectItem>
              <SelectItem value="contacted">{l("Contacted", "تم التواصل")}</SelectItem>
              <SelectItem value="closed">{l("Closed", "مغلق")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !filtered?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                {l("No subscription requests found", "لا توجد طلبات اشتراك")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>{l("Ref #", "رقم مرجعي")}</TableHead>
                    <TableHead>{l("Name", "الاسم")}</TableHead>
                    <TableHead>{l("Phone", "التليفون")}</TableHead>
                    <TableHead>{l("Email", "الإيميل")}</TableHead>
                    <TableHead>{l("Plan", "الباقة")}</TableHead>
                    <TableHead>{l("Mode", "النوع")}</TableHead>
                    <TableHead>{l("Date", "التاريخ")}</TableHead>
                    <TableHead>{l("Status", "الحالة")}</TableHead>
                    <TableHead>{l("Actions", "إجراءات")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((req) => {
                    const plan = req.landing_plans as any;
                    return (
                      <TableRow key={req.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{req.id.substring(0, 8).toUpperCase()}</TableCell>
                        <TableCell className="font-medium">{req.name}</TableCell>
                        <TableCell dir="ltr">{req.phone}</TableCell>
                        <TableCell dir="ltr" className="text-sm">{req.email}</TableCell>
                        <TableCell>{l(plan?.name_en, plan?.name_ar)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {req.attendance_mode === "online"
                              ? l("Online", "أونلاين")
                              : l("In-Person", "حضوري")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(req.created_at), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[req.status as RequestStatus] || ""}>
                            {req.status === "pending"
                              ? l("Pending", "معلق")
                              : req.status === "contacted"
                              ? l("Contacted", "تم التواصل")
                              : l("Closed", "مغلق")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={req.status}
                            onValueChange={(v) =>
                              updateStatus.mutate({ id: req.id, status: v as RequestStatus })
                            }
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">{l("Pending", "معلق")}</SelectItem>
                              <SelectItem value="contacted">{l("Contacted", "تم التواصل")}</SelectItem>
                              <SelectItem value="closed">{l("Closed", "مغلق")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
    </div>
  );

  if (embedded) return inner;
  return <DashboardLayout>{inner}</DashboardLayout>;
}
