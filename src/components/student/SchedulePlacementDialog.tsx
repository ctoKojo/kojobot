import { useEffect, useState } from 'react';
import { CalendarDays, Clock } from 'lucide-react';
import { fromZonedTime } from 'date-fns-tz';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { APP_TIMEZONE } from '@/lib/constants';
import { getCairoToday } from '@/lib/timeUtils';

interface SchedulePlacementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  onScheduled?: () => void;
}

export function SchedulePlacementDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  onScheduled,
}: SchedulePlacementDialogProps) {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setDate(prev => prev || getCairoToday());
  }, [open]);

  const handleSchedule = async () => {
    if (!date || !startTime || !endTime) {
      toast({
        title: isRTL ? 'بيانات ناقصة' : 'Missing fields',
        description: isRTL ? 'يرجى تحديد التاريخ ووقت البداية والنهاية' : 'Please fill date, start time and end time',
        variant: 'destructive',
      });
      return;
    }

    const [y, m, d] = date.split('-').map(Number);
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);

    if ([y, m, d, sh, sm, eh, em].some(n => Number.isNaN(n))) {
      toast({
        title: isRTL ? 'خطأ في البيانات' : 'Invalid input',
        description: isRTL ? 'تأكد من إدخال التاريخ والوقت بشكل صحيح' : 'Please ensure date and time are valid',
        variant: 'destructive',
      });
      return;
    }

    const opensAt = fromZonedTime(new Date(y, m - 1, d, sh, sm, 0), APP_TIMEZONE);
    const closesAt = fromZonedTime(new Date(y, m - 1, d, eh, em, 0), APP_TIMEZONE);

    const nowUtc = new Date();

    if (opensAt <= nowUtc) {
      toast({
        title: isRTL ? 'وقت البداية في الماضي' : 'Start time is in the past',
        description: isRTL ? 'لا يمكن جدولة امتحان يبدأ قبل الوقت الحالي (بتوقيت القاهرة)' : 'Cannot schedule an exam that starts before the current time (Cairo time)',
        variant: 'destructive',
      });
      return;
    }

    if (closesAt <= opensAt) {
      toast({
        title: isRTL ? 'خطأ في الوقت' : 'Invalid time',
        description: isRTL ? 'وقت النهاية يجب أن يكون بعد وقت البداية' : 'End time must be after start time',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Cancel any existing active v2 schedules
      await supabase
        .from('placement_v2_schedules')
        .update({ status: 'expired' } as any)
        .eq('student_id', studentId)
        .in('status', ['scheduled', 'open']);

      // Create new v2 schedule
      const { error } = await supabase
        .from('placement_v2_schedules')
        .insert({
          student_id: studentId,
          scheduled_by: user!.id,
          opens_at: opensAt.toISOString(),
          closes_at: closesAt.toISOString(),
          notes: notes || null,
          status: 'scheduled',
        } as any);

      if (error) throw error;

      toast({
        title: isRTL ? 'تم جدولة الامتحان' : 'Exam Scheduled',
        description: isRTL
          ? `تم تحديد موعد امتحان تحديد المستوى لـ ${studentName}`
          : `Placement exam scheduled for ${studentName}`,
      });
      onOpenChange(false);
      onScheduled?.();
    } catch (err: any) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {isRTL ? 'جدولة امتحان تحديد المستوى' : 'Schedule Placement Exam'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            {isRTL ? `تحديد موعد امتحان لـ: ${studentName}` : `Scheduling exam for: ${studentName}`}
          </p>

          <div className="space-y-2">
            <Label>{isRTL ? 'التاريخ (بتوقيت القاهرة)' : 'Date (Cairo time)'}</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              {isRTL ? 'كل المواعيد يتم حفظها وتطبيقها بتوقيت القاهرة' : 'All schedules are saved and enforced in Cairo time'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {isRTL ? 'وقت البداية' : 'Start Time'}
              </Label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {isRTL ? 'وقت النهاية' : 'End Time'}
              </Label>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{isRTL ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={isRTL ? 'مثال: تأكد من وجود اتصال إنترنت مستقر' : 'e.g., Ensure stable internet connection'}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={handleSchedule} disabled={loading}>
            {loading
              ? (isRTL ? 'جارٍ الجدولة...' : 'Scheduling...')
              : (isRTL ? 'تأكيد الموعد' : 'Confirm Schedule')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
