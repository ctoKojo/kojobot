import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';

interface ScheduleData {
  day_of_week: string;
  is_working_day: boolean;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  notes_ar: string | null;
}

interface ScheduleEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayOfWeek: string | null;
  schedule: {
    is_working_day: boolean;
    start_time: string | null;
    end_time: string | null;
    notes: string | null;
    notes_ar: string | null;
  } | null;
  onSave: (data: ScheduleData) => Promise<void>;
}

const DAY_NAMES: Record<string, { en: string; ar: string }> = {
  Sunday: { en: 'Sunday', ar: 'الأحد' },
  Monday: { en: 'Monday', ar: 'الإثنين' },
  Tuesday: { en: 'Tuesday', ar: 'الثلاثاء' },
  Wednesday: { en: 'Wednesday', ar: 'الأربعاء' },
  Thursday: { en: 'Thursday', ar: 'الخميس' },
  Friday: { en: 'Friday', ar: 'الجمعة' },
  Saturday: { en: 'Saturday', ar: 'السبت' },
};

export function ScheduleEditDialog({
  open,
  onOpenChange,
  dayOfWeek,
  schedule,
  onSave,
}: ScheduleEditDialogProps) {
  const { t, isRTL, language } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [isWorkingDay, setIsWorkingDay] = useState(true);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [notes, setNotes] = useState('');
  const [notesAr, setNotesAr] = useState('');

  useEffect(() => {
    if (schedule) {
      setIsWorkingDay(schedule.is_working_day);
      setStartTime(schedule.start_time || '09:00');
      setEndTime(schedule.end_time || '17:00');
      setNotes(schedule.notes || '');
      setNotesAr(schedule.notes_ar || '');
    } else {
      setIsWorkingDay(true);
      setStartTime('09:00');
      setEndTime('17:00');
      setNotes('');
      setNotesAr('');
    }
  }, [schedule, open]);

  const handleSave = async () => {
    if (!dayOfWeek) return;
    
    setSaving(true);
    try {
      await onSave({
        day_of_week: dayOfWeek,
        is_working_day: isWorkingDay,
        start_time: isWorkingDay ? startTime : null,
        end_time: isWorkingDay ? endTime : null,
        notes: notes || null,
        notes_ar: notesAr || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const dayName = dayOfWeek
    ? (language === 'ar' ? DAY_NAMES[dayOfWeek]?.ar : DAY_NAMES[dayOfWeek]?.en) || dayOfWeek
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isRTL ? `تعديل جدول يوم ${dayName}` : `Edit ${dayName} Schedule`}
          </DialogTitle>
          <DialogDescription>
            {isRTL ? 'حدد ساعات العمل لهذا اليوم' : 'Set working hours for this day'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Working Day Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="working-day">
              {isRTL ? 'يوم عمل' : 'Working Day'}
            </Label>
            <Switch
              id="working-day"
              checked={isWorkingDay}
              onCheckedChange={setIsWorkingDay}
            />
          </div>

          {isWorkingDay && (
            <>
              {/* Time Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-time">
                    {isRTL ? 'وقت البداية' : 'Start Time'}
                  </Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time">
                    {isRTL ? 'وقت النهاية' : 'End Time'}
                  </Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">
                  {isRTL ? 'ملاحظات (English)' : 'Notes (English)'}
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isRTL ? 'ملاحظات اختيارية...' : 'Optional notes...'}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes-ar">
                  {isRTL ? 'ملاحظات (عربي)' : 'Notes (Arabic)'}
                </Label>
                <Textarea
                  id="notes-ar"
                  value={notesAr}
                  onChange={(e) => setNotesAr(e.target.value)}
                  placeholder="ملاحظات اختيارية..."
                  rows={2}
                  dir="rtl"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t.common.cancel}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
