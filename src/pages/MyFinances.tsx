import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PaymentsHistory } from '@/components/student/PaymentsHistory';
import { DollarSign } from 'lucide-react';

export default function MyFinances() {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchData = async () => {
      const [subRes, attRes] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('*, pricing_plans(name, name_ar, attendance_mode)')
          .eq('student_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('attendance')
          .select('*, sessions(session_date, session_time, session_number)')
          .eq('student_id', user.id)
          .order('recorded_at', { ascending: false })
          .limit(50),
      ]);

      setSubscription(subRes.data);
      setAttendance(attRes.data || []);
      setLoading(false);
    };

    fetchData();
  }, [user?.id]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            {isRTL ? 'حسابي المالي' : 'My Finances'}
          </h1>
          <p className="text-muted-foreground">
            {isRTL ? 'ملخص الاشتراك والدفعات والمستحقات' : 'Subscription summary, payments and receivables'}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <PaymentsHistory
            studentId={user!.id}
            subscription={subscription}
            attendance={attendance}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
