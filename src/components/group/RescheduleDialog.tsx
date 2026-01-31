import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RescheduleDialogProps {
  groupId: string;
  scheduleDay: string;
  scheduleTime: string;
  onRescheduled: () => void;
}

export function RescheduleDialog({ 
  groupId, 
  scheduleDay, 
  scheduleTime, 
  onRescheduled 
}: RescheduleDialogProps) {
  const { isRTL, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const getDayName = (day: string) => {
    const days: { [key: string]: { en: string; ar: string } } = {
      Sunday: { en: 'Sunday', ar: 'الأحد' },
      Monday: { en: 'Monday', ar: 'الاثنين' },
      Tuesday: { en: 'Tuesday', ar: 'الثلاثاء' },
      Wednesday: { en: 'Wednesday', ar: 'الأربعاء' },
      Thursday: { en: 'Thursday', ar: 'الخميس' },
      Friday: { en: 'Friday', ar: 'الجمعة' },
      Saturday: { en: 'Saturday', ar: 'السبت' },
    };
    return language === 'ar' ? days[day]?.ar || day : days[day]?.en || day;
  };

  const handleReschedule = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('reschedule-sessions', {
        body: { group_id: groupId }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(
          isRTL 
            ? `تم إعادة جدولة ${data.updated} جلسة بنجاح` 
            : `Successfully rescheduled ${data.updated} sessions`
        );
        onRescheduled();
        setOpen(false);
      } else {
        throw new Error(data.error || 'Failed to reschedule');
      }
    } catch (error: any) {
      console.error('Reschedule error:', error);
      toast.error(
        isRTL 
          ? 'فشل في إعادة الجدولة' 
          : 'Failed to reschedule sessions'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {isRTL ? 'إعادة جدولة السيشنات' : 'Reschedule Sessions'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isRTL ? 'إعادة جدولة السيشنات المستقبلية' : 'Reschedule Future Sessions'}
          </DialogTitle>
          <DialogDescription>
            {isRTL 
              ? 'سيتم تحديث تواريخ السيشنات المستقبلية (المجدولة فقط) بناءً على الجدول الحالي للمجموعة. السيشنات المكتملة لن تتأثر.'
              : 'Future scheduled sessions will be updated based on the current group schedule. Completed sessions will not be affected.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-3">
          <div className="p-4 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground mb-2">
              {isRTL ? 'الجدول الحالي:' : 'Current Schedule:'}
            </p>
            <div className="flex gap-4 font-medium">
              <span>{getDayName(scheduleDay)}</span>
              <span>{scheduleTime}</span>
            </div>
          </div>
          
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            {isRTL 
              ? '⚠️ سيتم حساب التواريخ الجديدة من أقرب يوم مطابق للجدول'
              : '⚠️ New dates will be calculated from the next matching day'
            }
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={handleReschedule} disabled={loading}>
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {isRTL ? 'تأكيد إعادة الجدولة' : 'Confirm Reschedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
