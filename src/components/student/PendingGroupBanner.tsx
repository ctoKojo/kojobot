import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus } from 'lucide-react';

interface PendingGroupBannerProps {
  studentId: string;
  isRTL: boolean;
}

export function PendingGroupBanner({ studentId, isRTL }: PendingGroupBannerProps) {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase
        .from('group_student_progress')
        .select('id')
        .eq('student_id', studentId)
        .eq('status', 'pending_group_assignment')
        .limit(1)
        .maybeSingle();
      setPending(!!data);
    };
    check();
  }, [studentId]);

  if (!pending) return null;

  return (
    <Card className="border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
      <CardContent className="py-4 sm:py-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
            <UserPlus className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-bold text-blue-800 dark:text-blue-300">
              {isRTL ? '🎓 تم ترقيتك!' : '🎓 You have been promoted!'}
            </h2>
            <p className="text-sm sm:text-base text-blue-700 dark:text-blue-400">
              {isRTL 
                ? 'الإدارة هتعينك في جروب جديد قريباً. تواصل معنا لو عندك أي استفسار.'
                : 'Administration will assign you to a new group soon. Contact us if you have any questions.'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
