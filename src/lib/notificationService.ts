import { supabase } from '@/integrations/supabase/client';
import { sendEmail, getUserEmail } from '@/lib/emailService';

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

/**
 * Check if a similar notification was already sent today to prevent duplicates.
 * Matches on user_id + category + action_url within the last 24 hours.
 */
async function isDuplicate(data: NotificationData): Promise<boolean> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const query = supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', data.user_id)
      .eq('category', data.category || 'general')
      .gte('created_at', since);

    if (data.action_url) {
      query.eq('action_url', data.action_url);
    }

    const { count } = await query;
    return (count ?? 0) > 0;
  } catch {
    // If dedup check fails, allow the notification through
    return false;
  }
}

export const notificationService = {
  // Create a single notification with dedup
  async create(data: NotificationData) {
    try {
      // Skip dedup for payment/success notifications (they're always unique amounts)
      const skipDedup = data.category === 'payment' && (data.type === 'success' || data.type === 'info');
      if (!skipDedup && await isDuplicate(data)) {
        console.log('Skipped duplicate notification:', data.category, data.user_id);
        return true;
      }

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
    const result = await this.create({
      user_id: userId,
      title: 'Upcoming Session',
      title_ar: 'سيشن قادم',
      message: `You have a session for "${groupName}" on ${sessionDate} at ${sessionTime}`,
      message_ar: `لديك سيشن لمجموعة "${groupNameAr}" في ${sessionDate} الساعة ${sessionTime}`,
      type: 'info',
      category: 'session',
    });

    // Fire-and-forget session reminder email
    try {
      const email = await getUserEmail(userId);
      if (email) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, full_name_ar')
          .eq('user_id', userId)
          .maybeSingle();
        sendEmail({
          to: email,
          templateName: 'session-reminder',
          templateData: {
            recipientName: profile?.full_name_ar || profile?.full_name || '',
            groupName: groupNameAr || groupName,
            sessionDate,
            sessionTime,
          },
          idempotencyKey: `session-reminder-${userId}-${sessionDate}-${sessionTime}`,
        });
      }
    } catch (err) {
      console.error('[notifySessionReminder] email error:', err);
    }

    return result;
  },

  // Bulk notify group students
  async notifyGroupStudents(groupId: string, title: string, titleAr: string, message: string, messageAr: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', category: string = 'general') {
    try {
      const { data: students, error } = await supabase
        .from('group_students')
        .select('student_id')
        .eq('group_id', groupId)
        .eq('is_active', true);

      if (error) throw error;
      if (!students || students.length === 0) return true;

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
    const result = await this.create({
      user_id: studentId,
      title: 'Payment Due Soon',
      title_ar: 'موعد الدفع قريب',
      message: `Your next payment of ${amount} EGP is due on ${dueDate}. Please arrange payment to avoid account suspension.`,
      message_ar: `موعد الدفع القادم ${amount} ج.م في ${dueDate}. يرجى الدفع لتجنب إيقاف الحساب.`,
      type: 'warning',
      category: 'payment',
    });

    // Fire-and-forget email
    try {
      const email = await getUserEmail(studentId);
      if (email) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, full_name_ar')
          .eq('user_id', studentId)
          .maybeSingle();
        sendEmail({
          to: email,
          templateName: 'payment-due',
          templateData: {
            studentName: profile?.full_name_ar || profile?.full_name || '',
            amount,
            dueDate,
          },
          idempotencyKey: `payment-due-${studentId}-${dueDate}`,
        });
      }
    } catch (err) {
      console.error('[notifyPaymentDueSoon] email error:', err);
    }

    return result;
  },

  // Notify when payment is recorded (skip dedup — unique amounts)
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

  // Notify all relevant parties (student + linked parents + reception/admin) about a final-exam reschedule after a fail
  async notifyFinalExamRescheduled(params: {
    studentId: string;
    studentName: string;
    studentNameAr: string;
    levelName: string;
    levelNameAr: string;
    examDateLabel: string;
    examDateLabelAr: string;
  }) {
    const { studentId, studentName, studentNameAr, levelName, levelNameAr, examDateLabel, examDateLabelAr } = params;

    try {
      // 1) Student
      await this.create({
        user_id: studentId,
        title: 'Final Exam Rescheduled',
        title_ar: 'تم إعادة جدولة الامتحان النهائي',
        message: `Your final exam for "${levelName}" has been rescheduled to ${examDateLabel}. Good luck!`,
        message_ar: `تم إعادة جدولة الامتحان النهائي لـ "${levelNameAr}" إلى ${examDateLabelAr}. بالتوفيق!`,
        type: 'info',
        category: 'exam',
        action_url: '/dashboard',
      });

      // 2) Linked parents
      const { data: parentLinks } = await supabase
        .from('parent_students')
        .select('parent_id')
        .eq('student_id', studentId);

      const parentIds = (parentLinks || []).map(p => p.parent_id);

      // 3) Admins + Reception
      const { data: staffRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'reception']);

      const staffIds = (staffRoles || []).map(r => r.user_id);

      const recipients = Array.from(new Set([...parentIds, ...staffIds]));
      if (recipients.length === 0) return true;

      const isParent = new Set(parentIds);
      const notifications = recipients.map(uid => ({
        user_id: uid,
        title: isParent.has(uid) ? "Child's Final Exam Rescheduled" : 'Final Exam Rescheduled',
        title_ar: isParent.has(uid) ? 'تم إعادة جدولة امتحان ابنك النهائي' : 'تم إعادة جدولة امتحان نهائي',
        message: isParent.has(uid)
          ? `${studentName}'s final exam for "${levelName}" has been rescheduled to ${examDateLabel} (retry attempt).`
          : `${studentName}'s final exam for "${levelName}" was rescheduled to ${examDateLabel} (retry after fail).`,
        message_ar: isParent.has(uid)
          ? `تم إعادة جدولة الامتحان النهائي لـ ${studentNameAr} في "${levelNameAr}" إلى ${examDateLabelAr} (محاولة إعادة).`
          : `تم إعادة جدولة الامتحان النهائي للطالب ${studentNameAr} في "${levelNameAr}" إلى ${examDateLabelAr} (إعادة بعد رسوب).`,
        type: 'info' as const,
        category: 'exam',
        action_url: isParent.has(uid) ? `/parent-student/${studentId}` : `/student/${studentId}`,
      }));

      const { error } = await supabase.from('notifications').insert(notifications);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error sending final-exam reschedule notifications:', err);
      return false;
    }
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
