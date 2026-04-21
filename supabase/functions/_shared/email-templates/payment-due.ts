// Payment due reminder email template
import { renderLayout, escapeHtml } from './_layout.ts'

interface PaymentDueData {
  recipientName?: string
  studentName?: string
  amount?: number | string
  currency?: string
  dueDate?: string
  installmentNumber?: number | string
  totalInstallments?: number | string
  paymentUrl?: string
  recipientType?: 'student' | 'parent'
}

export const template = {
  subject: (data: PaymentDueData) =>
    `تذكير: قسط مستحق ${data.amount ? `بقيمة ${data.amount} ${data.currency || 'ج.م'}` : ''}`.trim(),
  render: (data: PaymentDueData): string => {
    const recipient = escapeHtml(data.recipientName || '')
    const studentName = escapeHtml(data.studentName || '')
    const amount = escapeHtml(String(data.amount ?? '---'))
    const currency = escapeHtml(data.currency || 'ج.م')
    const dueDate = escapeHtml(data.dueDate || '')
    const installmentInfo =
      data.installmentNumber && data.totalInstallments
        ? `القسط ${escapeHtml(String(data.installmentNumber))} من ${escapeHtml(String(data.totalInstallments))}`
        : ''
    const isParent = data.recipientType === 'parent'

    const greeting = isParent
      ? recipient
        ? `أهلاً، ولي أمر الطالب <strong>${studentName || recipient}</strong>`
        : 'أهلاً بك'
      : recipient
        ? `أهلاً <strong>${recipient}</strong>`
        : 'أهلاً بك'

    const intro = isParent
      ? `نود تذكيرك بأن هناك قسطاً مستحقاً على اشتراك ${studentName ? `الطالب <strong>${studentName}</strong>` : 'ابنك/ابنتك'} في الأكاديمية.`
      : 'نود تذكيرك بأن هناك قسطاً مستحقاً على اشتراكك في الأكاديمية.'

    return renderLayout({
      title: '💰 تذكير بقسط مستحق',
      preheader: `قسط بقيمة ${amount} ${currency} مستحق ${dueDate}`,
      bodyHtml: `
        <p>${greeting}،</p>
        <p>${intro}</p>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0; background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px;">
          <tr>
            <td style="padding: 8px 0;">
              <strong style="color: #78350f;">💵 المبلغ المستحق:</strong>
              <span style="color: #1a1a1a; margin-right: 8px; font-size: 18px; font-weight: 700;">${amount} ${currency}</span>
            </td>
          </tr>
          ${installmentInfo ? `<tr>
            <td style="padding: 8px 0;">
              <strong style="color: #78350f;">📋 رقم القسط:</strong>
              <span style="color: #1a1a1a; margin-right: 8px;">${installmentInfo}</span>
            </td>
          </tr>` : ''}
          ${dueDate ? `<tr>
            <td style="padding: 8px 0;">
              <strong style="color: #78350f;">📅 تاريخ الاستحقاق:</strong>
              <span style="color: #1a1a1a; margin-right: 8px;">${dueDate}</span>
            </td>
          </tr>` : ''}
        </table>

        <p>يرجى المبادرة بسداد القسط في أقرب وقت لتجنّب أي تأخير في استمرار الخدمة.</p>
        <p style="color: #6b7280; font-size: 14px;">إذا كنت قد سددت القسط بالفعل، يُرجى تجاهل هذه الرسالة.</p>
      `,
      ctaText: 'سداد القسط الآن',
      ctaUrl: data.paymentUrl || 'https://kojobot.com/my-finances',
      footerNote: 'لأي استفسارات مالية، تواصل مع الإدارة.',
    })
  },
}
