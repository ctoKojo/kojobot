import { Phone, Mail, MapPin } from 'lucide-react';

const SOCIAL_ICON_MAP: Record<string, string> = {
  facebook: '📘', instagram: '📸', twitter: '🐦', youtube: '📺',
  linkedin: '💼', tiktok: '🎵', whatsapp: '💬',
};

interface LandingFooterProps {
  settings: any;
  t: (ar: string, en: string) => string;
}

export function LandingFooter({ settings: s, t }: LandingFooterProps) {
  return (
    <footer className="border-t border-border/40 bg-muted/20 py-14 sm:py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10 mb-10">
          <div>
            <img src="/kojobot-logo-white.png" alt="Kojobot" className="h-8 mb-5 invert dark:invert-0" />
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {t(s.hero_subtitle_ar || '', s.hero_subtitle_en || '')}
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-foreground">{t('تواصل معنا', 'Contact Us')}</h4>
            <div className="space-y-3 text-sm text-muted-foreground">
              {s.whatsapp && (
                <a href={`https://wa.me/${s.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 hover:text-primary transition-colors">
                  <Phone className="h-4 w-4 shrink-0" /> {s.whatsapp}
                </a>
              )}
              {s.email && (
                <a href={`mailto:${encodeURIComponent(s.email)}`} className="flex items-center gap-2.5 hover:text-primary transition-colors">
                  <Mail className="h-4 w-4 shrink-0" /> {s.email}
                </a>
              )}
              {(s.address_ar || s.address_en) && (
                <p className="flex items-center gap-2.5">
                  <MapPin className="h-4 w-4 shrink-0" /> {t(s.address_ar || '', s.address_en || '')}
                </p>
              )}
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-foreground">{t('تابعنا', 'Follow Us')}</h4>
            <div className="flex gap-2.5">
              {Array.isArray(s.social_links) && s.social_links.map((link: any, i: number) => {
                const platform = String(link?.platform || '').toLowerCase();
                const url = String(link?.url || '');
                if (!url || !['facebook','instagram','twitter','youtube','linkedin','tiktok','whatsapp'].includes(platform)) return null;
                return (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all duration-300 text-lg hover:scale-110 hover:shadow-lg" title={platform}>
                    {SOCIAL_ICON_MAP[platform] || '🔗'}
                  </a>
                );
              })}
            </div>
          </div>
        </div>
        <div className="border-t border-border/40 pt-8 text-center text-sm text-muted-foreground">
          {t(s.footer_text_ar || '© 2025 Kojobot. جميع الحقوق محفوظة.', s.footer_text_en || '© 2025 Kojobot. All rights reserved.')}
        </div>
      </div>
    </footer>
  );
}
