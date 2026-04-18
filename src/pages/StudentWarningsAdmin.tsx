import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/timeUtils';
import { AlertTriangle, Search, X, Calendar, Filter, Clock, FileText } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface StudentWarning {
  id: string;
  student_id: string;
  warning_type: string;
  reason: string;
  reason_ar: string | null;
  created_at: string;
  is_active: boolean;
  assignment_id: string | null;
  student?: {
    full_name: string;
    full_name_ar: string | null;
    avatar_url: string | null;
    email: string;
  };
  assignments?: {
    title: string;
    title_ar: string;
  } | null;
}

interface WarningStats {
  total: number;
  deadline: number;
  attendance: number;
  behavior: number;
  other: number;
}

export default function StudentWarningsAdmin() {
  const { isRTL, language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [warnings, setWarnings] = useState<StudentWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [stats, setStats] = useState<WarningStats>({ total: 0, deadline: 0, attendance: 0, behavior: 0, other: 0 });

  useEffect(() => {
    fetchWarnings();
  }, [statusFilter]);

  const fetchWarnings = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('warnings')
        .select(`
          *,
          assignments(title, title_ar)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter === 'active') query = query.eq('is_active', true);
      else if (statusFilter === 'resolved') query = query.eq('is_active', false);

      const { data, error } = await query;
      if (error) throw error;

      const studentIds = [...new Set((data || []).map(w => w.student_id))].filter(Boolean);
      const profilesMap = new Map();
      if (studentIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, full_name_ar, avatar_url, email')
          .in('user_id', studentIds);
        profiles?.forEach(p => profilesMap.set(p.user_id, p));
      }

      const enriched = (data || []).map(w => ({
        ...w,
        student: profilesMap.get(w.student_id),
      }));

      setWarnings(enriched);
      setStats({
        total: enriched.length,
        deadline: enriched.filter(w => w.warning_type === 'deadline').length,
        attendance: enriched.filter(w => w.warning_type === 'attendance').length,
        behavior: enriched.filter(w => w.warning_type === 'behavior').length,
        other: enriched.filter(w => !['deadline', 'attendance', 'behavior'].includes(w.warning_type)).length,
      });
    } catch (error) {
      console.error('Error fetching warnings:', error);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في تحميل الإنذارات' : 'Failed to load warnings',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDismissWarning = async (warningId: string) => {
    try {
      const { error } = await supabase
        .from('warnings')
        .update({ is_active: false })
        .eq('id', warningId);

      if (error) throw error;

      toast({
        title: isRTL ? 'تم الحل' : 'Resolved',
        description: isRTL ? 'تم تحديث الإنذار بنجاح' : 'Warning resolved successfully',
      });

      fetchWarnings();
    } catch (error) {
      console.error('Error dismissing warning:', error);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في تحديث الإنذار' : 'Failed to update warning',
      });
    } finally {
      setDismissingId(null);
    }
  };

  const getWarningTypeBadge = (type: string) => {
    const badges: Record<string, { label: string; variant: 'destructive' | 'secondary' | 'outline' | 'default'; icon: typeof Clock }> = {
      deadline: { label: isRTL ? 'تفويت موعد' : 'Missed Deadline', variant: 'destructive', icon: Clock },
      attendance: { label: isRTL ? 'غياب' : 'Absence', variant: 'secondary', icon: Calendar },
      behavior: { label: isRTL ? 'سلوك' : 'Behavior', variant: 'outline', icon: AlertTriangle },
    };
    return badges[type] || { label: type, variant: 'default' as const, icon: FileText };
  };

  const filteredWarnings = warnings.filter(w => {
    const matchesSearch =
      w.student?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.student?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.reason?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || w.warning_type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <DashboardLayout title={isRTL ? 'إنذارات الطلاب' : 'Student Warnings'}>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {[
            { label: isRTL ? 'الإجمالي' : 'Total', value: stats.total, icon: AlertTriangle, gradient: 'from-red-500 to-red-600', filter: 'all' as string },
            { label: isRTL ? 'تفويت موعد' : 'Deadline', value: stats.deadline, icon: Clock, gradient: 'from-orange-500 to-orange-600', filter: 'deadline' },
            { label: isRTL ? 'غياب' : 'Attendance', value: stats.attendance, icon: Calendar, gradient: 'from-amber-500 to-amber-600', filter: 'attendance' },
            { label: isRTL ? 'سلوك' : 'Behavior', value: stats.behavior, icon: AlertTriangle, gradient: 'from-purple-500 to-purple-600', filter: 'behavior' },
            { label: isRTL ? 'أخرى' : 'Other', value: stats.other, icon: FileText, gradient: 'from-slate-500 to-slate-600', filter: 'other' },
          ].map((stat) => (
            <Card
              key={stat.filter}
              className={`relative overflow-hidden cursor-pointer hover:shadow-md transition-all duration-300 ${typeFilter === stat.filter ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setTypeFilter(stat.filter)}
            >
              <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${stat.gradient}`} />
              <CardContent className="pt-5 pb-4 px-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                    <stat.icon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              {isRTL ? 'التصفية والبحث' : 'Filter & Search'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={isRTL ? 'بحث بالاسم أو البريد أو السبب...' : 'Search by name, email or reason...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="ps-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder={isRTL ? 'نوع الإنذار' : 'Warning Type'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? 'كل الأنواع' : 'All Types'}</SelectItem>
                  <SelectItem value="deadline">{isRTL ? 'تفويت موعد' : 'Missed Deadline'}</SelectItem>
                  <SelectItem value="attendance">{isRTL ? 'غياب' : 'Absence'}</SelectItem>
                  <SelectItem value="behavior">{isRTL ? 'سلوك' : 'Behavior'}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{isRTL ? 'نشطة' : 'Active'}</SelectItem>
                  <SelectItem value="resolved">{isRTL ? 'تم الحل' : 'Resolved'}</SelectItem>
                  <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Warnings Table */}
        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'قائمة الإنذارات' : 'Warnings List'}</CardTitle>
            <CardDescription>
              {isRTL
                ? `عرض ${filteredWarnings.length} إنذار من أصل ${warnings.length}`
                : `Showing ${filteredWarnings.length} of ${warnings.length} warnings`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                {isRTL ? 'جاري التحميل...' : 'Loading...'}
              </div>
            ) : filteredWarnings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {isRTL ? 'لا توجد إنذارات' : 'No warnings found'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                      <TableHead>{isRTL ? 'نوع الإنذار' : 'Type'}</TableHead>
                      <TableHead>{isRTL ? 'السبب' : 'Reason'}</TableHead>
                      <TableHead>{isRTL ? 'الواجب' : 'Assignment'}</TableHead>
                      <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'الإجراءات' : 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWarnings.map((warning) => {
                      const badge = getWarningTypeBadge(warning.warning_type);
                      return (
                        <TableRow key={warning.id}>
                          <TableCell>
                            <div
                              className="flex items-center gap-3 cursor-pointer hover:opacity-80"
                              onClick={() => navigate(`/student/${warning.student_id}`)}
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={warning.student?.avatar_url || undefined} />
                                <AvatarFallback>
                                  {warning.student?.full_name?.charAt(0) || 'S'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">
                                  {language === 'ar'
                                    ? warning.student?.full_name_ar || warning.student?.full_name
                                    : warning.student?.full_name
                                  }
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {warning.student?.email}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <p className="truncate">
                              {language === 'ar' ? warning.reason_ar || warning.reason : warning.reason}
                            </p>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            {warning.assignments ? (
                              <p className="truncate text-sm">
                                {language === 'ar' ? warning.assignments.title_ar : warning.assignments.title}
                              </p>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {warning.is_active ? (
                              <Badge variant="destructive">{isRTL ? 'نشط' : 'Active'}</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                {isRTL ? 'تم الحل' : 'Resolved'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {formatDate(warning.created_at, language)}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {warning.is_active && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDismissingId(warning.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-100"
                              >
                                <X className="h-4 w-4 mr-1" />
                                {isRTL ? 'حل' : 'Resolve'}
                              </Button>
                            )}
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

      <AlertDialog open={!!dismissingId} onOpenChange={() => setDismissingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRTL ? 'حل الإنذار' : 'Resolve Warning'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL
                ? 'هل أنت متأكد من تحديد هذا الإنذار كمحلول؟'
                : 'Are you sure you want to mark this warning as resolved?'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={() => dismissingId && handleDismissWarning(dismissingId)}>
              {isRTL ? 'تأكيد' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
