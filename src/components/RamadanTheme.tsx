import React from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

/* ── Crescent SVG (brand gradient) ── */
const Crescent = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none">
    <defs>
      <linearGradient id="kojo-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#61C9E0" />
        <stop offset="100%" stopColor="#6455F0" />
      </linearGradient>
    </defs>
    <path
      d="M20 2a18 18 0 1 0 0 36 14 14 0 0 1 0-36z"
      fill="url(#kojo-grad)"
    />
  </svg>
);

/* ── Star SVG ── */
const Star = ({ className = '', delay = '0s' }: { className?: string; delay?: string }) => (
  <svg
    viewBox="0 0 12 12"
    className={`animate-twinkle ${className}`}
    style={{ animationDelay: delay }}
    fill="none"
  >
    <path
      d="M6 0l1.5 4.5L12 6l-4.5 1.5L6 12 4.5 7.5 0 6l4.5-1.5z"
      fill="#D4A843"
    />
  </svg>
);

/* ── Lantern SVG (brand gradient + gold accent) ── */
const Lantern = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 30 60" className={`animate-lantern-swing ${className}`} fill="none">
    <defs>
      <linearGradient id="lantern-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#D4A843" />
        <stop offset="100%" stopColor="#B8860B" />
      </linearGradient>
      <radialGradient id="lantern-glow" cx="50%" cy="50%">
        <stop offset="0%" stopColor="#FFD700" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#D4A843" stopOpacity="0" />
      </radialGradient>
    </defs>
    {/* Chain */}
    <path d="M15 0v8" stroke="#D4A843" strokeWidth="2" />
    <circle cx="15" cy="8" r="3" fill="#D4A843" />
    {/* Body */}
    <rect x="6" y="12" width="18" height="32" rx="6" fill="url(#lantern-grad)" />
    {/* Window pattern */}
    <line x1="15" y1="15" x2="15" y2="41" stroke="white" strokeWidth="1.2" opacity="0.5" />
    <line x1="9" y1="22" x2="21" y2="22" stroke="white" strokeWidth="1.2" opacity="0.5" />
    <line x1="9" y1="33" x2="21" y2="33" stroke="white" strokeWidth="1.2" opacity="0.5" />
    {/* Bottom cap */}
    <rect x="8" y="44" width="14" height="6" rx="3" fill="url(#lantern-grad)" />
    {/* Glow effect */}
    <circle cx="15" cy="28" r="14" fill="url(#lantern-glow)" />
  </svg>
);

/* ── Islamic geometric 8-point star ── */
const GeometricStar = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none">
    <defs>
      <linearGradient id="geo-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#D4A843" />
        <stop offset="100%" stopColor="#B8860B" />
      </linearGradient>
    </defs>
    <polygon points="50,5 61,35 95,35 68,55 79,85 50,68 21,85 32,55 5,35 39,35" fill="url(#geo-grad)" />
  </svg>
);

/* ── Mosque silhouette (subtle) ── */
const MosqueSilhouette = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 200 80" className={className} fill="none">
    <defs>
      <linearGradient id="mosque-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#D4A843" />
        <stop offset="100%" stopColor="#B8860B" />
      </linearGradient>
    </defs>
    {/* Main dome */}
    <path d="M60,80 L60,45 Q100,5 140,45 L140,80 Z" fill="url(#mosque-grad)" opacity="0.20" />
    {/* Left minaret */}
    <rect x="35" y="30" width="12" height="50" rx="2" fill="url(#mosque-grad)" opacity="0.18" />
    <path d="M35,30 Q41,18 47,30" fill="url(#mosque-grad)" opacity="0.18" />
    {/* Right minaret */}
    <rect x="153" y="30" width="12" height="50" rx="2" fill="url(#mosque-grad)" opacity="0.18" />
    <path d="M153,30 Q159,18 165,30" fill="url(#mosque-grad)" opacity="0.18" />
    {/* Small crescent on dome */}
    <path d="M100,12 a5,5 0 1,0 0,10 a3.5,3.5 0 0,1 0,-10" fill="url(#mosque-grad)" opacity="0.25" />
  </svg>
);

/* ── Header Decorations ── */
export function RamadanHeaderDecor() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Golden gradient overlay on header */}
      <div className="absolute inset-0 opacity-[0.06]" style={{
        background: 'linear-gradient(135deg, #D4A843 0%, #FFD700 50%, #D4A843 100%)'
      }} />
      <Crescent className="absolute top-1 ltr:right-20 rtl:left-20 w-8 h-8 opacity-70" />
      <Star className="absolute top-1.5 ltr:right-32 rtl:left-32 w-4 h-4" delay="0s" />
      <Star className="absolute top-3 ltr:right-40 rtl:left-40 w-3.5 h-3.5" delay="0.7s" />
      <Star className="absolute top-1 ltr:right-48 rtl:left-48 w-3 h-3" delay="1.4s" />
      <Star className="absolute top-2 ltr:right-56 rtl:left-56 w-3.5 h-3.5" delay="2s" />
      <Lantern className="absolute -top-1 ltr:right-16 rtl:left-16 w-5 h-10 opacity-50" />
      <Lantern className="absolute -top-1 ltr:right-[280px] rtl:left-[280px] w-4 h-8 opacity-35" />
    </div>
  );
}

