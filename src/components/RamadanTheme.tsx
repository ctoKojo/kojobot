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
      opacity="0.85"
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
      fill="url(#kojo-grad)"
      opacity="0.6"
    />
  </svg>
);

/* ── Lantern SVG (brand gradient + subtle gold accent) ── */
const Lantern = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 30 60" className={`animate-lantern-swing ${className}`} fill="none">
    <defs>
      <linearGradient id="lantern-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#61C9E0" />
        <stop offset="100%" stopColor="#6455F0" />
      </linearGradient>
    </defs>
    {/* Hook */}
    <path d="M15 0v8" stroke="#D4A843" strokeWidth="1" opacity="0.6" />
    <circle cx="15" cy="8" r="2" fill="#D4A843" opacity="0.5" />
    {/* Body */}
    <rect x="8" y="12" width="14" height="28" rx="4" fill="url(#lantern-grad)" opacity="0.7" />
    {/* Window lines */}
    <line x1="15" y1="14" x2="15" y2="38" stroke="white" strokeWidth="0.5" opacity="0.3" />
    <line x1="10" y1="26" x2="20" y2="26" stroke="white" strokeWidth="0.5" opacity="0.3" />
    {/* Bottom cap */}
    <rect x="10" y="40" width="10" height="4" rx="2" fill="url(#lantern-grad)" opacity="0.5" />
    {/* Glow */}
    <circle cx="15" cy="26" r="4" fill="#D4A843" opacity="0.15" />
  </svg>
);

/* ── Islamic geometric pattern (subtle) ── */
const GeometricPattern = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" opacity="0.06">
    <defs>
      <linearGradient id="geo-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#61C9E0" />
        <stop offset="100%" stopColor="#6455F0" />
      </linearGradient>
    </defs>
    {/* 8-point star pattern */}
    <polygon points="50,5 61,35 95,35 68,55 79,85 50,68 21,85 32,55 5,35 39,35" fill="url(#geo-grad)" />
  </svg>
);

/* ── Header Decorations (crescent + stars in header bar) ── */
export function RamadanHeaderDecor() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <Crescent className="absolute top-1 ltr:right-24 rtl:left-24 w-5 h-5 opacity-40" />
      <Star className="absolute top-2 ltr:right-36 rtl:left-36 w-2.5 h-2.5" delay="0s" />
      <Star className="absolute top-3 ltr:right-44 rtl:left-44 w-2 h-2" delay="0.7s" />
      <Star className="absolute top-1 ltr:right-52 rtl:left-52 w-1.5 h-1.5" delay="1.4s" />
    </div>
  );
}

/* ── Sidebar Decorations ── */
export function RamadanSidebarDecor() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Top lantern */}
      <Lantern className="absolute -top-1 ltr:left-3 rtl:right-3 w-5 h-10 opacity-30" />
      {/* Stars scattered */}
      <Star className="absolute top-20 ltr:right-3 rtl:left-3 w-2.5 h-2.5" delay="0.3s" />
      <Star className="absolute top-44 ltr:left-4 rtl:right-4 w-2 h-2" delay="1s" />
      <Star className="absolute top-72 ltr:right-5 rtl:left-5 w-1.5 h-1.5" delay="1.8s" />
      {/* Geometric patterns */}
      <GeometricPattern className="absolute bottom-24 ltr:left-2 rtl:right-2 w-10 h-10" />
      {/* Bottom crescent */}
      <Crescent className="absolute bottom-8 ltr:right-2 rtl:left-2 w-6 h-6 opacity-20" />
    </div>
  );
}

