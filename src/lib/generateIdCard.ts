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
  const PAD = 60;
  const RADIUS = 28;
  const FONT = "'Inter', 'Segoe UI', system-ui, sans-serif";

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Clip rounded card
  ctx.save();
  roundRect(ctx, 0, 0, W, H, RADIUS);
  ctx.clip();

  // Background gradient (left-to-right, blue to purple)
  const grad = ctx.createLinearGradient(0, 0, W, H * 0.4);
  grad.addColorStop(0, '#7BB8D4');
  grad.addColorStop(1, '#8B7BE8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle decorative circles
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.beginPath();
  ctx.arc(W * 0.85, H * 0.7, 250, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.15, H * 0.9, 180, 0, Math.PI * 2);
  ctx.fill();

  // ── Logo top-left ──
  const logo = await loadImage('/kojobot-logo-white.png');
  if (logo) {
    const logoH = 55;
    const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
    ctx.drawImage(logo, PAD, PAD, logoW, logoH);
  }

  // ── Level badge top-right (pill shape) ──
  if (levelName) {
    ctx.font = `bold 22px ${FONT}`;
    const textWidth = ctx.measureText(levelName).width;
    const pillW = textWidth + 48;
    const pillH = 44;
    const pillX = W - PAD - pillW;
    const pillY = PAD + 5;

    roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(levelName, pillX + pillW / 2, pillY + pillH / 2);
  }

  // ── Avatar ──
  const avatarSize = 220;
  const avatarX = PAD + 20;
  const avatarY = 170;
  const avatarR = 28;

  const avatarImg = avatarUrl ? await loadImage(avatarUrl, 'anonymous') : null;

  // Avatar shadow
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  roundRect(ctx, avatarX + 4, avatarY + 6, avatarSize, avatarSize, avatarR);
  ctx.fill();

  ctx.save();
  roundRect(ctx, avatarX, avatarY, avatarSize, avatarSize, avatarR);
  ctx.clip();

  if (avatarImg) {
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    // Fallback: frosted glass + initial
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 90px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      name.trim().charAt(0).toUpperCase(),
      avatarX + avatarSize / 2,
      avatarY + avatarSize / 2,
    );
  }
  ctx.restore();

  // ── Text area (right of avatar) ──
  const textX = avatarX + avatarSize + 70;
  const maxTextW = W - textX - PAD;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Student name
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 52px ${FONT}`;
  ctx.fillText(name, textX, 195, maxTextW);

  // Divider line under name
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(textX, 268);
  ctx.lineTo(textX + Math.min(maxTextW, 500), 268);
  ctx.stroke();

  // Email label + value
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `24px ${FONT}`;
  ctx.fillText('Email', textX, 295);
  ctx.fillStyle = '#ffffff';
  ctx.font = `30px ${FONT}`;
  ctx.fillText(email, textX, 330, maxTextW);

  // Password label + value
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `24px ${FONT}`;
  ctx.fillText('Password', textX, 390);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 32px ${FONT}`;
  ctx.fillText(password, textX, 425, maxTextW);

  // ── Footer ──
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = `20px ${FONT}`;
  ctx.fillText('Kojobot Academy', W / 2, H - PAD + 10);

  // Footer line
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, H - PAD - 20);
  ctx.lineTo(W - PAD, H - PAD - 20);
  ctx.stroke();

  ctx.restore();

  // ── Download ──
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