/* ── Sidebar Decorations ── */
export function RamadanSidebarDecor() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {/* Golden tint */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        background: 'linear-gradient(180deg, #D4A843 0%, transparent 40%, #D4A843 100%)'
      }} />
      {/* Lanterns hanging from top */}
      <Lantern className="absolute -top-1 ltr:left-2 rtl:right-2 w-8 h-16 opacity-60" />
      <Lantern className="absolute -top-1 ltr:right-2 rtl:left-2 w-6 h-12 opacity-45" />
      {/* Stars - golden and bright */}
      <Star className="absolute top-20 ltr:right-2 rtl:left-2 w-4 h-4" delay="0.3s" />
      <Star className="absolute top-40 ltr:left-3 rtl:right-3 w-3.5 h-3.5" delay="1s" />
      <Star className="absolute top-60 ltr:right-3 rtl:left-3 w-3 h-3" delay="1.8s" />
      <Star className="absolute top-80 ltr:left-2 rtl:right-2 w-4 h-4" delay="0.6s" />
      <Star className="absolute top-[400px] ltr:right-2 rtl:left-2 w-3.5 h-3.5" delay="1.3s" />
      {/* Geometric stars */}
      <GeometricStar className="absolute bottom-32 ltr:left-1 rtl:right-1 w-12 h-12 opacity-[0.12]" />
      <GeometricStar className="absolute top-36 ltr:right-0 rtl:left-0 w-10 h-10 opacity-[0.09]" />
      {/* Bottom crescent */}
      <Crescent className="absolute bottom-12 ltr:right-1 rtl:left-1 w-10 h-10 opacity-40" />
      {/* Mosque at bottom */}
      <MosqueSilhouette className="absolute bottom-0 left-0 right-0 w-full h-16 opacity-40" />
    </div>
  );
}

/* ── Main Content Background Decorations ── */
export function RamadanContentDecor() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {/* Subtle golden tint */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        background: 'linear-gradient(135deg, #D4A843 0%, transparent 40%, #D4A843 100%)'
      }} />
      {/* Mosque silhouette at bottom */}
      <MosqueSilhouette className="absolute bottom-0 ltr:right-0 rtl:left-0 w-80 h-28 opacity-50" />
      {/* Corner geometric patterns */}
      <GeometricStar className="absolute top-2 ltr:right-4 rtl:left-4 w-24 h-24 opacity-[0.08]" />
      <GeometricStar className="absolute bottom-16 ltr:left-4 rtl:right-4 w-28 h-28 opacity-[0.06]" />
      {/* Floating stars - golden and visible */}
      <Star className="absolute top-8 ltr:right-12 rtl:left-12 w-5 h-5" delay="0.5s" />
      <Star className="absolute top-28 ltr:left-8 rtl:right-8 w-4 h-4" delay="1.2s" />
      <Star className="absolute bottom-36 ltr:right-20 rtl:left-20 w-4.5 h-4.5" delay="2s" />
      <Star className="absolute top-1/2 ltr:right-6 rtl:left-6 w-3.5 h-3.5" delay="0.8s" />
      <Star className="absolute top-16 ltr:left-1/3 rtl:right-1/3 w-4 h-4" delay="1.6s" />
      <Star className="absolute bottom-48 ltr:left-16 rtl:right-16 w-3 h-3" delay="0.3s" />
      {/* Crescents */}
      <Crescent className="absolute top-4 ltr:left-6 rtl:right-6 w-14 h-14 opacity-[0.15]" />
      <Crescent className="absolute bottom-20 ltr:right-10 rtl:left-10 w-12 h-12 opacity-[0.12]" />
      {/* Lanterns in corners */}
      <Lantern className="absolute -top-1 ltr:right-4 rtl:left-4 w-6 h-12 opacity-25" />
    </div>
  );
}

/* ── Dismissible Dashboard Banner ── */
const BANNER_KEY = 'ramadan-banner-dismissed-2026';

