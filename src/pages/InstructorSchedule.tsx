import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { WeeklyScheduleGrid } from '@/components/schedule/WeeklyScheduleGrid';
import { ScheduleEditDialog } from '@/components/schedule/ScheduleEditDialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface InstructorSchedule {
  id: string;
  instructor_id: string;
  day_of_week: string;
  is_working_day: boolean;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  notes_ar: string | null;
}

interface Group {
  id: string;
  name: string;
  name_ar: string;
  schedule_day: string;
  schedule_time: string;
  duration_minutes: number;
}

interface InstructorProfile {
  full_name: string;
  full_name_ar: string | null;
  role?: 'instructor' | 'reception';
}

export default function InstructorSchedulePage() {
  const { instructorId } = useParams<{ instructorId: string }>();
  const navigate = useNavigate();
  const { t, isRTL, language } = useLanguage();
  const { role, user } = useAuth();
  const { toast } = useToast();
  
  const [schedules, setSchedules] = useState<InstructorSchedule[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [instructor, setInstructor] = useState<InstructorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingDay, setEditingDay] = useState<string | null>(null);

  // Determine which instructor/employee to show
  const targetInstructorId = (role === 'instructor' || role === 'reception') ? user?.id : instructorId;

  useEffect(() => {
    if (targetInstructorId) {
      fetchData();
    }
  }, [targetInstructorId]);

  const fetchData = async () => {
    if (!targetInstructorId) return;
    
    setLoading(true);
    try {
      // Fetch instructor profile and role
      const [profileRes, roleRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, full_name_ar')
          .eq('user_id', targetInstructorId)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', targetInstructorId)
          .in('role', ['instructor', 'reception'])
          .maybeSingle(),
      ]);

      if (profileRes.error) throw profileRes.error;
      setInstructor(profileRes.data ? {
        ...profileRes.data,
        role: (roleRes.data?.role as 'instructor' | 'reception') || 'instructor',
      } : null);

      // Fetch schedules
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('instructor_schedules')
        .select('*')
        .eq('instructor_id', targetInstructorId);

      if (scheduleError) throw scheduleError;
      setSchedules(scheduleData || []);

      // Fetch groups assigned to this instructor
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('id, name, name_ar, schedule_day, schedule_time, duration_minutes')
        .eq('instructor_id', targetInstructorId)
        .eq('is_active', true);

      if (groupsError) throw groupsError;
      setGroups(groupsData || []);
    } catch (error) {
      console.error('Error fetching schedule data:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في تحميل جدول العمل' : 'Failed to load schedule',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditDay = (dayOfWeek: string) => {
    if (role !== 'admin') return;
    setEditingDay(dayOfWeek);
    setEditDialogOpen(true);
  };

  const DAY_NAMES_AR: Record<string, string> = {
    Sunday: 'الأحد',
    Monday: 'الإثنين',
    Tuesday: 'الثلاثاء',
    Wednesday: 'الأربعاء',
    Thursday: 'الخميس',
    Friday: 'الجمعة',
    Saturday: 'السبت',
  };

  const sendScheduleNotification = async (dayOfWeek: string, isWorkingDay: boolean) => {
    if (!targetInstructorId || role !== 'admin') return;

    try {
      const dayNameAr = DAY_NAMES_AR[dayOfWeek] || dayOfWeek;
      const statusEn = isWorkingDay ? 'working day' : 'day off';
      const statusAr = isWorkingDay ? 'يوم عمل' : 'يوم إجازة';

      await supabase.functions.invoke('send-notification', {
        body: {
          user_id: targetInstructorId,
          title: 'Schedule Updated',
          title_ar: 'تحديث جدول العمل',
          message: `Your ${dayOfWeek} schedule has been updated to ${statusEn} by the admin.`,
          message_ar: `تم تحديث جدول يوم ${dayNameAr} إلى ${statusAr} من قبل المدير.`,
          type: 'info',
          category: 'schedule',
          action_url: '/instructor-schedule',
        },
      });
      console.log('Schedule notification sent to instructor');
    } catch (error) {
      console.error('Failed to send schedule notification:', error);
    }
  };

  const handleSaveSchedule = async (data: {
    day_of_week: string;
    is_working_day: boolean;
    start_time: string | null;
    end_time: string | null;
    notes: string | null;
    notes_ar: string | null;
  }) => {
    if (!targetInstructorId) return;

    try {
      const existingSchedule = schedules.find(s => s.day_of_week === data.day_of_week);

      if (existingSchedule) {
        const { error } = await supabase
          .from('instructor_schedules')
          .update({
            is_working_day: data.is_working_day,
            start_time: data.start_time,
            end_time: data.end_time,
            notes: data.notes,
            notes_ar: data.notes_ar,
          })
          .eq('id', existingSchedule.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('instructor_schedules')
          .insert({
            instructor_id: targetInstructorId,
            day_of_week: data.day_of_week,
            is_working_day: data.is_working_day,
            start_time: data.start_time,
            end_time: data.end_time,
            notes: data.notes,
            notes_ar: data.notes_ar,
          });

        if (error) throw error;
      }

      // Send notification to instructor
      await sendScheduleNotification(data.day_of_week, data.is_working_day);

      toast({
        title: t.common.success,
        description: isRTL ? 'تم حفظ جدول العمل' : 'Schedule saved successfully',
      });

      setEditDialogOpen(false);
      setEditingDay(null);
      fetchData();
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في حفظ جدول العمل' : 'Failed to save schedule',
      });
    }
  };

  const isReception = instructor?.role === 'reception';
  const instructorName = instructor
    ? (language === 'ar' && instructor.full_name_ar ? instructor.full_name_ar : instructor.full_name)
    : '';

  const pageTitle = isRTL
    ? `جدول العمل${instructorName ? `: ${instructorName}` : ''}`
    : `Work Schedule${instructorName ? `: ${instructorName}` : ''}`;

  const currentSchedule = editingDay
    ? schedules.find(s => s.day_of_week === editingDay)
    : null;

  return (
    <DashboardLayout title={pageTitle}>
      <div className="space-y-6">
        {/* Header */}
        {role === 'admin' && (
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <p className="text-muted-foreground text-sm">
              {isRTL ? 'انقر على أي يوم لتعديل ساعات العمل' : 'Click on any day to edit working hours'}
            </p>
          </div>
        )}

        {/* Schedule Grid */}
        <WeeklyScheduleGrid
          schedules={schedules}
          groups={groups}
          loading={loading}
          isAdmin={role === 'admin'}
          onEditDay={handleEditDay}
          showGroups={!isReception}
        />

        {/* Edit Dialog */}
        <ScheduleEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          dayOfWeek={editingDay}
          schedule={currentSchedule}
          onSave={handleSaveSchedule}
        />
      </div>
    </DashboardLayout>
  );
}
