import { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
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

  const handleConfirm = async (id: string, confirmed: boolean) => {
    try {
      const { error } = await supabase
        .from('makeup_sessions')
        .update({ student_confirmed: confirmed })
        .eq('id', id);

      if (error) throw error;
      toast({
        title: confirmed
          ? (isRTL ? 'تم التأكيد' : 'Confirmed')
          : (isRTL ? 'تم الرفض' : 'Rejected'),
      });
      fetchSessions();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error' });
    }
  };

  const getStatusInfo = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pending: { label: isRTL ? 'معلق' : 'Pending', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
      scheduled: { label: isRTL ? 'مجدول' : 'Scheduled', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
      completed: { label: isRTL ? 'مكتمل' : 'Completed', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
      expired: { label: isRTL ? 'منتهي' : 'Expired', className: 'bg-muted text-muted-foreground' },
    };
    return map[status] || { label: status, className: '' };
  };

  const pending = sessions.filter(s => s.status === 'pending' || (s.status === 'scheduled' && s.student_confirmed === null));
  const others = sessions.filter(s => !pending.includes(s));

  return (
    <DashboardLayout title={isRTL ? 'سيشناتي التعويضية' : 'My Makeup Sessions'}>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold">{sessions.filter(s => s.status === 'pending').length}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'معلق' : 'Pending'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{sessions.filter(s => s.status === 'scheduled').length}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'مجدول' : 'Scheduled'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{sessions.filter(s => s.status === 'completed').length}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'مكتمل' : 'Completed'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">{sessions.filter(s => s.is_free).length}/2</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? 'مجاني مستخدم' : 'Free Used'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
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
                          <div className="flex gap-2 shrink-0">
                            <Button size="sm" onClick={() => handleConfirm(session.id, true)}>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              {isRTL ? 'تأكيد' : 'Confirm'}
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleConfirm(session.id, false)}>
                              <XCircle className="h-4 w-4 mr-1" />
                              {isRTL ? 'رفض' : 'Reject'}
                            </Button>
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
                          {new Date(session.created_at).toLocaleDateString()}
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
