// Password reset email template
import { renderLayout, escapeHtml } from './_layout.ts'

interface PasswordResetData {
  recipientName?: string
  resetUrl?: string
  expiresIn?: string // e.g. "ساعة واحدة"
}

export const template = {
  subject: () => 'استعادة كلمة المرور — Kojobot Academy',
  render: (data: PasswordResetData): string => {
    const name = escapeHtml(data.recipientName || '')
    const resetUrl = data.resetUrl || 'https://kojobot.com/auth'
    const expiresIn = escapeHtml(data.expiresIn || 'ساعة واحدة')

    const greeting = name ? `أهلاً <strong>${name}</strong>` : 'أهلاً بك'

    return renderLayout({
      title: '🔐 طلب استعادة كلمة المرور',
      preheader: 'اضغط على الرابط لإعادة تعيين كلمة المرور',
      bodyHtml: `
        <p>${greeting}،</p>
        <p>تلقّينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك في أكاديمية كوجوبوت.</p>
        <p>اضغط على الزر التالي لتعيين كلمة مرور جديدة:</p>

        <p style="margin: 24px 0; padding: 16px; background-color: #fef2f2; border-right: 4px solid #ef4444; border-radius: 4px; color: #991b1b; font-size: 14px;">
          ⚠️ <strong>تنبيه أمني:</strong> هذا الرابط صالح لمدة <strong>${expiresIn}</strong> فقط. إذا لم تكن أنت من طلب الاستعادة، يُرجى تجاهل هذه الرسالة وحسابك سيظل آمناً.
        </p>

        <p style="color: #6b7280; font-size: 13px; margin-top: 32px;">
          إذا لم يعمل الزر، انسخ الرابط التالي والصقه في المتصفح:<br>
          <span style="color: #7c3aed; word-break: break-all;">${escapeHtml(resetUrl)}</span>
        </p>
      `,
      ctaText: 'إعادة تعيين كلمة المرور',
      ctaUrl: resetUrl,
      footerNote: 'إذا لم تطلب هذه الاستعادة، تجاهل هذه الرسالة.',
    })
  },
}