export function RamadanBanner() {
  const { isRTL } = useLanguage();
  const [dismissed, setDismissed] = React.useState(() => {
    try { return localStorage.getItem(BANNER_KEY) === '1'; } catch { return false; }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(BANNER_KEY, '1'); } catch {}
  };

  return (
    <div className="relative mb-4 rounded-xl overflow-hidden shadow-lg" style={{
      background: 'linear-gradient(135deg, #D4A843 0%, #B8860B 40%, #D4A843 70%, #FFD700 100%)',
    }}>
      {/* Decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <Lantern className="absolute -top-2 ltr:left-4 rtl:right-4 w-8 h-16 opacity-70" />
        <Lantern className="absolute -top-2 ltr:left-20 rtl:right-20 w-6 h-12 opacity-50" />
        <Crescent className="absolute top-0 ltr:right-12 rtl:left-12 w-12 h-12 opacity-50" />
        <Star className="absolute top-1 ltr:right-28 rtl:left-28 w-4 h-4" delay="0s" />
        <Star className="absolute top-3 ltr:right-40 rtl:left-40 w-3.5 h-3.5" delay="1s" />
        <Star className="absolute top-2 ltr:left-36 rtl:right-36 w-3 h-3" delay="0.5s" />
        <GeometricStar className="absolute -bottom-3 ltr:right-2 rtl:left-2 w-14 h-14 opacity-15" />
      </div>

      <div className="relative flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🌙</span>
          <div>
            <p className="text-white font-bold text-sm md:text-base drop-shadow-md">
              {isRTL ? 'رمضان كريم 🤲' : 'Ramadan Kareem 🤲'}
            </p>
            <p className="text-white/90 text-xs md:text-sm">
              {isRTL ? 'كل عام وأنتم بخير' : 'Wishing you a blessed month'}
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-white/80 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/20"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Auth Page Mobile Decorations ── */
export function RamadanAuthDecor() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1]">
      <Crescent className="absolute top-4 ltr:right-6 rtl:left-6 w-24 h-24 opacity-40" />
      <Lantern className="absolute top-0 ltr:left-4 rtl:right-4 w-12 h-24 opacity-45" />
      <Lantern className="absolute top-0 ltr:right-24 rtl:left-24 w-8 h-16 opacity-30" />
      <Star className="absolute top-14 ltr:right-20 rtl:left-20 w-6 h-6" delay="0s" />
      <Star className="absolute top-10 ltr:left-16 rtl:right-16 w-5 h-5" delay="0.5s" />
      <Star className="absolute top-24 ltr:right-12 rtl:left-12 w-4 h-4" delay="1.2s" />
      <Star className="absolute top-20 ltr:left-6 rtl:right-6 w-4.5 h-4.5" delay="0.8s" />
    </div>
  );
}

/* ── Auth Brand Panel Ramadan Overlay (Desktop left panel) ── */
export function RamadanAuthBrandDecor() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1]">
      {/* Golden overlay */}
      <div className="absolute inset-0 opacity-[0.08]" style={{
        background: 'linear-gradient(180deg, #D4A843 0%, transparent 30%, transparent 70%, #D4A843 100%)'
      }} />
      {/* Large crescent - hero element */}
      <Crescent className="absolute top-6 ltr:right-4 rtl:left-4 w-40 h-40 opacity-30" />
      {/* Lanterns hanging from top - prominent gold */}
      <Lantern className="absolute -top-1 ltr:left-6 rtl:right-6 w-12 h-24 opacity-70" />
      <Lantern className="absolute -top-1 ltr:left-24 rtl:right-24 w-10 h-20 opacity-55" />
      <Lantern className="absolute -top-1 ltr:right-8 rtl:left-8 w-11 h-22 opacity-60" />
      <Lantern className="absolute -top-1 ltr:right-32 rtl:left-32 w-8 h-16 opacity-40" />
      {/* Stars - scattered generously with gold */}
      <Star className="absolute top-4 ltr:left-1/2 rtl:right-1/2 w-6 h-6" delay="0s" />
      <Star className="absolute top-16 ltr:right-16 rtl:left-16 w-5 h-5" delay="0.4s" />
      <Star className="absolute top-32 ltr:left-12 rtl:right-12 w-5.5 h-5.5" delay="1s" />
      <Star className="absolute top-1/2 ltr:right-6 rtl:left-6 w-4.5 h-4.5" delay="0.7s" />
      <Star className="absolute bottom-36 ltr:left-10 rtl:right-10 w-4 h-4" delay="1.5s" />
      <Star className="absolute bottom-24 ltr:right-12 rtl:left-12 w-5 h-5" delay="0.3s" />
      <Star className="absolute bottom-12 ltr:left-1/3 rtl:right-1/3 w-4.5 h-4.5" delay="1.8s" />
      <Star className="absolute top-1/3 ltr:left-4 rtl:right-4 w-3.5 h-3.5" delay="2.2s" />
      {/* Geometric patterns - gold */}
      <GeometricStar className="absolute bottom-6 ltr:left-4 rtl:right-4 w-24 h-24 opacity-[0.15]" />
      <GeometricStar className="absolute top-1/3 ltr:right-0 rtl:left-0 w-20 h-20 opacity-[0.12]" />
      <GeometricStar className="absolute top-2/3 ltr:left-0 rtl:right-0 w-16 h-16 opacity-[0.10]" />
      {/* Mosque silhouette at bottom */}
      <MosqueSilhouette className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-32 opacity-60" />
    </div>
  );
}

/* ── Auth Ramadan Greeting ── */
export function RamadanGreeting() {
  const { isRTL } = useLanguage();
  return (
    <p className="text-lg xl:text-xl text-white/90 leading-relaxed font-semibold">
      {isRTL ? '🌙 رمضان كريم — كل عام وأنتم بخير' : '🌙 Ramadan Kareem — Blessed Month'}
    </p>
  );
}
