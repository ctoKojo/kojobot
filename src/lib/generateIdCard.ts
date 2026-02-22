// ── Types ──
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

// ── Helper utilities ──

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function circlePath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
}

function drawGlassPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawInputPill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, label: string, value: string, font: string) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `700 16px ${font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(label, x + 18, y + 12);

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 22px ${font}`;
  ctx.textBaseline = "bottom";
  ctx.fillText(value, x + 18, y + h - 12, w - 36);
}

function loadImage(src: string, crossOrigin?: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// ── Main export ──

export async function generateStudentBusinessCard(options: IdCardOptions): Promise<void> {
  const { name, email, password, avatarUrl, levelName } = options;
  if (!password) return;

  const W = 1050;
  const H = 600;
  const SCALE = 3;
  const PAD = 44;
  const RADIUS = 34;
  const FONT = "'Inter', 'Segoe UI', system-ui, sans-serif";

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // card clip
  ctx.save();
  roundRect(ctx, 0, 0, W, H, RADIUS);
  ctx.clip();

  // background gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#61C9E0");
  grad.addColorStop(1, "#6455F0");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // subtle highlight
  const glow = ctx.createRadialGradient(W * 0.22, H * 0.25, 10, W * 0.22, H * 0.25, 520);
  glow.addColorStop(0, "rgba(255,255,255,0.22)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // main glass panel
  const panelX = PAD;
  const panelY = PAD;
  const panelW = W - PAD * 2;
  const panelH = H - PAD * 2;
  drawGlassPanel(ctx, panelX, panelY, panelW, panelH, 28);

  // logo
  const logo = await loadImage("/kojobot-logo-white.png");
  const logoX = panelX + 28;
  const logoY = panelY + 22;
  if (logo) {
    const logoH = 46;
    const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
    ctx.globalAlpha = 0.95;
    ctx.drawImage(logo, logoX, logoY, logoW, logoH);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `900 28px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Kojobot", logoX, logoY);
  }

  // level badge
  if (levelName) {
    ctx.font = `800 18px ${FONT}`;
    const tw = ctx.measureText(levelName).width;
    const pillH = 40;
    const pillW = tw + 46;
    const pillX = panelX + panelW - pillW - 26;
    const pillY = panelY + 22;

    const bg = ctx.createLinearGradient(pillX, pillY, pillX + pillW, pillY + pillH);
    bg.addColorStop(0, "rgba(255,255,255,0.22)");
    bg.addColorStop(1, "rgba(255,255,255,0.10)");
    roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.26)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(levelName, pillX + pillW / 2, pillY + pillH / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }

  // layout
  const topBarH = 88;
  const contentY = panelY + topBarH;
  const contentH = panelH - topBarH;

  // avatar
  const avatarSize = 220;
  const avatarX = panelX + 34;
  const avatarY = contentY + Math.floor((contentH - avatarSize) / 2);
  const avatarCx = avatarX + avatarSize / 2;
  const avatarCy = avatarY + avatarSize / 2;
  const avatarR = avatarSize / 2;

  const avatarImg = avatarUrl ? await loadImage(avatarUrl, "anonymous") : null;

  // avatar glow
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.shadowBlur = 22;
  ctx.shadowColor = "rgba(255,255,255,0.22)";
  circlePath(ctx, avatarCx, avatarCy, avatarR + 6);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fill();
  ctx.restore();

  ctx.save();
  circlePath(ctx, avatarCx, avatarCy, avatarR);
  ctx.clip();
  if (avatarImg) {
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    const ag = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
    ag.addColorStop(0, "rgba(255,255,255,0.18)");
    ag.addColorStop(1, "rgba(255,255,255,0.06)");
    ctx.fillStyle = ag;
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);

    ctx.fillStyle = "#ffffff";
    ctx.font = `900 96px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name.trim().charAt(0).toUpperCase(), avatarCx, avatarCy);
  }
  ctx.restore();

  // ring
  ctx.save();
  circlePath(ctx, avatarCx, avatarCy, avatarR + 2);
  ctx.strokeStyle = "rgba(255,255,255,0.60)";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // text area
  const textX = avatarX + avatarSize + 44;
  const textW = panelX + panelW - textX - 34;

  // name
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 42px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const nameY = contentY + 54;
  ctx.fillText(name, textX, nameY, textW);

  // divider
  const divY = nameY + 58;
  const lineW = Math.min(textW, 520);
  const lineG = ctx.createLinearGradient(textX, divY, textX + lineW, divY);
  lineG.addColorStop(0, "rgba(255,255,255,0.55)");
  lineG.addColorStop(1, "rgba(255,255,255,0.08)");
  ctx.strokeStyle = lineG;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(textX, divY);
  ctx.lineTo(textX + lineW, divY);
  ctx.stroke();

  // fields
  const fieldW = Math.min(textW, 560);
  const fieldH = 78;
  const fieldR = 22;

  const f1Y = divY + 20;
  drawInputPill(ctx, textX, f1Y, fieldW, fieldH, fieldR, "Email", email, FONT);

  const f2Y = f1Y + fieldH + 16;
  drawInputPill(ctx, textX, f2Y, fieldW, fieldH, fieldR, "Password", password, FONT);

  // footer
  ctx.fillStyle = "rgba(255,255,255,0.40)";
  ctx.font = `800 16px ${FONT}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("KOJOBOT ACADEMY", panelX + panelW - 26, panelY + panelH - 18);

  ctx.restore();

  return new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeName = name.replace(/[/\\:*?"<>|]/g, "_").trim();
      a.download = `${safeName}-business-card.png`;
      a.href = url;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png");
  });
}

// Alias for backward compatibility
export const generateStudentIdCard = generateStudentBusinessCard;
