import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Calendar, Clock, AlertTriangle, CreditCard, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

interface DashboardStats {
  activeStudents: number;
  activeGroups: number;
  todaySessions: number;
  unrecordedAttendance: number;
  overduePayments: number;
  pendingMakeups: number;
}

export function ReceptionDashboard() {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    activeStudents: 0,
    activeGroups: 0,
    todaySessions: 0,
    unrecordedAttendance: 0,
    overduePayments: 0,
    pendingMakeups: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [studentsRes, groupsRes, sessionsRes, attendanceRes, subsRes, makeupRes] = await Promise.all([
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('groups').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('sessions').select('id, group_id').eq('session_date', today).eq('status', 'scheduled'),
        supabase.from('attendance').select('session_id').in('session_id',
          (await supabase.from('sessions').select('id').eq('session_date', today).eq('status', 'scheduled')).data?.map(s => s.id) || []
        ),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true })
          .eq('status', 'active')
          .lt('next_payment_date', today)
          .gt('remaining_amount', 0),
        supabase.from('makeup_sessions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      // Calculate unrecorded attendance
      const todaySessionIds = sessionsRes.data?.map(s => s.id) || [];
      const recordedSessionIds = new Set(attendanceRes.data?.map(a => a.session_id) || []);
      const unrecorded = todaySessionIds.filter(id => !recordedSessionIds.has(id)).length;

      setStats({
        activeStudents: studentsRes.count || 0,
        activeGroups: groupsRes.count || 0,
        todaySessions: sessionsRes.data?.length || 0,
        unrecordedAttendance: unrecorded,
        overduePayments: subsRes.count || 0,
        pendingMakeups: makeupRes.count || 0,
      });
    } catch (error) {
      console.error('Error fetching reception stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const cards = [
    {
      title: isRTL ? 'الطلاب النشطين' : 'Active Students',
      value: stats.activeStudents,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
      onClick: () => navigate('/students'),
    },
    {
      title: isRTL ? 'المجموعات النشطة' : 'Active Groups',
      value: stats.activeGroups,
      icon: Calendar,
      color: 'text-green-600',
      bg: 'bg-green-100',
      onClick: () => navigate('/groups'),
    },
    {
      title: isRTL ? 'جلسات اليوم' : "Today's Sessions",
      value: stats.todaySessions,
      icon: Clock,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
      onClick: () => navigate('/sessions'),
    },
    {
      title: isRTL ? 'حضور غير مسجل' : 'Unrecorded Attendance',
      value: stats.unrecordedAttendance,
      icon: AlertTriangle,
      color: stats.unrecordedAttendance > 0 ? 'text-orange-600' : 'text-green-600',
      bg: stats.unrecordedAttendance > 0 ? 'bg-orange-100' : 'bg-green-100',
      onClick: () => navigate('/sessions'),
    },
    {
      title: isRTL ? 'مدفوعات متأخرة' : 'Overdue Payments',
      value: stats.overduePayments,
      icon: CreditCard,
      color: stats.overduePayments > 0 ? 'text-red-600' : 'text-green-600',
      bg: stats.overduePayments > 0 ? 'bg-red-100' : 'bg-green-100',
      onClick: () => navigate('/finance'),
    },
    {
      title: isRTL ? 'تعويضات معلقة' : 'Pending Makeups',
      value: stats.pendingMakeups,
      icon: RefreshCw,
      color: stats.pendingMakeups > 0 ? 'text-amber-600' : 'text-green-600',
      bg: stats.pendingMakeups > 0 ? 'bg-amber-100' : 'bg-green-100',
      onClick: () => navigate('/makeup-sessions'),
    },
  ];

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Card
          key={card.title}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={card.onClick}
        >
          <CardContent className="p-3 sm:pt-6 sm:px-6 sm:pb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`p-1.5 sm:p-2 rounded-lg ${card.bg} flex-shrink-0`}>
                <card.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold">{loading ? '...' : card.value}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{card.title}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
