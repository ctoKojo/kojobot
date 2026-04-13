import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PaymentsHistory } from '@/components/student/PaymentsHistory';
import { DollarSign } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function MyFinances() {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchData = async () => {
      // Get linked students
      const { data: links } = await supabase
        .from('parent_students')
        .select('student_id')
        .eq('parent_id', user.id);

      if (!links?.length) {
        setLoading(false);
        return;
      }

      const studentIds = links.map(l => l.student_id);

      // Fetch profiles, subscriptions, and attendance for all students
      const [profilesRes, subsRes, attRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, full_name_ar').in('user_id', studentIds),
        supabase
          .from('subscriptions')
          .select('*, pricing_plans(name, name_ar, attendance_mode)')
          .in('student_id', studentIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('attendance')
          .select('*, sessions(session_date, session_time, session_number)')
          .in('student_id', studentIds)
          .order('recorded_at', { ascending: false })
          .limit(200),
      ]);

      const profiles = profilesRes.data || [];
      const allSubs = subsRes.data || [];
      const allAtt = attRes.data || [];

      const enriched = studentIds.map(sid => {
        const profile = profiles.find(p => p.user_id === sid);
        const sub = allSubs.find(s => s.student_id === sid);
        const att = allAtt.filter(a => a.student_id === sid);
        return {
          student_id: sid,
          name: isRTL ? profile?.full_name_ar || profile?.full_name : profile?.full_name,
          subscription: sub || null,
          attendance: att,
        };
      });

      setStudents(enriched);
      setLoading(false);
    };

    fetchData();
  }, [user?.id, isRTL]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
            <DollarSign className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{isRTL ? 'الحساب المالي' : 'Finances'}</h1>
            <p className="text-sm text-muted-foreground">{isRTL ? 'ملخص الاشتراكات والدفعات لأبنائك' : 'Subscription summary and payments for your children'}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : students.length === 0 ? (
          <div className="text-center text-muted-foreground py-16">
            {isRTL ? 'لا يوجد طلاب مربوطين' : 'No linked students'}
          </div>
        ) : students.length === 1 ? (
          <PaymentsHistory
            studentId={students[0].student_id}
            subscription={students[0].subscription}
            attendance={students[0].attendance}
          />
        ) : (
          <Tabs defaultValue={students[0]?.student_id} dir={isRTL ? 'rtl' : 'ltr'}>
            <TabsList className="w-full flex-wrap h-auto gap-1">
              {students.map(s => (
                <TabsTrigger key={s.student_id} value={s.student_id} className="text-sm">
                  {s.name || (isRTL ? 'طالب' : 'Student')}
                </TabsTrigger>
              ))}
            </TabsList>
            {students.map(s => (
              <TabsContent key={s.student_id} value={s.student_id} className="mt-4">
                <PaymentsHistory
                  studentId={s.student_id}
                  subscription={s.subscription}
                  attendance={s.attendance}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
