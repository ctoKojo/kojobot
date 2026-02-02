import { useState, useEffect } from 'react';
import { AlertTriangle, Search, X, User, Calendar, Filter } from 'lucide-react';
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

interface InstructorWarning {
  id: string;
  instructor_id: string;
  session_id: string | null;
  warning_type: string;
  reason: string;
  reason_ar: string | null;
  created_at: string;
  is_active: boolean;
  instructor?: {
    full_name: string;
    full_name_ar: string | null;
    avatar_url: string | null;
    email: string;
  };
  session?: {
    session_number: number | null;
    session_date: string;
    groups: {
      name: string;
      name_ar: string;
    };
  };
}

interface WarningStats {
  total: number;
  noQuiz: number;
  noAttendance: number;
  noAssignment: number;
}

export default function InstructorWarnings() {
  const { isRTL, language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [warnings, setWarnings] = useState<InstructorWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [stats, setStats] = useState<WarningStats>({ total: 0, noQuiz: 0, noAttendance: 0, noAssignment: 0 });

  useEffect(() => {
    fetchWarnings();
  }, []);

  const fetchWarnings = async () => {
    try {
      const { data, error } = await supabase
        .from('instructor_warnings')
        .select(`
          *,
          sessions(session_number, session_date, groups(name, name_ar))
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch instructor profiles separately
      const instructorIds = [...new Set((data || []).map(w => w.instructor_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, full_name_ar, avatar_url, email')
        .in('user_id', instructorIds.length > 0 ? instructorIds : ['none']);

      const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const warningsWithInstructor = (data || []).map(w => ({
        ...w,
        instructor: profilesMap.get(w.instructor_id),
        session: w.sessions,
      }));

      setWarnings(warningsWithInstructor);

      // Calculate stats
      setStats({
        total: warningsWithInstructor.length,
        noQuiz: warningsWithInstructor.filter(w => w.warning_type === 'no_quiz').length,
        noAttendance: warningsWithInstructor.filter(w => w.warning_type === 'no_attendance').length,
        noAssignment: warningsWithInstructor.filter(w => w.warning_type === 'no_assignment').length,
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
        .from('instructor_warnings')
        .update({ is_active: false })
        .eq('id', warningId);

      if (error) throw error;

      toast({
        title: isRTL ? 'تم الإلغاء' : 'Dismissed',
        description: isRTL ? 'تم إلغاء الإنذار بنجاح' : 'Warning dismissed successfully',
      });

      fetchWarnings();
    } catch (error) {
      console.error('Error dismissing warning:', error);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في إلغاء الإنذار' : 'Failed to dismiss warning',
      });
    } finally {
      setDismissingId(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getWarningTypeBadge = (type: string) => {
    const badges = {
      no_quiz: { label: isRTL ? 'كويز مفقود' : 'Missing Quiz', variant: 'destructive' as const },
      no_attendance: { label: isRTL ? 'حضور غير مسجل' : 'No Attendance', variant: 'secondary' as const },
      no_assignment: { label: isRTL ? 'واجب مفقود' : 'Missing Assignment', variant: 'outline' as const },
    };
    return badges[type as keyof typeof badges] || { label: type, variant: 'default' as const };
  };

  const filteredWarnings = warnings.filter(w => {
    const matchesSearch = 
      w.instructor?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.instructor?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.reason?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || w.warning_type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  return (
    <DashboardLayout title={isRTL ? 'إنذارات المدربين' : 'Instructor Warnings'}>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'إجمالي الإنذارات' : 'Total Warnings'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTypeFilter('no_quiz')}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <AlertTriangle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.noQuiz}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'كويز مفقود' : 'Missing Quiz'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTypeFilter('no_attendance')}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.noAttendance}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'حضور غير مسجل' : 'No Attendance'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTypeFilter('no_assignment')}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.noAssignment}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'واجب مفقود' : 'Missing Assignment'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={isRTL ? 'بحث بالاسم أو البريد...' : 'Search by name or email...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder={isRTL ? 'نوع الإنذار' : 'Warning Type'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? 'الكل' : 'All Types'}</SelectItem>
                  <SelectItem value="no_quiz">{isRTL ? 'كويز مفقود' : 'Missing Quiz'}</SelectItem>
                  <SelectItem value="no_attendance">{isRTL ? 'حضور غير مسجل' : 'No Attendance'}</SelectItem>
                  <SelectItem value="no_assignment">{isRTL ? 'واجب مفقود' : 'Missing Assignment'}</SelectItem>
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
                    <TableRow>
                      <TableHead>{isRTL ? 'المدرب' : 'Instructor'}</TableHead>
                      <TableHead>{isRTL ? 'نوع الإنذار' : 'Warning Type'}</TableHead>
                      <TableHead>{isRTL ? 'السبب' : 'Reason'}</TableHead>
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
                              onClick={() => navigate(`/instructors/${warning.instructor_id}`)}
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={warning.instructor?.avatar_url || undefined} />
                                <AvatarFallback>
                                  {warning.instructor?.full_name?.charAt(0) || 'I'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">
                                  {language === 'ar' 
                                    ? warning.instructor?.full_name_ar || warning.instructor?.full_name 
                                    : warning.instructor?.full_name
                                  }
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {warning.instructor?.email}
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
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {formatDate(warning.created_at)}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDismissingId(warning.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-100"
                            >
                              <X className="h-4 w-4 mr-1" />
                              {isRTL ? 'إلغاء' : 'Dismiss'}
                            </Button>
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

      {/* Dismiss Confirmation Dialog */}
      <AlertDialog open={!!dismissingId} onOpenChange={() => setDismissingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRTL ? 'إلغاء الإنذار' : 'Dismiss Warning'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL 
                ? 'هل أنت متأكد من إلغاء هذا الإنذار؟ لن يتم حذفه ولكن سيتم إخفاؤه من القائمة.'
                : 'Are you sure you want to dismiss this warning? It will not be deleted but will be hidden from the list.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={() => dismissingId && handleDismissWarning(dismissingId)}>
              {isRTL ? 'تأكيد الإلغاء' : 'Confirm Dismiss'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
