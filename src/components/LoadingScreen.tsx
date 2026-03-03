import { useLanguage } from "@/contexts/LanguageContext";

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  const { t } = useLanguage();

  return (
    <div
      className="min-h-screen flex items-center justify-center overflow-hidden"
      style={{
        background: "radial-gradient(ellipse 80% 60% at 50% 40%, #0f172a 0%, #020617 60%, #000000 100%)",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap');

        @keyframes orbit {
          from { transform: rotate(0deg) translateX(56px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(56px) rotate(-360deg); }
        }
        @keyframes orbit-reverse {
          from { transform: rotate(0deg) translateX(80px) rotate(0deg); }
          to   { transform: rotate(-360deg) translateX(80px) rotate(360deg); }
        }
        @keyframes orbit-slow {
          from { transform: rotate(45deg) translateX(104px) rotate(-45deg); }
          to   { transform: rotate(405deg) translateX(104px) rotate(-405deg); }
        }
        @keyframes logo-float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50%       { transform: translateY(-6px) scale(1.02); }
        }
        @keyframes ring-pulse {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50%       { opacity: 0.35; transform: scale(1.06); }
        }
        @keyframes ring-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes ring-spin-reverse {
          to { transform: rotate(-360deg); }
        }
        @keyframes text-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bar-fill {
          0%   { width: 0%; opacity: 0.4; }
          30%  { width: 45%; opacity: 1; }
          70%  { width: 75%; opacity: 1; }
          100% { width: 92%; opacity: 0.9; }
        }
        @keyframes dot-blink {
          0%, 80%, 100% { opacity: 0.15; transform: scaleY(0.6); }
          40%            { opacity: 1; transform: scaleY(1); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
        @keyframes star-twinkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50%       { opacity: 1; transform: scale(1); }
        }

        .orbit-dot-1 {
          animation: orbit 2.8s linear infinite;
        }
        .orbit-dot-2 {
          animation: orbit-reverse 4s linear infinite;
          animation-delay: -1.5s;
        }
        .orbit-dot-3 {
          animation: orbit-slow 6s linear infinite;
          animation-delay: -3s;
        }
        .ring-outer {
          animation: ring-spin 8s linear infinite;
        }
        .ring-mid {
          animation: ring-spin-reverse 5s linear infinite;
        }
        .logo-float {
          animation: logo-float 3.5s ease-in-out infinite;
        }
        .ring-glow {
          animation: ring-pulse 2.5s ease-in-out infinite;
        }
        .text-in {
          animation: text-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: 0.3s;
        }
        .bar-fill {
          animation: bar-fill 3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          animation-delay: 0.5s;
        }
        .bar-sheen {
          animation: ring-spin 2s linear infinite;
        }
        .glow-bg {
          animation: glow-pulse 2.5s ease-in-out infinite;
        }
      `}</style>

      {/* Ambient background glow */}
      <div
        className="glow-bg"
        style={{
          position: "fixed",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "600px",
          height: "400px",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Subtle star field */}
      {[...Array(16)].map((_, i) => (
        <div
          key={i}
          style={{
            position: "fixed",
            top: `${Math.sin((i * 137.5 * Math.PI) / 180) * 40 + 50}%`,
            left: `${Math.cos((i * 137.5 * Math.PI) / 180) * 45 + 50}%`,
            width: i % 3 === 0 ? "2px" : "1px",
            height: i % 3 === 0 ? "2px" : "1px",
            borderRadius: "50%",
            background: "rgba(148,163,184,0.6)",
            animation: `star-twinkle ${2 + (i % 4) * 0.8}s ease-in-out infinite`,
            animationDelay: `${i * 0.3}s`,
            pointerEvents: "none",
          }}
        />
      ))}

      <div style={{ textAlign: "center", position: "relative" }}>
        {/* Orbital system */}
        <div style={{ position: "relative", width: "240px", height: "240px", margin: "0 auto" }}>
          {/* Outermost ring — dashed arc */}
          <div
            className="ring-outer"
            style={{
              position: "absolute",
              inset: "0",
              borderRadius: "50%",
              border: "1px dashed rgba(99,102,241,0.2)",
            }}
          />

          {/* Middle ring — solid faint */}
          <div
            className="ring-mid"
            style={{
              position: "absolute",
              inset: "28px",
              borderRadius: "50%",
              border: "1px solid transparent",
              borderTopColor: "rgba(165,180,252,0.5)",
              borderRightColor: "rgba(165,180,252,0.2)",
            }}
          />

          {/* Glow ring behind logo */}
          <div
            className="ring-glow"
            style={{
              position: "absolute",
              inset: "64px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)",
            }}
          />

          {/* Orbiting dots */}
          <div
            style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <div className="orbit-dot-1" style={{ position: "absolute" }}>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #818cf8, #6366f1)",
                  boxShadow: "0 0 12px 3px rgba(99,102,241,0.6)",
                }}
              />
            </div>
          </div>

          <div
            style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <div className="orbit-dot-2" style={{ position: "absolute" }}>
              <div
                style={{
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  background: "#a5b4fc",
                  boxShadow: "0 0 8px 2px rgba(165,180,252,0.5)",
                }}
              />
            </div>
          </div>

          <div
            style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <div className="orbit-dot-3" style={{ position: "absolute" }}>
              <div
                style={{
                  width: "4px",
                  height: "4px",
                  borderRadius: "50%",
                  background: "rgba(165,180,252,0.7)",
                }}
              />
            </div>
          </div>

          {/* Logo */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div className="logo-float">
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "22px",
                  background: "linear-gradient(145deg, rgba(30,27,75,0.9), rgba(15,23,42,0.95))",
                  border: "1px solid rgba(99,102,241,0.35)",
                  boxShadow:
                    "0 0 40px rgba(99,102,241,0.25), 0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(165,180,252,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                <img
                  src="/favicon.ico"
                  alt="Kojobot"
                  width={52}
                  height={52}
                  loading="eager"
                  style={{ width: "52px", height: "52px", objectFit: "contain" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Text block */}
        <div className="text-in" style={{ marginTop: "40px" }}>
          {/* App name */}
          <p
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(99,102,241,0.8)",
              marginBottom: "8px",
            }}
          >
            KOJOBOT
          </p>

          {/* Loading message */}
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "15px",
              fontWeight: 300,
              color: "rgba(148,163,184,0.9)",
              letterSpacing: "0.01em",
              marginBottom: "24px",
            }}
          >
            {message || t.common.loading}
          </p>

          {/* Progress bar */}
          <div
            style={{
              width: "180px",
              margin: "0 auto",
              position: "relative",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "2px",
                borderRadius: "2px",
                background: "rgba(255,255,255,0.06)",
                overflow: "hidden",
              }}
            >
              <div
                className="bar-fill"
                style={{
                  height: "100%",
                  width: "0%",
                  borderRadius: "2px",
                  background:
                    "linear-gradient(90deg, rgba(99,102,241,0.4) 0%, #818cf8 50%, rgba(165,180,252,0.9) 100%)",
                  boxShadow: "0 0 8px rgba(129,140,248,0.6)",
                  position: "relative",
                }}
              />
            </div>
          </div>

          {/* Animated dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginTop: "20px" }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: "3px",
                  height: "12px",
                  borderRadius: "2px",
                  background: "rgba(129,140,248,0.7)",
                  animation: `dot-blink 1.4s ease-in-out infinite`,
                  animationDelay: `${i * 0.22}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
