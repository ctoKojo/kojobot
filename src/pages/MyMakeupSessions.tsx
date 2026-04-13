import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/timeUtils';
import { Calendar, Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface MakeupSessionData {
  id: string;
  reason: string;
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  notes: string | null;
  is_free: boolean;
  created_at: string;
  student_confirmed: boolean | null;
  groups: { name: string; name_ar: string } | null;
  levels: { name: string; name_ar: string } | null;
}

export default function MyMakeupSessions() {
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<MakeupSessionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchSessions();
  }, [user]);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('makeup_sessions')
        .select('id, reason, status, scheduled_date, scheduled_time, notes, is_free, created_at, student_confirmed, groups(name, name_ar), levels(name, name_ar)')
        .eq('student_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSessions((data as any) || []);
    } catch (error) {
      console.error('Error fetching makeup sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Confirm/Reject removed — handled by parent account now

  const getStatusInfo = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pending: { label: isRTL ? 'معلق' : 'Pending', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
      scheduled: { label: isRTL ? 'مجدول' : 'Scheduled', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
      completed: { label: isRTL ? 'مكتمل' : 'Completed', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
      cancelled: { label: isRTL ? 'ملغي' : 'Cancelled', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
      expired: { label: isRTL ? 'منتهي' : 'Expired', className: 'bg-muted text-muted-foreground' },
    };
    return map[status] || { label: status, className: '' };
  };

  const pending = sessions.filter(s => s.status === 'pending' || (s.status === 'scheduled' && s.student_confirmed === null));
  const others = sessions.filter(s => !pending.includes(s));

  // Note: Confirm/Reject actions are now handled by the parent account

  return (
    <DashboardLayout title={isRTL ? 'سيشناتي التعويضية' : 'My Makeup Sessions'}>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[
            { label: isRTL ? 'معلق' : 'Pending', value: sessions.filter(s => s.status === 'pending').length, icon: AlertTriangle, gradient: 'from-yellow-500 to-amber-500' },
            { label: isRTL ? 'مجدول' : 'Scheduled', value: sessions.filter(s => s.status === 'scheduled').length, icon: Calendar, gradient: 'from-blue-500 to-blue-600' },
            { label: isRTL ? 'مكتمل' : 'Completed', value: sessions.filter(s => s.status === 'completed').length, icon: CheckCircle, gradient: 'from-emerald-500 to-emerald-600' },
            { label: isRTL ? 'مجاني مستخدم' : 'Free Used', value: `${sessions.filter(s => s.is_free).length}/2`, icon: Clock, gradient: 'from-purple-500 to-purple-600' },
          ].map((stat, i) => (
            <Card key={i} className="relative overflow-hidden border-0 shadow-sm">
              <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${stat.gradient}`} />
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                    <stat.icon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold">{stat.value}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action Required */}
        {pending.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              {isRTL ? 'تحتاج إجراء' : 'Action Required'}
            </h3>
            <div className="grid gap-3">
              {pending.map(session => {
                const statusInfo = getStatusInfo(session.status);
                const groupName = language === 'ar' ? (session.groups?.name_ar || session.groups?.name) : session.groups?.name;
                return (
                  <Card key={session.id} className="border-yellow-200 dark:border-yellow-800">
                    <CardContent className="pt-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{groupName || '-'}</span>
                            <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                            {session.is_free ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{isRTL ? 'مجاني' : 'Free'}</Badge>
                            ) : (
                              <Badge variant="outline">{isRTL ? 'مدفوع' : 'Paid'}</Badge>
                            )}
                            <Badge variant="outline" className="text-muted-foreground">
                              {session.reason === 'group_cancelled' ? (isRTL ? 'إلغاء مجموعة' : 'Group Cancelled') : (isRTL ? 'غياب' : 'Absent')}
                            </Badge>
                          </div>
                          {session.scheduled_date && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {session.scheduled_date} {session.scheduled_time}
                            </p>
                          )}
                          {session.notes && (
                            <p className="text-sm text-muted-foreground">{session.notes}</p>
                          )}
                        </div>
                        {session.status === 'scheduled' && session.student_confirmed === null && (
                          <div className="shrink-0">
                            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                              {isRTL ? 'بانتظار تأكيد ولي الأمر' : 'Awaiting Parent Confirmation'}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* All Sessions */}
        <div>
          <h3 className="text-lg font-semibold mb-3">
            {isRTL ? 'كل السيشنات التعويضية' : 'All Makeup Sessions'}
          </h3>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
          ) : sessions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{isRTL ? 'لا توجد سيشنات تعويضية' : 'No makeup sessions'}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {others.map(session => {
                const statusInfo = getStatusInfo(session.status);
                const groupName = language === 'ar' ? (session.groups?.name_ar || session.groups?.name) : session.groups?.name;
                return (
                  <Card key={session.id}>
                    <CardContent className="pt-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{groupName || '-'}</span>
                            <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                            {session.is_free ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{isRTL ? 'مجاني' : 'Free'}</Badge>
                            ) : (
                              <Badge variant="outline">{isRTL ? 'مدفوع' : 'Paid'}</Badge>
                            )}
                          </div>
                          {session.scheduled_date && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {session.scheduled_date} {session.scheduled_time}
                            </p>
                          )}
                          {session.student_confirmed === true && (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{isRTL ? 'مؤكد ✓' : 'Confirmed ✓'}</Badge>
                          )}
                          {session.student_confirmed === false && (
                            <Badge variant="destructive">{isRTL ? 'مرفوض' : 'Rejected'}</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(session.created_at, language)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
