import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface TerminateEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  onSuccess: () => void;
}

export function TerminateEmployeeDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  onSuccess,
}: TerminateEmployeeDialogProps) {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [reasonAr, setReasonAr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTerminate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('terminate-employee', {
        body: {
          employee_id: employeeId,
          reason: reason || undefined,
          reason_ar: reasonAr || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(isRTL && data.error_ar ? data.error_ar : data.error);

      toast({
        title: isRTL ? 'تم إنهاء التعاقد' : 'Contract Terminated',
        description: isRTL
          ? `تم إنهاء تعاقد ${employeeName} بنجاح`
          : `${employeeName}'s contract has been terminated successfully`,
      });

      setReason('');
      setReasonAr('');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error terminating employee:', error);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Error',
        description: error.message || (isRTL ? 'فشل في إنهاء التعاقد' : 'Failed to terminate contract'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {isRTL ? 'إنهاء تعاقد موظف' : 'Terminate Employee Contract'}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-start">
            {isRTL
              ? `هل أنت متأكد من إنهاء تعاقد "${employeeName}"؟ هذا سيؤدي إلى:`
              : `Are you sure you want to terminate "${employeeName}"'s contract? This will:`}
            <ul className="list-disc mt-2 space-y-1 mx-4">
              <li>{isRTL ? 'تعطيل حساب الموظف (لن يتمكن من تسجيل الدخول)' : 'Disable employee account (cannot login)'}</li>
              <li>{isRTL ? 'إزالته من جميع المجموعات المسندة إليه' : 'Remove from all assigned groups'}</li>
              <li>{isRTL ? 'قفل الشهر المالي الحالي وتسوية المستحقات' : 'Lock current financial month and settle dues'}</li>
              <li>{isRTL ? 'إلغاء تفعيل الراتب' : 'Deactivate salary'}</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label>{isRTL ? 'سبب الإنهاء (إنجليزي)' : 'Termination Reason (English)'}</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isRTL ? 'اختياري...' : 'Optional...'}
              rows={2}
            />
          </div>
          <div className="grid gap-2">
            <Label>{isRTL ? 'سبب الإنهاء (عربي)' : 'Termination Reason (Arabic)'}</Label>
            <Textarea
              value={reasonAr}
              onChange={(e) => setReasonAr(e.target.value)}
              placeholder="اختياري..."
              dir="rtl"
              rows={2}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button variant="destructive" onClick={handleTerminate} disabled={loading}>
            {loading
              ? (isRTL ? 'جاري الإنهاء...' : 'Terminating...')
              : (isRTL ? 'تأكيد الإنهاء' : 'Confirm Termination')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