/* ── Main Content Background Decorations ── */
export function RamadanContentDecor() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {/* Corner decorations */}
      <GeometricPattern className="absolute top-4 ltr:right-4 rtl:left-4 w-16 h-16 opacity-[0.04]" />
      <GeometricPattern className="absolute bottom-8 ltr:left-8 rtl:right-8 w-20 h-20 opacity-[0.03]" />
      {/* Floating stars */}
      <Star className="absolute top-16 ltr:right-20 rtl:left-20 w-3 h-3 opacity-40" delay="0.5s" />
      <Star className="absolute top-40 ltr:left-16 rtl:right-16 w-2 h-2 opacity-30" delay="1.2s" />
      <Star className="absolute bottom-32 ltr:right-32 rtl:left-32 w-2.5 h-2.5 opacity-30" delay="2s" />
      {/* Crescent */}
      <Crescent className="absolute top-8 ltr:left-12 rtl:right-12 w-8 h-8 opacity-[0.07]" />
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
    <div className="relative mb-4 rounded-xl overflow-hidden" style={{
      background: 'linear-gradient(135deg, #61C9E0 0%, #6455F0 100%)',
    }}>
      {/* Subtle decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <Lantern className="absolute -top-2 ltr:left-6 rtl:right-6 w-6 h-12 opacity-50" />
        <Lantern className="absolute -top-2 ltr:left-20 rtl:right-20 w-5 h-10 opacity-30" />
        <Crescent className="absolute top-1 ltr:right-16 rtl:left-16 w-8 h-8 opacity-30" />
        <Star className="absolute top-2 ltr:right-28 rtl:left-28 w-3 h-3" delay="0s" />
        <Star className="absolute top-4 ltr:right-36 rtl:left-36 w-2 h-2" delay="1s" />
      </div>

      <div className="relative flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg">🌙</span>
          <p className="text-white font-semibold text-sm md:text-base">
            {isRTL ? 'رمضان كريم 🤲 كل عام وأنتم بخير' : 'Ramadan Kareem 🤲 Wishing you a blessed month'}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Auth Page Decorations (enhanced for full Ramadan look) ── */
export function RamadanAuthDecor() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1]">
      <Crescent className="absolute top-8 ltr:right-12 rtl:left-12 w-16 h-16 opacity-20" />
      <Lantern className="absolute top-4 ltr:left-8 rtl:right-8 w-8 h-16 opacity-20" />
      <Star className="absolute top-20 ltr:right-32 rtl:left-32 w-4 h-4" delay="0s" />
      <Star className="absolute top-16 ltr:left-24 rtl:right-24 w-3 h-3" delay="0.5s" />
      <Star className="absolute top-32 ltr:right-20 rtl:left-20 w-2.5 h-2.5" delay="1.2s" />
    </div>
  );
}

/* ── Auth Brand Panel Ramadan Overlay ── */
export function RamadanAuthBrandDecor() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1]">
      {/* Large crescent */}
      <Crescent className="absolute top-12 ltr:right-8 rtl:left-8 w-24 h-24 opacity-15" />
      {/* Lanterns hanging from top */}
      <Lantern className="absolute -top-2 ltr:left-12 rtl:right-12 w-8 h-16 opacity-40" />
      <Lantern className="absolute -top-2 ltr:left-32 rtl:right-32 w-6 h-12 opacity-25" />
      <Lantern className="absolute -top-2 ltr:right-16 rtl:left-16 w-7 h-14 opacity-30" />
      {/* Stars */}
      <Star className="absolute top-8 ltr:left-1/2 rtl:right-1/2 w-4 h-4" delay="0s" />
      <Star className="absolute top-24 ltr:right-24 rtl:left-24 w-3 h-3" delay="0.6s" />
      <Star className="absolute top-40 ltr:left-20 rtl:right-20 w-3.5 h-3.5" delay="1.3s" />
      <Star className="absolute bottom-32 ltr:right-12 rtl:left-12 w-2.5 h-2.5" delay="0.9s" />
      <Star className="absolute bottom-20 ltr:left-16 rtl:right-16 w-2 h-2" delay="1.7s" />
      {/* Geometric patterns in corners */}
      <GeometricPattern className="absolute bottom-12 ltr:left-8 rtl:right-8 w-16 h-16 opacity-[0.08]" />
      <GeometricPattern className="absolute top-1/3 ltr:right-4 rtl:left-4 w-12 h-12 opacity-[0.06]" />
    </div>
  );
}

/* ── Auth Ramadan Greeting (replaces subtitle during Ramadan) ── */
export function RamadanGreeting() {
  const { isRTL } = useLanguage();
  return (
    <p className="text-lg xl:text-xl text-white/90 leading-relaxed font-semibold">
      {isRTL ? '🌙 رمضان كريم — كل عام وأنتم بخير' : '🌙 Ramadan Kareem — Blessed Month'}
    </p>
  );
}
