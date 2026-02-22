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
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

function circlePath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
}

function drawGlassPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.save();

  // depth shadow
  ctx.shadowBlur = 24;
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowOffsetY = 10;

  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fill();

  // reset shadow
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // border
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // inner highlight
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "rgba(255,255,255,0.22)");
  g.addColorStop(0.35, "rgba(255,255,255,0.08)");
  g.addColorStop(1, "rgba(255,255,255,0.04)");
  ctx.fillStyle = g;
  roundRect(ctx, x + 2, y + 2, w - 4, h - 4, r - 2);
  ctx.fill();

  ctx.restore();
}

function drawInputPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  label: string,
  value: string,
  fontFamily: string,
) {
  ctx.save();

  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `600 20px ${fontFamily}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(label, x + 22, y + 14, w - 44);

  ctx.fillStyle = "#ffffff";
  ctx.font = `700 28px ${fontFamily}`;
  ctx.fillText(value, x + 22, y + 42, w - 44);

  ctx.restore();
}

export async function generateStudentIdCard(options: IdCardOptions): Promise<void> {
  const { name, email, password, avatarUrl, levelName, subscriptionType, attendanceMode, ageGroupName } = options;
  if (!password) return;

  const W = 1600;
  const H = 900;
  const SCALE = 3; // 3x resolution for ultra-high quality
  const PAD = 80;
  const RADIUS = 36;
  const FONT = "'Inter', 'Segoe UI', system-ui, sans-serif";

  const HEADER_H = 140;

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // clip card
  ctx.save();
  roundRect(ctx, 0, 0, W, H, RADIUS);
  ctx.clip();

  // background gradient using your theme
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#61C9E0");
  grad.addColorStop(0.6, "#6F7CF2");
  grad.addColorStop(1, "#6455F0");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // soft light blobs
  const blob1 = ctx.createRadialGradient(W * 0.18, H * 0.25, 20, W * 0.18, H * 0.25, 520);
  blob1.addColorStop(0, "rgba(255,255,255,0.22)");
  blob1.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = blob1;
  ctx.fillRect(0, 0, W, H);

  const blob2 = ctx.createRadialGradient(W * 0.85, H * 0.72, 20, W * 0.85, H * 0.72, 560);
  blob2.addColorStop(0, "rgba(0,0,0,0.14)");
  blob2.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = blob2;
  ctx.fillRect(0, 0, W, H);

  // header positions
  const headerY = PAD;
  const headerCenterY = headerY + HEADER_H / 2;

  // logo
  const logo = await loadImage("/kojobot-logo-white.png");
  if (logo) {
    const logoH = 70;
    const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
    ctx.globalAlpha = 0.95;
    ctx.drawImage(logo, PAD, headerCenterY - logoH / 2, logoW, logoH);
    ctx.globalAlpha = 1;
  }

  // level badge
  if (levelName) {
    ctx.font = `800 24px ${FONT}`;
    const tw = ctx.measureText(levelName).width;
    const pillW = tw + 62;
    const pillH = 54;
    const pillX = W - PAD - pillW;
    const pillY = headerCenterY - pillH / 2;

    const bg = ctx.createLinearGradient(pillX, pillY, pillX + pillW, pillY + pillH);
    bg.addColorStop(0, "rgba(255,255,255,0.22)");
    bg.addColorStop(1, "rgba(255,255,255,0.10)");
    roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(levelName, pillX + pillW / 2, pillY + pillH / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }

  // content bounds (panel under header)
  const contentTop = PAD + HEADER_H;
  const contentBottom = H - PAD;

  // main glass panel
  const panelX = PAD;
  const panelY = contentTop;
  const panelW = W - PAD * 2;
  const panelH = contentBottom - contentTop;
  drawGlassPanel(ctx, panelX, panelY, panelW, panelH, 40);

  // avatar
  const avatarSize = 260;
  const avatarX = panelX + 56;
  const avatarY = panelY + (panelH - avatarSize) / 2;
  const avatarCx = avatarX + avatarSize / 2;
  const avatarCy = avatarY + avatarSize / 2;
  const avatarR = avatarSize / 2;

  const avatarImg = avatarUrl ? await loadImage(avatarUrl, "anonymous") : null;

  // avatar glow
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.shadowBlur = 28;
  ctx.shadowColor = "rgba(255,255,255,0.25)";
  circlePath(ctx, avatarCx, avatarCy, avatarR + 6);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fill();
  ctx.restore();

  // avatar clip
  ctx.save();
  circlePath(ctx, avatarCx, avatarCy, avatarR);
  ctx.clip();

  if (avatarImg) {
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    const ag = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
    ag.addColorStop(0, "rgba(255,255,255,0.20)");
    ag.addColorStop(1, "rgba(255,255,255,0.06)");
    ctx.fillStyle = ag;
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);

    ctx.fillStyle = "#ffffff";
    ctx.font = `900 120px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name.trim().charAt(0).toUpperCase(), avatarCx, avatarCy);
  }
  ctx.restore();

  // avatar ring
  ctx.save();
  circlePath(ctx, avatarCx, avatarCy, avatarR + 2);
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // text area
  const textX = avatarX + avatarSize + 90;
  const maxTextW = panelX + panelW - textX - 56;

  // pills list prepared BEFORE centering calculations
  const pills: string[] = [];
  if (subscriptionType) {
    const subMap: Record<string, string> = {
      kojo_squad: "Kojo Squad",
      kojo_core: "Kojo Core",
      kojo_x: "Kojo X",
    };
    pills.push(subMap[subscriptionType] || subscriptionType);
  }
  if (attendanceMode) {
    pills.push(attendanceMode === "online" ? "🌐 Online" : "🏫 Offline");
  }
  if (ageGroupName) {
    pills.push(ageGroupName);
  }

  // center text block vertically inside the glass panel
  const NAME_H = 82;
  const DIVIDER_H = 28;
  const FIELD_H = 92;
  const GAP1 = 20;
  const GAP2 = 22;
  const PILLS_H = pills.length > 0 ? 46 : 0;
  const FOOTER_H = 28;

  const textBlockH = NAME_H + DIVIDER_H + FIELD_H + GAP1 + FIELD_H + GAP2 + PILLS_H + FOOTER_H;

  const textStartY = panelY + (panelH - textBlockH) / 2;

  // name
  let textY = textStartY;
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 60px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(name, textX, textY, maxTextW);
  textY += 82;

  // divider under name
  const lineW = Math.min(maxTextW, 640);
  const lineG = ctx.createLinearGradient(textX, textY, textX + lineW, textY);
  lineG.addColorStop(0, "rgba(255,255,255,0.55)");
  lineG.addColorStop(1, "rgba(255,255,255,0.05)");
  ctx.strokeStyle = lineG;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(textX, textY);
  ctx.lineTo(textX + lineW, textY);
  ctx.stroke();
  textY += 28;

  // modern fields
  const fieldW = Math.min(maxTextW, 720);
  const fieldH = 92;
  const fieldR = 24;

  drawInputPill(ctx, textX, textY, fieldW, fieldH, fieldR, "Email", email, FONT);
  textY += fieldH + 20;

  drawInputPill(ctx, textX, textY, fieldW, fieldH, fieldR, "Password", password, FONT);
  textY += fieldH + 22;

  // pills row
  if (pills.length > 0) {
    const pillY = textY;
    const pillH = 46;
    const pillGap = 14;
    let pillX = textX;

    ctx.font = `800 22px ${FONT}`;
    for (const label of pills) {
      const tw = ctx.measureText(label).width;
      const pw = tw + 44;

      if (pillX + pw > textX + fieldW) break;

      const pg = ctx.createLinearGradient(pillX, pillY, pillX + pw, pillY + pillH);
      pg.addColorStop(0, "rgba(255,255,255,0.18)");
      pg.addColorStop(1, "rgba(255,255,255,0.10)");

      roundRect(ctx, pillX, pillY, pw, pillH, pillH / 2);
      ctx.fillStyle = pg;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, pillX + pw / 2, pillY + pillH / 2);

      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      pillX += pw + pillGap;
    }
  }

  // footer inside the glass panel
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.font = `700 20px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("KOJOBOT ACADEMY", W / 2, panelY + panelH - 24);

  ctx.restore();

  // download
  return new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve();
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeName = name.replace(/[/\\:*?"<>|]/g, "_").trim();
      a.download = `${safeName}-id-card.png`;
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
