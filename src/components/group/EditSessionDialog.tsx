import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { notificationService } from '@/lib/notificationService';

interface EditSessionDialogProps {
  session: {
    id: string;
    session_date: string;
    session_time: string;
    status: string;
    session_number: number | null;
    group_id?: string;
  };
  groupId?: string;
  onUpdated: () => void;
}

export function EditSessionDialog({ session, groupId, onUpdated }: EditSessionDialogProps) {
  const { isRTL } = useLanguage();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionDate, setSessionDate] = useState(session.session_date);
  const [sessionTime, setSessionTime] = useState(session.session_time);
  const [status, setStatus] = useState(session.status);

  const handleSave = async () => {
    setLoading(true);
    try {
      const dateChanged = sessionDate !== session.session_date;
      const timeChanged = sessionTime !== session.session_time;
      
      const { error } = await supabase
        .from('sessions')
        .update({
          session_date: sessionDate,
          session_time: sessionTime,
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id);

      if (error) throw error;

      // If date or time changed, notify students
      if (dateChanged || timeChanged) {
        const gId = groupId || session.group_id;
        if (gId) {
          // Get group info for notification
          const { data: group } = await supabase
            .from('groups')
            .select('name, name_ar')
            .eq('id', gId)
            .single();

          if (group) {
            // Get all active students in this group
            const { data: groupStudents } = await supabase
              .from('group_students')
              .select('student_id')
              .eq('group_id', gId)
              .eq('is_active', true);

            if (groupStudents && groupStudents.length > 0) {
              const sessionName = `Session ${session.session_number}`;
              const sessionNameAr = `سيشن ${session.session_number}`;
              
              const notifications = groupStudents.map(gs => ({
                user_id: gs.student_id,
                title: 'Session Rescheduled',
                title_ar: 'تم تغيير موعد السيشن',
                message: `${sessionName} for "${group.name}" has been moved to ${sessionDate} at ${sessionTime}`,
                message_ar: `${sessionNameAr} لمجموعة "${group.name_ar}" تم نقلها إلى ${sessionDate} الساعة ${sessionTime}`,
                type: 'warning',
                category: 'session',
                action_url: `/groups/${gId}`
              }));

              await supabase.from('notifications').insert(notifications);
            }
          }
        }
      }

      toast.success(isRTL ? 'تم تحديث الجلسة' : 'Session updated');
      onUpdated();
      setOpen(false);
    } catch (error: any) {
      console.error('Update error:', error);
      toast.error(isRTL ? 'فشل في التحديث' : 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isRTL ? `تعديل سيشن ${session.session_number}` : `Edit Session ${session.session_number}`}
          </DialogTitle>
          <DialogDescription>
            {isRTL ? 'تعديل تاريخ ووقت وحالة الجلسة' : 'Edit session date, time, and status'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{isRTL ? 'التاريخ' : 'Date'}</Label>
            <Input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{isRTL ? 'الوقت' : 'Time'}</Label>
            <Input
              type="time"
              value={sessionTime}
              onChange={(e) => setSessionTime(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{isRTL ? 'الحالة' : 'Status'}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">
                  {isRTL ? 'مجدولة' : 'Scheduled'}
                </SelectItem>
                <SelectItem value="completed">
                  {isRTL ? 'مكتملة' : 'Completed'}
                </SelectItem>
                <SelectItem value="cancelled">
                  {isRTL ? 'ملغية' : 'Cancelled'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {isRTL ? 'حفظ' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
