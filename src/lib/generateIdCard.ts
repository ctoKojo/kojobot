interface IdCardOptions {
  name: string;
  email: string;
  password: string;
  avatarUrl?: string | null;
  levelName?: string;
  subscriptionType?: string;
  attendanceMode?: string;
  ageGroupName?: string;
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
  const { name, email, password, avatarUrl, levelName, subscriptionType, attendanceMode, ageGroupName } = options;
  if (!password) return;

  const W = 1600;
  const H = 900;
  const PAD = 80;
  const RADIUS = 32;
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
  ctx.arc(W * 0.85, H * 0.7, 280, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.15, H * 0.9, 200, 0, Math.PI * 2);
  ctx.fill();

  // ── Logo top-left ──
  const logo = await loadImage('/kojobot-logo-white.png');
  if (logo) {
    const logoH = 60;
    const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
    ctx.drawImage(logo, PAD, PAD, logoW, logoH);
  }

  // ── Level badge top-right (pill shape) ──
  if (levelName) {
    ctx.font = `bold 24px ${FONT}`;
    const textWidth = ctx.measureText(levelName).width;
    const pillW = textWidth + 56;
    const pillH = 50;
    const pillX = W - PAD - pillW;
    const pillY = PAD;

    roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 24px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(levelName, pillX + pillW / 2, pillY + pillH / 2);
  }

  // ── Avatar ──
  const avatarSize = 240;
  const avatarX = PAD + 20;
  const avatarY = 190;
  const avatarR = 32;

  const avatarImg = avatarUrl ? await loadImage(avatarUrl, 'anonymous') : null;

  // Avatar shadow
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  roundRect(ctx, avatarX + 5, avatarY + 7, avatarSize, avatarSize, avatarR);
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
    ctx.font = `bold 100px ${FONT}`;
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
  const textX = avatarX + avatarSize + 90;
  const maxTextW = W - textX - PAD;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Student name
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 52px ${FONT}`;
  ctx.fillText(name, textX, 200, maxTextW);

  // Divider line under name
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(textX, 270);
  ctx.lineTo(textX + Math.min(maxTextW, 540), 270);
  ctx.stroke();

  // Info rows
  let rowY = 300;
  const labelFont = `24px ${FONT}`;
  const valueFont = `30px ${FONT}`;
  const rowGap = 70;

  const drawField = (label: string, value: string) => {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = labelFont;
    ctx.fillText(label, textX, rowY);
    ctx.fillStyle = '#ffffff';
    ctx.font = valueFont;
    ctx.fillText(value, textX, rowY + 30, maxTextW);
    rowY += rowGap;
  };

  drawField('Email', email);
  drawField('Password', password);

  // ── Info pills row (subscription type, attendance mode, age group) ──
  const pills: string[] = [];
  if (subscriptionType) {
    const subMap: Record<string, string> = {
      kojo_squad: 'Kojo Squad',
      kojo_core: 'Kojo Core',
      kojo_x: 'Kojo X',
    };
    pills.push(subMap[subscriptionType] || subscriptionType);
  }
  if (attendanceMode) {
    pills.push(attendanceMode === 'online' ? '🌐 Online' : '🏫 Offline');
  }
  if (ageGroupName) {
    pills.push(ageGroupName);
  }

  if (pills.length > 0) {
    const pillY = rowY + 20;
    const pillH = 44;
    const pillGap = 18;
    let pillX = textX;
    ctx.font = `bold 22px ${FONT}`;

    for (const label of pills) {
      const tw = ctx.measureText(label).width;
      const pw = tw + 40;
      roundRect(ctx, pillX, pillY, pw, pillH, pillH / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, pillX + pw / 2, pillY + pillH / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      pillX += pw + pillGap;
    }
  }

  // ── Footer ──
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, H - PAD - 30);
  ctx.lineTo(W - PAD, H - PAD - 30);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = `22px ${FONT}`;
  ctx.fillText('Kojobot Academy', W / 2, H - PAD + 5);

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
