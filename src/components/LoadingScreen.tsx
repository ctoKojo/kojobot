export function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6">
      <img
        src="/kojobot-logo-white.png"
        alt="Kojobot"
        className="w-28 h-28 rounded-2xl"
        loading="eager"
      />
      <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}
