/**
 * DeleteStudentDialog — confirmation + edge-function call.
 *
 * 🚧 PILOT-PHASE NOTE: Direct edge-function invocation will move to a
 * dedicated `deleteUserService` in a follow-up. Tracked in ARCHITECTURE.md.
 */
// eslint-disable-next-line no-restricted-imports
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { StudentListItem } from '../types';

interface DeleteStudentDialogProps {
  target: StudentListItem | null;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteStudentDialog({ target, onClose, onDeleted }: DeleteStudentDialogProps) {
  const { isRTL, t } = useLanguage();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!target) return;
    setDeleting(true);
    try {
      const studentName = target.full_name_ar || target.full_name;
      const { data, error } = await supabase.functions.invoke('delete-users', {
        body: { user_id: target.user_id },
      });
      if (error) throw error;
      if (data?.error) throw { error: data.error, error_ar: data.error_ar };

      // Notify admins on Telegram
      const { notifyAdmins } = await import('@/lib/notifyAdmins');
      const { data: { user } } = await supabase.auth.getUser();
      notifyAdmins({
        eventKey: 'admin-student-deleted',
        templateData: { studentName, deletedBy: user?.email || '—' },
        idempotencyKey: `student-deleted-${target.user_id}`,
      }).catch(() => {});

      toast({
        title: t.common.success,
        description: isRTL ? 'تم حذف الطالب بنجاح' : 'Student deleted successfully',
      });
      onDeleted();
      onClose();
    } catch (err: unknown) {
      const e = err as { error?: string; error_ar?: string };
      const msg = (isRTL && e?.error_ar) ? e.error_ar : e?.error ?? (isRTL ? 'فشل الحذف' : 'Failed to delete');
      toast({ variant: 'destructive', title: t.common.error, description: msg });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isRTL ? 'تأكيد حذف الطالب' : 'Confirm Delete Student'}</AlertDialogTitle>
          <AlertDialogDescription>
            {isRTL
              ? `هل أنت متأكد من حذف "${target?.full_name_ar || target?.full_name}"؟ سيتم حذف جميع البيانات المرتبطة.`
              : `Delete "${target?.full_name}"? All related data will be permanently removed.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? (isRTL ? 'جاري الحذف...' : 'Deleting...') : (isRTL ? 'حذف' : 'Delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
