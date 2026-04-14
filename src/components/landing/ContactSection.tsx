import { Mail, Phone, MapPin, MessageCircle } from "lucide-react";
import { socialIconMap, socialLabelMap, l } from "./types";
import type { SocialLink } from "./types";

interface ContactSectionProps {
  socialLinks: SocialLink[];
  email?: string;
  phone?: string;
  addressEn?: string;
  addressAr?: string;
  language: string;
}

export const ContactSection = ({ socialLinks, email, phone, addressEn, addressAr, language }: ContactSectionProps) => (
  <section id="contact" className="section-pad" style={{ padding: "100px 24px", position: "relative", zIndex: 1 }}>
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 56 }}>
        <span className="section-label">{language === "ar" ? "تواصل معنا" : "Contact"}</span>
        <h2 className="font-display" style={{ fontSize: "clamp(28px, 4vw, 46px)", marginBottom: 14 }}>
          <span className="grad-text">{language === "ar" ? "نحن هنا لك" : "We're Here for You"}</span>
        </h2>
        <p style={{ color: "rgba(240,240,255,.45)", maxWidth: 400, margin: "0 auto", fontSize: 16 }}>
          {language === "ar" ? "تواصل معنا بأي طريقة تناسبك" : "Reach out through any channel that suits you"}
        </p>
      </div>

      <div className="contact-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
        {socialLinks.map((link) => {
          const Icon = socialIconMap[link.platform] || MessageCircle;
          const label = socialLabelMap[link.platform] || { en: link.platform, ar: link.platform };
          return (
            <a key={link.platform} href={link.url} target="_blank" rel="noopener noreferrer" className="contact-card">
              <div className="contact-icon">
                <Icon className="w-7 h-7" style={{ color: "#fff" }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{language === "ar" ? label.ar : label.en}</span>
            </a>
          );
        })}
        {email && (
          <a href={`mailto:${email}`} className="contact-card">
            <div className="contact-icon"><Mail size={26} color="#fff" /></div>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{language === "ar" ? "البريد الإلكتروني" : "Email"}</span>
            <span style={{ fontSize: 12, color: "rgba(240,240,255,.35)" }}>{email}</span>
          </a>
        )}
        {phone && (
          <a href={`tel:${phone}`} className="contact-card">
            <div className="contact-icon"><Phone size={26} color="#fff" /></div>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{language === "ar" ? "الهاتف" : "Phone"}</span>
            <span style={{ fontSize: 12, color: "rgba(240,240,255,.35)" }}>{phone}</span>
          </a>
        )}
      </div>

      {(addressEn || addressAr) && (
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "rgba(240,240,255,.45)", fontSize: 14 }}>
            <MapPin size={16} color="var(--kojo-violet)" />
            {l(addressEn, addressAr, language)}
          </div>
        </div>
      )}
    </div>
  </section>
);
