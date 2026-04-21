// Session reminder email template
import { renderLayout, escapeHtml } from './_layout.ts'

interface SessionReminderData {
  studentName?: string
  sessionTitle?: string
  sessionDate?: string // formatted date string
  sessionTime?: string // formatted time string
  groupName?: string
  joinUrl?: string
  recipientType?: 'student' | 'parent'
}

export const template = {
  subject: (data: SessionReminderData) =>
    `تذكير: حصة ${data.sessionTitle || 'قادمة'} ${data.sessionDate ? `يوم ${data.sessionDate}` : ''}`.trim(),
  render: (data: SessionReminderData): string => {
    const name = escapeHtml(data.studentName || '')
    const title = escapeHtml(data.sessionTitle || 'حصة قادمة')
    const date = escapeHtml(data.sessionDate || '')
    const time = escapeHtml(data.sessionTime || '')
    const groupName = escapeHtml(data.groupName || '')
    const isParent = data.recipientType === 'parent'

    const greeting = isParent
      ? name
        ? `أهلاً، ولي أمر الطالب <strong>${name}</strong>`
        : 'أهلاً بك'
      : name
        ? `أهلاً <strong>${name}</strong>`
        : 'أهلاً بك'

    const intro = isParent
      ? 'نذكّرك بأن لدى ابنك/ابنتك حصة قادمة في الأكاديمية:'
      : 'نذكّرك بحصتك القادمة في الأكاديمية:'

    return renderLayout({
      title: '🔔 تذكير بحصة قادمة',
      preheader: `${title} - ${date} ${time}`,
      bodyHtml: `
        <p>${greeting}،</p>
        <p>${intro}</p>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0; background-color: #f9fafb; border-radius: 8px; padding: 20px;">
          <tr>
            <td style="padding: 8px 0;">
              <strong style="color: #6b7280;">📚 الحصة:</strong>
              <span style="color: #1a1a1a; margin-right: 8px;">${title}</span>
            </td>
          </tr>
          ${groupName ? `<tr>
            <td style="padding: 8px 0;">
              <strong style="color: #6b7280;">👥 المجموعة:</strong>
              <span style="color: #1a1a1a; margin-right: 8px;">${groupName}</span>
            </td>
          </tr>` : ''}
          <tr>
            <td style="padding: 8px 0;">
              <strong style="color: #6b7280;">📅 التاريخ:</strong>
              <span style="color: #1a1a1a; margin-right: 8px;">${date}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <strong style="color: #6b7280;">⏰ الوقت:</strong>
              <span style="color: #1a1a1a; margin-right: 8px;">${time}</span>
            </td>
          </tr>
        </table>

        <p>${isParent ? 'يرجى التأكد من جاهزية الطالب قبل موعد الحصة.' : 'تأكد من جاهزيتك قبل بدء الحصة.'}</p>
      `,
      ctaText: data.joinUrl ? 'الانضمام للحصة' : 'فتح المنصة',
      ctaUrl: data.joinUrl || 'https://kojobot.com',
      footerNote: 'هذا إشعار تلقائي — لا حاجة للرد.',
    })
  },
}
