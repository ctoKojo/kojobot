// Shared HTML layout for all Kojobot emails (RTL Arabic-first design)

export interface LayoutOptions {
  title: string
  preheader?: string
  bodyHtml: string
  ctaText?: string
  ctaUrl?: string
  footerNote?: string
}

const BRAND_COLOR = '#7c3aed' // Purple — matches Kojobot brand
const BG_COLOR = '#ffffff'
const TEXT_COLOR = '#1a1a1a'
const MUTED_COLOR = '#6b7280'

export function renderLayout(opts: LayoutOptions): string {
  const { title, preheader, bodyHtml, ctaText, ctaUrl, footerNote } = opts

  const ctaBlock =
    ctaText && ctaUrl
      ? `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 32px auto;">
      <tr>
        <td style="border-radius: 8px; background-color: ${BRAND_COLOR};">
          <a href="${ctaUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
            ${ctaText}
          </a>
        </td>
      </tr>
    </table>
  `
      : ''

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif;">
  ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>` : ''}

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: ${BG_COLOR}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #a855f7 100%); padding: 32px 40px; text-align: center;">
              <img src="https://lrouvlmandrjughswbyw.supabase.co/storage/v1/object/public/email-assets/kojobot-logo-white.png" alt="Kojobot Academy" width="180" style="display: block; margin: 0 auto 12px; max-width: 180px; height: auto;" />
              <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                أكاديمية كوجوبوت لتعليم البرمجة
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: ${TEXT_COLOR}; font-size: 22px; font-weight: 600; line-height: 1.4;">
                ${title}
              </h2>
              <div style="color: ${TEXT_COLOR}; font-size: 16px; line-height: 1.7;">
                ${bodyHtml}
              </div>
              ${ctaBlock}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
              ${footerNote ? `<p style="margin: 0 0 12px; color: ${MUTED_COLOR}; font-size: 13px;">${footerNote}</p>` : ''}
              <p style="margin: 0; color: ${MUTED_COLOR}; font-size: 12px;">
                © ${new Date().getFullYear()} Kojobot Academy. جميع الحقوق محفوظة.
              </p>
              <p style="margin: 8px 0 0; color: ${MUTED_COLOR}; font-size: 12px;">
                <a href="https://kojobot.com" style="color: ${BRAND_COLOR}; text-decoration: none;">kojobot.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function escapeHtml(s: string): string {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
