interface IdCardOptions {
  name: string;
  email: string;
  password: string;
  avatarUrl?: string | null;
  levelName?: string;
}

function loadImage(src: string, crossOrigin?: string, timeoutMs = 5000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      resolve(null);
    }, timeoutMs);
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export async function generateStudentIdCard(options: IdCardOptions): Promise<void> {
  const { name, email, password, avatarUrl, levelName } = options;
  if (!password) return;

  const W = 1400;
  const H = 800;
  const PAD = 40;
  const RADIUS = 24;
  const FONT_STACK = "'Inter', 'Segoe UI', system-ui, sans-serif";

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Clip to rounded rect
  ctx.save();
  roundRect(ctx, 0, 0, W, H, RADIUS);
  ctx.clip();

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#7BB8D4');
  grad.addColorStop(1, '#8B7BE8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Load logo (same-origin, no CORS needed)
  const logo = await loadImage('/kojobot-logo-white.png');
  if (logo) {
    const logoH = 50;
    const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
    ctx.drawImage(logo, PAD, PAD, logoW, logoH);
  }

  // Level badge top-right
  if (levelName) {
    const badgeR = 40;
    const badgeCX = W - PAD - badgeR;
    const badgeCY = PAD + badgeR;
    ctx.beginPath();
    ctx.arc(badgeCX, badgeCY, badgeR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 18px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(levelName, badgeCX, badgeCY, badgeR * 1.6);
  }

  // Avatar area
  const avatarSize = 200;
  const avatarX = PAD + 40;
  const avatarY = 180;
  const avatarR = 24;

  const avatarImg = avatarUrl ? await loadImage(avatarUrl, 'anonymous') : null;

  ctx.save();
  roundRect(ctx, avatarX, avatarY, avatarSize, avatarSize, avatarR);
  ctx.clip();

  if (avatarImg) {
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    // Draw initial
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 80px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initial = name.trim().charAt(0).toUpperCase();
    ctx.fillText(initial, avatarX + avatarSize / 2, avatarY + avatarSize / 2);
  }
  ctx.restore();

  // Text area - right of avatar
  const textX = avatarX + avatarSize + 60;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Name
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 48px ${FONT_STACK}`;
  ctx.fillText(name, textX, 220, W - textX - PAD);

  // Email
  ctx.font = `28px ${FONT_STACK}`;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText(`Email:  ${email}`, textX, 300, W - textX - PAD);

  // Password
  ctx.fillText(`Password:  ${password}`, textX, 360, W - textX - PAD);

  // Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = `20px ${FONT_STACK}`;
  ctx.fillText('Kojobot Academy', W / 2, H - PAD - 20);

  ctx.restore(); // restore the main clip

  // Download
  return new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = name.replace(/[/\\:*?"<>|]/g, '_').trim();
      a.download = `${safeName}-id-card.png`;
      a.href = url;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
}
