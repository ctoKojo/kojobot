import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface IssueEmployeeWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  onSuccess?: () => void;
}

const warningTypes = [
  { value: 'behavior', labelEn: 'Behavior', labelAr: 'سلوك' },
  { value: 'non_compliance', labelEn: 'Non-Compliance', labelAr: 'عدم التزام' },
  { value: 'poor_performance', labelEn: 'Poor Performance', labelAr: 'أداء ضعيف' },
  { value: 'attendance', labelEn: 'Attendance', labelAr: 'حضور' },
  { value: 'late_submission', labelEn: 'Late Submission', labelAr: 'تأخر في التسليم' },
  { value: 'no_reply', labelEn: 'No Reply to Student', labelAr: 'عدم الرد على الطالب' },
  { value: 'late_grading', labelEn: 'Late Grading', labelAr: 'تأخر في التقييم' },
  { value: 'other', labelEn: 'Other', labelAr: 'أخرى' },
];

const severityOptions = [
  { value: 'minor', labelEn: 'Minor', labelAr: 'بسيط' },
  { value: 'major', labelEn: 'Major', labelAr: 'متوسط' },
  { value: 'critical', labelEn: 'Critical', labelAr: 'حرج' },
];

export function IssueEmployeeWarningDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  onSuccess,
}: IssueEmployeeWarningDialogProps) {
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [warningType, setWarningType] = useState('');
  const [severity, setSeverity] = useState('minor');
  const [reason, setReason] = useState('');
  const [reasonAr, setReasonAr] = useState('');

  const handleSubmit = async () => {
    if (!warningType || !reason.trim()) {
      toast.error(isRTL ? 'الرجاء ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('instructor_warnings').insert({
        instructor_id: employeeId,
        issued_by: user!.id,
        warning_type: warningType,
        severity,
        reason: reason.trim(),
        reason_ar: reasonAr.trim() || reason.trim(),
        is_active: true,
      });

      if (error) throw error;

      // Send notification to the employee
      await supabase.from('notifications').insert({
        user_id: employeeId,
        type: 'warning',
        category: 'warning',
        title: 'New Warning',
        title_ar: 'إنذار جديد',
        message: `You have received a ${severity} warning: ${reason.trim()}`,
        message_ar: `لقد تلقيت إنذارًا (${severity === 'minor' ? 'بسيط' : severity === 'major' ? 'متوسط' : 'حرج'}): ${reasonAr.trim() || reason.trim()}`,
        action_url: '/my-instructor-warnings',
      });

      // Notify admins on Telegram
      try {
        const { notifyAdmins } = await import('@/lib/notifyAdmins');
        notifyAdmins({
          eventKey: 'admin-employee-warning',
          templateData: {
            employeeName,
            warningType,
            severity,
            reason: reasonAr.trim() || reason.trim(),
            issuedBy: user?.email || '—',
          },
          idempotencyKey: `emp-warning-${employeeId}-${Date.now()}`,
        });
      } catch (e) { console.warn('notifyAdmins failed', e); }

      toast.success(isRTL ? 'تم إصدار الإنذار بنجاح' : 'Warning issued successfully');
      onOpenChange(false);
      setWarningType('');
      setSeverity('minor');
      setReason('');
      setReasonAr('');
      onSuccess?.();
    } catch (error) {
      console.error('Error issuing warning:', error);
      toast.error(isRTL ? 'حدث خطأ أثناء إصدار الإنذار' : 'Error issuing warning');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            {isRTL ? 'إصدار إنذار' : 'Issue Warning'}
          </DialogTitle>
          <DialogDescription>
            {isRTL
              ? `إصدار إنذار للموظف: ${employeeName}`
              : `Issue a warning to employee: ${employeeName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{isRTL ? 'نوع الإنذار' : 'Warning Type'} *</Label>
            <Select value={warningType} onValueChange={setWarningType}>
              <SelectTrigger>
                <SelectValue placeholder={isRTL ? 'اختر نوع الإنذار' : 'Select warning type'} />
              </SelectTrigger>
              <SelectContent>
                {warningTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {language === 'ar' ? type.labelAr : type.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{isRTL ? 'درجة الخطورة' : 'Severity'} *</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {severityOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {language === 'ar' ? opt.labelAr : opt.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{isRTL ? 'السبب بالإنجليزية' : 'Reason (English)'} *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isRTL ? 'اكتب سبب الإنذار بالإنجليزية...' : 'Enter warning reason in English...'}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>{isRTL ? 'السبب بالعربية' : 'Reason (Arabic)'}</Label>
            <Textarea
              value={reasonAr}
              onChange={(e) => setReasonAr(e.target.value)}
              placeholder={isRTL ? 'اكتب سبب الإنذار بالعربية...' : 'Enter warning reason in Arabic...'}
              rows={3}
              dir="rtl"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-warning text-warning-foreground hover:bg-warning/90">
            {loading
              ? (isRTL ? 'جاري الإصدار...' : 'Issuing...')
              : (isRTL ? 'إصدار الإنذار' : 'Issue Warning')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
