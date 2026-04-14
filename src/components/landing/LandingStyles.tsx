interface LandingStylesProps {
  isRTL: boolean;
}

export const LandingStyles = ({ isRTL }: LandingStylesProps) => (
  <style>{`
    :root {
      --kojo-bg: #070714;
      --kojo-surface: #0e0e2a;
      --kojo-border: rgba(100,85,240,0.15);
      --kojo-violet: #6455F0;
      --kojo-pink: #61BAE2;
      --kojo-cyan: #61BAE2;
      --kojo-gold: #f59e0b;
      --kojo-text: #f0f0ff;
      --kojo-muted: rgba(240,240,255,0.45);
    }

    * { box-sizing: border-box; }

    .kojo-root {
      background: var(--kojo-bg);
      color: var(--kojo-text);
      font-family: ${isRTL ? "'Cairo'" : "'Poppins'"}, sans-serif;
      min-height: 100vh;
      overflow-x: hidden;
    }

    .font-display {
      font-family: ${isRTL ? "'Cairo'" : "'Poppins'"}, sans-serif;
      font-weight: 800;
    }

    .grad-text {
      background: linear-gradient(135deg, var(--kojo-pink) 0%, var(--kojo-violet) 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }
    .grad-btn {
      background: linear-gradient(135deg, var(--kojo-pink), var(--kojo-violet));
      border: none; color: #fff; position: relative; overflow: hidden;
      transition: transform .2s, box-shadow .2s;
    }
    .grad-btn::after {
      content:''; position:absolute; inset:0;
      background: linear-gradient(135deg, rgba(255,255,255,0.15), transparent);
      opacity:0; transition: opacity .2s;
    }
    .grad-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(100,85,240,.45); }
    .grad-btn:hover::after { opacity:1; }
    .plan-cta-btn {
      transition: transform .2s, box-shadow .2s, border-color .2s, background .2s;
    }
    .plan-cta-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(100,85,240,.3);
      border-color: rgba(100,85,240,.5) !important;
      background: rgba(100,85,240,.12) !important;
    }

    .card {
      background: var(--kojo-surface);
      border: 1px solid var(--kojo-border);
      border-radius: 20px;
      transition: transform .3s, border-color .3s, box-shadow .3s;
    }
    .card:hover {
      transform: translateY(-6px);
      border-color: rgba(100,85,240,.4);
      box-shadow: 0 20px 60px rgba(100,85,240,.12), 0 0 0 1px rgba(100,85,240,.08);
    }

    .kojo-root::before {
      content: '';
      position: fixed; inset: 0; z-index: 0; pointer-events: none;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
      background-repeat: repeat; background-size: 200px 200px; opacity:.4;
    }

    .kojo-nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      padding: 0 24px; height: 68px; display: flex; align-items: center; justify-content: space-between;
      transition: background .3s, backdrop-filter .3s, border-color .3s;
    }
    .kojo-nav.scrolled {
      background: rgba(7,7,20,0.85);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--kojo-border);
    }

    .hero-glow {
      position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none;
    }
    .badge-pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 16px; border-radius: 999px;
      background: rgba(100,85,240,.12); border: 1px solid rgba(100,85,240,.3);
      font-size: 13px; font-weight: 500; color: rgba(240,240,255,.8);
      margin-bottom: 24px;
    }
    .badge-pill span.dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--kojo-violet); display: inline-block;
      animation: pulse-dot 1.8s ease-in-out infinite;
    }
    @keyframes pulse-dot {
      0%,100% { opacity:1; transform:scale(1); }
      50% { opacity:.4; transform:scale(.6); }
    }

    .stat-bar {
      display: flex; align-items: center; gap: 40px;
      padding: 20px 32px; border-radius: 16px;
      background: rgba(255,255,255,.025);
      border: 1px solid var(--kojo-border);
      backdrop-filter: blur(10px);
      flex-wrap: wrap; justify-content: center;
    }
    .stat-item { text-align: center; }
    .stat-num { font-size: 28px; font-weight: 800; line-height: 1; }
    .stat-label { font-size: 12px; color: var(--kojo-muted); margin-top: 4px; }

    .section-label {
      display: inline-block;
      padding: 4px 14px; border-radius: 999px;
      font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
      background: rgba(100,85,240,.1); border: 1px solid rgba(100,85,240,.25);
      color: var(--kojo-violet); margin-bottom: 16px;
    }

    .icon-wrap {
      width: 48px; height: 48px; border-radius: 14px;
      background: linear-gradient(135deg, var(--kojo-violet), var(--kojo-pink));
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 16px; flex-shrink: 0;
      box-shadow: 0 8px 24px rgba(100,85,240,.3);
      transition: transform .25s;
    }
    .card:hover .icon-wrap { transform: scale(1.1) rotate(-4deg); }

    .plan-featured {
      background: linear-gradient(160deg, rgba(100,85,240,.15) 0%, rgba(97,186,226,.08) 100%);
      border: 1px solid rgba(100,85,240,.4) !important;
      box-shadow: 0 0 60px rgba(100,85,240,.12);
    }
    .plan-featured:hover { box-shadow: 0 24px 80px rgba(100,85,240,.22); }

    .timeline-line {
      position: absolute; top: 0; bottom: 0; width: 2px;
      background: linear-gradient(to bottom, var(--kojo-violet), var(--kojo-pink), var(--kojo-cyan));
      left: 23px;
    }
    [dir="rtl"] .timeline-line { left: auto; right: 23px; }

    .faq-item {
      background: var(--kojo-surface); border: 1px solid var(--kojo-border);
      border-radius: 16px; margin-bottom: 10px; overflow: hidden;
      transition: border-color .3s;
    }
    .faq-item:hover { border-color: rgba(100,85,240,.3); }

    .contact-card {
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      padding: 28px 20px; border-radius: 20px;
      background: var(--kojo-surface); border: 1px solid var(--kojo-border);
      text-decoration: none; color: inherit;
      transition: transform .3s, border-color .3s, box-shadow .3s;
      text-align: center;
    }
    .contact-card:hover {
      transform: translateY(-6px);
      border-color: rgba(100,85,240,.4);
      box-shadow: 0 20px 50px rgba(100,85,240,.15);
    }
    .contact-icon {
      width: 60px; height: 60px; border-radius: 16px;
      background: linear-gradient(135deg, var(--kojo-violet), var(--kojo-pink));
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 24px rgba(100,85,240,.3);
      transition: transform .25s;
    }
    .contact-card:hover .contact-icon { transform: scale(1.1); }

    .kojo-footer {
      border-top: 1px solid var(--kojo-border);
      padding: 32px 24px;
      background: rgba(14,14,42,.6);
    }

    .reveal { opacity: 0; transform: translateY(32px); transition: opacity .7s ease, transform .7s ease; }
    .reveal.visible { opacity: 1; transform: none; }

    [role="tablist"] {
      background: rgba(14,14,42,.8) !important;
      border: 1px solid var(--kojo-border) !important;
      border-radius: 12px !important; padding: 4px !important;
    }
    [role="tab"][data-state="active"] {
      background: linear-gradient(135deg, var(--kojo-pink), var(--kojo-violet)) !important;
      color: #fff !important; border-radius: 9px !important;
    }
    [role="tab"] { color: var(--kojo-muted) !important; transition: color .2s !important; border-radius: 9px !important; }
    [role="tab"]:hover { color: var(--kojo-text) !important; }

    [data-radix-accordion-item] { background: none !important; border: none !important; }
    [data-radix-accordion-trigger] { color: var(--kojo-text) !important; }
    [data-radix-accordion-content] { color: var(--kojo-muted) !important; }

    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(100,85,240,.4); border-radius: 4px; }

    .check-row { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; margin-bottom: 10px; }
    .check-icon { width: 18px; height: 18px; border-radius: 50%; background: rgba(100,85,240,.2);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }

    @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
    .float { animation: float 4s ease-in-out infinite; }

    .mobile-menu-overlay {
      position: fixed; inset: 0; z-index: 200;
      background: rgba(7,7,20,0.92); backdrop-filter: blur(20px);
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px;
    }
    .mobile-menu-btn {
      background: none; border: none; cursor: pointer; color: var(--kojo-text);
      display: none; padding: 8px;
    }

    @media (max-width: 768px) {
      .mobile-menu-btn { display: flex; }
      .kojo-nav { padding: 0 16px; height: 56px; }
      .stat-bar { gap: 16px; padding: 16px 20px; }
      .stat-num { font-size: 22px !important; }
      .stat-label { font-size: 11px; }
      .section-pad { padding: 60px 16px !important; }
      .branch-grid { grid-template-columns: 1fr !important; }
      .contact-grid { grid-template-columns: repeat(2, 1fr) !important; }
      .hero-section { padding-top: 110px !important; padding-bottom: 60px !important; }
      .hero-logo { width: 80px !important; }
      .badge-pill { font-size: 11px; padding: 4px 12px; }
      [role="tablist"] {
        display: flex !important;
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        white-space: nowrap;
        max-width: 100% !important;
      }
      [role="tablist"]::-webkit-scrollbar { display: none; }
      [role="tab"] { flex-shrink: 0 !important; font-size: 12px !important; padding: 6px 12px !important; }
      .contact-card { padding: 20px 12px !important; }
      .contact-icon { width: 48px !important; height: 48px !important; border-radius: 12px !important; }
      .contact-icon svg { width: 22px !important; height: 22px !important; }
      .kojo-footer > div { flex-direction: column !important; align-items: center !important; text-align: center; gap: 12px !important; }
      .plan-card-grid { grid-template-columns: 1fr !important; }
      .timeline-line { left: 15px !important; }
      [dir="rtl"] .timeline-line { left: auto !important; right: 15px !important; }
    }
    @media (max-width: 480px) {
      .stat-bar { gap: 10px; padding: 14px 12px; flex-wrap: wrap; justify-content: center; }
      .stat-item { min-width: 65px; }
      .contact-grid { grid-template-columns: 1fr 1fr !important; }
      .hero-section { padding-top: 90px !important; padding-bottom: 40px !important; }
      .faq-item { padding: 0 14px !important; }
      [role="tab"] { font-size: 11px !important; padding: 5px 10px !important; }
    }
    @media (min-width: 769px) and (max-width: 1024px) {
      .section-pad { padding: 80px 20px !important; }
      .stat-bar { gap: 28px; }
      .contact-grid { grid-template-columns: repeat(3, 1fr) !important; }
    }
  `}</style>
);
