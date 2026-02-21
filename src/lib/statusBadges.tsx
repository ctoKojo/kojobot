// ============================================================
// SINGLE SOURCE OF TRUTH - Status Badge Rendering
// All status badge logic is centralized here.
// Import these functions instead of defining locally.
// ============================================================

import { Badge } from '@/components/ui/badge';

// --- Session Status ---
export function getSessionStatusBadge(status: string, language: string) {
  const isRTL = language === 'ar';
  const styles: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };
  const labels: Record<string, { en: string; ar: string }> = {
    scheduled: { en: 'Scheduled', ar: 'مجدول' },
    completed: { en: 'Completed', ar: 'مكتمل' },
    cancelled: { en: 'Cancelled', ar: 'ملغي' },
  };
  return (
    <Badge className={styles[status] || styles.scheduled}>
      {labels[status]?.[isRTL ? 'ar' : 'en'] || status}
    </Badge>
  );
}

// --- Makeup Session Status ---
export function getMakeupStatusBadge(status: string, isRTL: boolean) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    expired: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  };
  const labels: Record<string, string> = {
    pending: isRTL ? 'معلق' : 'Pending',
    scheduled: isRTL ? 'مجدول' : 'Scheduled',
    completed: isRTL ? 'مكتمل' : 'Completed',
    cancelled: isRTL ? 'ملغي' : 'Cancelled',
    expired: isRTL ? 'منتهي' : 'Expired',
  };
  return <Badge className={styles[status] || ''}>{labels[status] || status}</Badge>;
}

// --- Group Status ---
export function getGroupStatusBadge(
  hasStarted: boolean, 
  status: string, 
  isRTL: boolean
): { className: string; label: string } {
  if (!hasStarted) {
    return { 
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', 
      label: isRTL ? 'لم تبدأ' : 'Not Started' 
    };
  }
  if (status === 'frozen') {
    return { 
      className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400', 
      label: isRTL ? 'مجمدة' : 'Frozen' 
    };
  }
  return { 
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', 
    label: isRTL ? 'نشطة' : 'Active' 
  };
}

// --- Quiz Submission Status ---
export function getQuizSubmissionStatusBadge(
  status: string, 
  percentage: number | null, 
  passingScore: number,
  isRTL: boolean
) {
  if (status === 'not_started') {
    return <Badge variant="outline" className="text-muted-foreground">{isRTL ? 'لم يبدأ' : 'Not Started'}</Badge>;
  }
  if (status === 'in_progress') {
    return <Badge variant="outline">{isRTL ? 'جاري' : 'In Progress'}</Badge>;
  }
  if (status === 'graded' || status === 'submitted') {
    if (percentage !== null && percentage >= passingScore) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{isRTL ? 'ناجح' : 'Passed'}</Badge>;
    }
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">{isRTL ? 'راسب' : 'Failed'}</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}

// --- Assignment Submission Status ---
export function getAssignmentSubmissionStatusBadge(status: string, isRTL: boolean) {
  const config: Record<string, { className: string; label: string }> = {
    not_submitted: { 
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300', 
      label: isRTL ? 'لم يسلم' : 'Not Submitted' 
    },
    submitted: { 
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', 
      label: isRTL ? 'تم التسليم' : 'Submitted' 
    },
    graded: { 
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', 
      label: isRTL ? 'تم التقييم' : 'Graded' 
    },
    revision_requested: { 
      className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', 
      label: isRTL ? 'مطلوب تعديل' : 'Revision Requested' 
    },
  };
  const c = config[status] || { className: '', label: status };
  return <Badge className={c.className}>{c.label}</Badge>;
}

// --- Salary Month Status ---
export function getSalaryMonthStatusBadge(
  snapshot: { status: string } | undefined, 
  isRTL: boolean
) {
  if (!snapshot) {
    return <Badge variant="outline" className="text-muted-foreground">{isRTL ? 'بدون حركات' : 'No events'}</Badge>;
  }
  switch (snapshot.status) {
    case 'finalized':
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{isRTL ? 'نهائي' : 'Finalized'}</Badge>;
    case 'draft':
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">{isRTL ? 'مسودة' : 'Draft'}</Badge>;
    default:
      return <Badge variant="outline">{snapshot.status}</Badge>;
  }
}
