import { supabase } from '@/integrations/supabase/client';

interface NotificationData {
  user_id: string;
  title: string;
  title_ar: string;
  message: string;
  message_ar: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  category?: string;
  action_url?: string;
}

export const notificationService = {
  // Create a single notification
  async create(data: NotificationData) {
    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: data.user_id,
        title: data.title,
        title_ar: data.title_ar,
        message: data.message,
        message_ar: data.message_ar,
        type: data.type || 'info',
        category: data.category || 'general',
        action_url: data.action_url,
      });
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error creating notification:', error);
      return false;
    }
  },

  // Notify when a quiz is assigned
  async notifyQuizAssigned(studentId: string, quizTitle: string, quizTitleAr: string, dueDate?: string) {
    return this.create({
      user_id: studentId,
      title: 'New Quiz Assigned',
      title_ar: 'كويز جديد',
      message: `You have been assigned a new quiz: "${quizTitle}"${dueDate ? ` - Due: ${dueDate}` : ''}`,
      message_ar: `تم إسناد كويز جديد لك: "${quizTitleAr}"${dueDate ? ` - الموعد: ${dueDate}` : ''}`,
      type: 'info',
      category: 'quiz',
      action_url: '/dashboard',
    });
  },

  // Notify when an assignment is assigned
  async notifyAssignmentAssigned(studentId: string, assignmentTitle: string, assignmentTitleAr: string, dueDate: string) {
    return this.create({
      user_id: studentId,
      title: 'New Assignment',
      title_ar: 'واجب جديد',
      message: `You have a new assignment: "${assignmentTitle}" - Due: ${dueDate}`,
      message_ar: `تم إسناد واجب جديد لك: "${assignmentTitleAr}" - الموعد: ${dueDate}`,
      type: 'info',
      category: 'assignment',
      action_url: '/dashboard',
    });
  },

  // Notify when quiz is graded
  async notifyQuizGraded(studentId: string, quizTitle: string, quizTitleAr: string, score: number, percentage: number) {
    const passed = percentage >= 60;
    return this.create({
      user_id: studentId,
      title: passed ? 'Quiz Passed!' : 'Quiz Results',
      title_ar: passed ? 'نجحت في الكويز!' : 'نتيجة الكويز',
      message: `Your result for "${quizTitle}": ${score} points (${percentage}%)`,
      message_ar: `نتيجتك في "${quizTitleAr}": ${score} درجة (${percentage}%)`,
      type: passed ? 'success' : 'warning',
      category: 'quiz',
    });
  },

  // Notify when assignment is graded
  async notifyAssignmentGraded(studentId: string, assignmentTitle: string, assignmentTitleAr: string, score: number, maxScore: number) {
    return this.create({
      user_id: studentId,
      title: 'Assignment Graded',
      title_ar: 'تم تقييم الواجب',
      message: `Your assignment "${assignmentTitle}" has been graded: ${score}/${maxScore}`,
      message_ar: `تم تقييم واجبك "${assignmentTitleAr}": ${score}/${maxScore}`,
      type: 'success',
      category: 'assignment',
    });
  },

  // Notify instructor when student submits assignment
  async notifySubmissionReceived(instructorId: string, studentName: string, studentNameAr: string, assignmentTitle: string, assignmentTitleAr: string) {
    return this.create({
      user_id: instructorId,
      title: 'New Submission',
      title_ar: 'تسليم جديد',
      message: `${studentName} submitted "${assignmentTitle}"`,
      message_ar: `${studentNameAr} سلم "${assignmentTitleAr}"`,
      type: 'info',
      category: 'assignment',
      action_url: '/assignments',
    });
  },

  // Notify about warning issued
  async notifyWarningIssued(studentId: string, reason: string, reasonAr: string) {
    return this.create({
      user_id: studentId,
      title: 'Warning Issued',
      title_ar: 'إنذار جديد',
      message: `You have received a warning: ${reason}`,
      message_ar: `تم إصدار إنذار لك: ${reasonAr}`,
      type: 'error',
      category: 'warning',
    });
  },

  // Notify admin about expiring subscription
  async notifySubscriptionExpiring(adminId: string, studentName: string, studentNameAr: string, endDate: string) {
    return this.create({
      user_id: adminId,
      title: 'Subscription Expiring',
      title_ar: 'اشتراك قارب على الانتهاء',
      message: `${studentName}'s subscription expires on ${endDate}`,
      message_ar: `اشتراك ${studentNameAr} ينتهي في ${endDate}`,
      type: 'warning',
      category: 'subscription',
      action_url: '/students',
    });
  },

  // Notify about session reminder
  async notifySessionReminder(userId: string, groupName: string, groupNameAr: string, sessionDate: string, sessionTime: string) {
    return this.create({
      user_id: userId,
      title: 'Upcoming Session',
      title_ar: 'سيشن قادم',
      message: `You have a session for "${groupName}" on ${sessionDate} at ${sessionTime}`,
      message_ar: `لديك سيشن لمجموعة "${groupNameAr}" في ${sessionDate} الساعة ${sessionTime}`,
      type: 'info',
      category: 'session',
    });
  },

  // Bulk notify group students
  async notifyGroupStudents(groupId: string, title: string, titleAr: string, message: string, messageAr: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', category: string = 'general') {
    try {
      // Get all students in the group
      const { data: students, error } = await supabase
        .from('group_students')
        .select('student_id')
        .eq('group_id', groupId)
        .eq('is_active', true);

      if (error) throw error;
      if (!students || students.length === 0) return true;

      // Create notifications for all students
      const notifications = students.map(s => ({
        user_id: s.student_id,
        title,
        title_ar: titleAr,
        message,
        message_ar: messageAr,
        type,
        category,
      }));

      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) throw insertError;
      return true;
    } catch (error) {
      console.error('Error notifying group students:', error);
      return false;
    }
  },

  // Notify instructor when group is assigned
  async notifyGroupAssigned(
    instructorId: string,
    groupName: string,
    groupNameAr: string,
    scheduleDay: string,
    scheduleTime: string
  ) {
    return this.create({
      user_id: instructorId,
      title: 'New Group Assigned',
      title_ar: 'مجموعة جديدة مسندة إليك',
      message: `You have been assigned to group "${groupName}" - Schedule: ${scheduleDay} at ${scheduleTime}`,
      message_ar: `تم إسناد مجموعة "${groupNameAr}" إليك - الموعد: ${scheduleDay} الساعة ${scheduleTime}`,
      type: 'info',
      category: 'group',
      action_url: '/groups',
    });
  },

  // Notify about payment due soon
  async notifyPaymentDueSoon(studentId: string, amount: number, dueDate: string) {
    return this.create({
      user_id: studentId,
      title: 'Payment Due Soon',
      title_ar: 'موعد الدفع قريب',
      message: `Your next payment of ${amount} EGP is due on ${dueDate}. Please arrange payment to avoid account suspension.`,
      message_ar: `موعد الدفع القادم ${amount} ج.م في ${dueDate}. يرجى الدفع لتجنب إيقاف الحساب.`,
      type: 'warning',
      category: 'payment',
    });
  },

  // Notify when payment is recorded
  async notifyPaymentRecorded(studentId: string, amount: number, remaining: number) {
    return this.create({
      user_id: studentId,
      title: 'Payment Received',
      title_ar: 'تم استلام الدفعة',
      message: `Your payment of ${amount} EGP has been recorded. Remaining: ${remaining} EGP.`,
      message_ar: `تم تسجيل دفعة بقيمة ${amount} ج.م. المتبقي: ${remaining} ج.م.`,
      type: 'success',
      category: 'payment',
    });
  },

  // Notify when account is suspended due to overdue payment
  async notifyAccountSuspended(studentId: string) {
    return this.create({
      user_id: studentId,
      title: 'Account Suspended',
      title_ar: 'تم إيقاف حسابك',
      message: 'Your account has been suspended due to overdue payment. Please contact the administration.',
      message_ar: 'تم إيقاف حسابك بسبب تأخر في سداد القسط. يرجى التواصل مع الإدارة.',
      type: 'error',
      category: 'payment',
    });
  },

  // Notify admin about overdue student
  async notifyAdminOverduePayment(adminId: string, studentName: string, studentNameAr: string, studentId: string) {
    return this.create({
      user_id: adminId,
      title: 'Student Account Suspended',
      title_ar: 'تم إيقاف حساب طالب',
      message: `${studentName} has been suspended due to overdue payment.`,
      message_ar: `تم إيقاف حساب ${studentNameAr || studentName} بسبب تأخر في الدفع.`,
      type: 'warning',
      category: 'payment',
      action_url: `/student/${studentId}`,
    });
  },

  // Notify when account is reactivated after payment
  async notifyAccountReactivated(studentId: string) {
    return this.create({
      user_id: studentId,
      title: 'Account Reactivated',
      title_ar: 'تم تفعيل حسابك',
      message: 'Your account has been reactivated after payment. Thank you!',
      message_ar: 'تم تفعيل حسابك بعد استلام الدفعة. شكراً لك!',
      type: 'success',
      category: 'payment',
    });
  },
};
