import { useState, useEffect } from 'react';
import { formatDateTime } from '@/lib/timeUtils';
import { Activity, Search, Filter, Download, User, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { exportActivityLogs } from '@/lib/exportUtils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

interface UserProfile {
  user_id: string;
  full_name: string;
  full_name_ar: string | null;
}

export default function ActivityLogPage() {
  const { t, isRTL, language } = useLanguage();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setLogs(data || []);

      // Fetch user profiles for the logs
      const userIds = [...new Set(data?.map(log => log.user_id) || [])];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, full_name_ar')
          .in('user_id', userIds);

        const usersMap: Record<string, UserProfile> = {};
        profiles?.forEach(p => {
          usersMap[p.user_id] = p;
        });
        setUsers(usersMap);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      login: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400',
      logout: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400',
      create: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400',
      update: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400',
      delete: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400',
      view: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400',
      assign: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400',
      submit: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400',
      start: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400',
      complete: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400',
      grade: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400',
      freeze: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400',
      unfreeze: 'bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-900/30 dark:text-lime-400',
      activate: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400',
      deactivate: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400',
    };
    return colors[action] || 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400';
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      login: { en: 'Login', ar: 'تسجيل دخول' },
      logout: { en: 'Logout', ar: 'تسجيل خروج' },
      create: { en: 'Create', ar: 'إنشاء' },
      update: { en: 'Update', ar: 'تحديث' },
      delete: { en: 'Delete', ar: 'حذف' },
      view: { en: 'View', ar: 'عرض' },
      assign: { en: 'Assign', ar: 'إسناد' },
      submit: { en: 'Submit', ar: 'تسليم' },
      start: { en: 'Start', ar: 'بدء' },
      complete: { en: 'Complete', ar: 'إكمال' },
      grade: { en: 'Grade', ar: 'تقييم' },
      freeze: { en: 'Freeze', ar: 'تجميد' },
      unfreeze: { en: 'Unfreeze', ar: 'إلغاء تجميد' },
      activate: { en: 'Activate', ar: 'تفعيل' },
      deactivate: { en: 'Deactivate', ar: 'إلغاء تفعيل' },
    };
    return labels[action]?.[language] || action;
  };

  const getEntityLabel = (entity: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      user: { en: 'User', ar: 'مستخدم' },
      student: { en: 'Student', ar: 'طالب' },
      instructor: { en: 'Instructor', ar: 'مدرب' },
      group: { en: 'Group', ar: 'مجموعة' },
      session: { en: 'Session', ar: 'سيشن' },
      quiz: { en: 'Quiz', ar: 'كويز' },
      quiz_submission: { en: 'Quiz Result', ar: 'نتيجة كويز' },
      assignment: { en: 'Assignment', ar: 'واجب' },
      assignment_submission: { en: 'Assignment Submission', ar: 'تسليم واجب' },
      attendance: { en: 'Attendance', ar: 'حضور' },
      subscription: { en: 'Subscription', ar: 'اشتراك' },
      age_group: { en: 'Age Group', ar: 'فئة عمرية' },
      level: { en: 'Level', ar: 'مستوى' },
      notification: { en: 'Notification', ar: 'إشعار' },
      warning: { en: 'Warning', ar: 'إنذار' },
      profile: { en: 'Profile', ar: 'ملف شخصي' },
    };
    return labels[entity]?.[language] || entity;
  };

  // SSOT: using centralized formatDateTime from timeUtils.ts

  const getUserName = (userId: string) => {
    const user = users[userId];
    if (!user) return userId.slice(0, 8) + '...';
    return language === 'ar' && user.full_name_ar ? user.full_name_ar : user.full_name;
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getUserName(log.user_id).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesEntity = entityFilter === 'all' || log.entity_type === entityFilter;
    return matchesSearch && matchesAction && matchesEntity;
  });

  const uniqueActions = [...new Set(logs.map((log) => log.action))];
  const uniqueEntities = [...new Set(logs.map((log) => log.entity_type))];

  const formatDetails = (details: any) => {
    if (!details) return '-';
    if (typeof details === 'string') return details;
    
    // Format as key-value pairs
    const entries = Object.entries(details).slice(0, 3);
    return entries.map(([key, value]) => `${key}: ${value}`).join(', ');
  };

  return (
    <DashboardLayout title={t.activityLog.title}>
      <div className="space-y-6">
        {/* Header Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{logs.length}</p>
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? 'إجمالي السجلات' : 'Total Logs'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {logs.filter(l => l.action === 'login').length}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? 'عمليات الدخول' : 'Logins'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {logs.filter(l => l.action === 'update').length}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? 'تحديثات' : 'Updates'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">{Object.keys(users).length}</p>
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? 'مستخدمين نشطين' : 'Active Users'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.common.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder={t.activityLog.filterByType} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.common.all}</SelectItem>
              {uniqueActions.map((action) => (
                <SelectItem key={action} value={action}>
                  {getActionLabel(action)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder={isRTL ? 'نوع الكيان' : 'Entity Type'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.common.all}</SelectItem>
              {uniqueEntities.map((entity) => (
                <SelectItem key={entity} value={entity}>
                  {getEntityLabel(entity)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {isRTL ? 'تحديث' : 'Refresh'}
          </Button>
          <Button variant="outline" onClick={() => exportActivityLogs(filteredLogs, users, language)}>
            <Download className="h-4 w-4 mr-2" />
            {isRTL ? 'تصدير' : 'Export'}
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.activityLog.timestamp}</TableHead>
                  <TableHead>{t.activityLog.user}</TableHead>
                  <TableHead>{t.activityLog.action}</TableHead>
                  <TableHead>{t.activityLog.target}</TableHead>
                  <TableHead className="max-w-[200px]">{t.activityLog.details}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      {t.common.loading}
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        {isRTL ? 'لا توجد سجلات نشاط' : 'No activity logs found'}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(log.created_at, language)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {getUserName(log.user_id)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getActionBadge(log.action)}>
                          {getActionLabel(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getEntityLabel(log.entity_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {formatDetails(log.details)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
