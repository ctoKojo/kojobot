interface IdCardOptions {
  name: string;
  email: string;
  password: string;
  avatarUrl?: string | null;
  levelName?: string;
  subscriptionType?: string;
  attendanceMode?: string;
  ageGroupName?: string;
  // optional future
  qrText?: string;
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

function softShadow(ctx: CanvasRenderingContext2D, blur = 30, alpha = 0.22, y = 14) {
  ctx.shadowBlur = blur;
  ctx.shadowColor = `rgba(0,0,0,${alpha})`;
  ctx.shadowOffsetY = y;
}

function drawPill(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, text: string, font: string) {
  ctx.save();
  ctx.font = `800 ${Math.floor(h * 0.42)}px ${font}`;
  const tw = ctx.measureText(text).width;
  const w = tw + h * 1.1;

  roundRect(ctx, x, y, w, h, h / 2);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "rgba(255,255,255,0.20)");
  g.addColorStop(1, "rgba(255,255,255,0.08)");
  ctx.fillStyle = g;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h / 2);

  ctx.restore();
  return w;
}

function drawFieldCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  font: string,
) {
  ctx.save();

  // card
  softShadow(ctx, 26, 0.14, 10);
  roundRect(ctx, x, y, w, h, 26);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // subtle border
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = "rgba(15, 23, 42, 0.08)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // label
  ctx.fillStyle = "rgba(15, 23, 42, 0.55)";
  ctx.font = `700 20px ${font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(label, x + 26, y + 18, w - 52);

  // value
  ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
  ctx.font = `900 30px ${font}`;
  ctx.fillText(value, x + 26, y + 44, w - 52);

  ctx.restore();
}

function drawDiagonalPattern(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;

  const step = 36;
  for (let i = -h; i < w + h; i += step) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + h);
    ctx.lineTo(x + i + h, y);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawQrPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();

  roundRect(ctx, x, y, size, size, 18);
  ctx.fillStyle = "rgba(15, 23, 42, 0.04)";
  ctx.fill();

  ctx.strokeStyle = "rgba(15, 23, 42, 0.10)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // simple qr like blocks
  ctx.fillStyle = "rgba(15, 23, 42, 0.18)";
  const cell = size / 11;
  for (let r = 0; r < 11; r++) {
    for (let c = 0; c < 11; c++) {
      const on = (r * 7 + c * 13) % 5 === 0 || (r === c && r % 2 === 0);
      if (!on) continue;
      ctx.fillRect(x + c * cell + cell * 0.18, y + r * cell + cell * 0.18, cell * 0.64, cell * 0.64);
    }
  }

  ctx.restore();
}

export async function generateStudentIdCard(options: IdCardOptions): Promise<void> {
  const { name, email, password, avatarUrl, levelName, subscriptionType, attendanceMode, ageGroupName } = options;
  if (!password) return;

  // modern ratio portrait
  const W = 1080;
  const H = 1350;
  const SCALE = 3;
  const PAD = 64;
  const R = 48;
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

  // clip card
  ctx.save();
  roundRect(ctx, 0, 0, W, H, R);
  ctx.clip();

  // base bg
  ctx.fillStyle = "#0B1220";
  ctx.fillRect(0, 0, W, H);

  // split layout
  const leftW = Math.floor(W * 0.42);
  const rightW = W - leftW;

  // left gradient panel
  const lg = ctx.createLinearGradient(0, 0, leftW, H);
  lg.addColorStop(0, "#61C9E0");
  lg.addColorStop(0.55, "#6F7CF2");
  lg.addColorStop(1, "#6455F0");
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, leftW, H);

  // pattern + glow
  drawDiagonalPattern(ctx, 0, 0, leftW, H);

  const glow = ctx.createRadialGradient(leftW * 0.1, H * 0.2, 30, leftW * 0.1, H * 0.2, 520);
  glow.addColorStop(0, "rgba(255,255,255,0.28)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, leftW, H);

  // right clean panel
  ctx.save();
  softShadow(ctx, 40, 0.28, 18);
  roundRect(ctx, leftW - 24, 42, rightW + 24, H - 84, 44);
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = "rgba(15, 23, 42, 0.06)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // logo on left top
  const logo = await loadImage("/kojobot-logo-white.png");
  if (logo) {
    const logoH = 70;
    const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
    ctx.globalAlpha = 0.98;
    ctx.drawImage(logo, PAD, PAD - 6, logoW, logoH);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    ctx.font = `900 34px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("KOJOBOT", PAD, PAD);
  }

  // avatar big on left
  const avatarSize = 420;
  const avatarX = Math.floor((leftW - avatarSize) / 2);
  const avatarY = 220;
  const avatarCx = avatarX + avatarSize / 2;
  const avatarCy = avatarY + avatarSize / 2;
  const avatarR = avatarSize / 2;

  const avatarImg = avatarUrl ? await loadImage(avatarUrl, "anonymous") : null;

  // avatar shadow ring
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.shadowBlur = 40;
  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowOffsetY = 16;
  circlePath(ctx, avatarCx, avatarCy, avatarR + 10);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
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
    ag.addColorStop(0, "rgba(255,255,255,0.22)");
    ag.addColorStop(1, "rgba(255,255,255,0.08)");
    ctx.fillStyle = ag;
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);

    ctx.fillStyle = "#ffffff";
    ctx.font = `1000 160px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name.trim().charAt(0).toUpperCase(), avatarCx, avatarCy);
  }
  ctx.restore();

  // avatar outer ring
  ctx.save();
  circlePath(ctx, avatarCx, avatarCy, avatarR + 2);
  ctx.strokeStyle = "rgba(255,255,255,0.70)";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();

  // left bottom meta pills
  const meta: string[] = [];
  if (attendanceMode) meta.push(attendanceMode === "online" ? "🌐 Online" : "🏫 Offline");
  if (ageGroupName) meta.push(ageGroupName);

  const subMap: Record<string, string> = {
    kojo_squad: "Kojo Squad",
    kojo_core: "Kojo Core",
    kojo_x: "Kojo X",
  };
  if (subscriptionType) meta.push(subMap[subscriptionType] || subscriptionType);

  let pillY = avatarY + avatarSize + 56;
  const pillH = 58;
  for (const t of meta.slice(0, 4)) {
    const pillX = Math.floor((leftW - 10) / 2) - 260;
    const w = drawPill(ctx, Math.max(24, pillX), pillY, pillH, t, FONT);
    // center by shifting
    const cx = Math.floor((leftW - w) / 2);
    // redraw centered
    ctx.clearRect(0, pillY - 2, leftW, pillH + 4);
    drawPill(ctx, cx, pillY, pillH, t, FONT);
    pillY += pillH + 16;
  }

  // level badge top right on left panel
  if (levelName) {
    ctx.save();
    ctx.font = `900 26px ${FONT}`;
    const tw = ctx.measureText(levelName).width;
    const bw = tw + 64;
    const bh = 58;
    const bx = leftW - bw - 26;
    const by = 26;

    roundRect(ctx, bx, by, bw, bh, bh / 2);
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.26)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(levelName, bx + bw / 2, by + bh / 2);
    ctx.restore();
  }

  // right side content
  const rightX = leftW + 26;
  const rightTop = 110;
  const rightInnerW = rightW - 52;

  // name and headline
  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
  ctx.font = `1000 62px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(name, rightX, rightTop, rightInnerW);

  ctx.fillStyle = "rgba(15, 23, 42, 0.52)";
  ctx.font = `800 22px ${FONT}`;
  ctx.fillText("Student Access Card", rightX, rightTop + 74, rightInnerW);
  ctx.restore();

  // divider
  ctx.save();
  ctx.strokeStyle = "rgba(15, 23, 42, 0.08)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rightX, rightTop + 120);
  ctx.lineTo(rightX + rightInnerW, rightTop + 120);
  ctx.stroke();
  ctx.restore();

  // fields
  const cardW = rightInnerW;
  const cardH = 116;
  const gap = 22;

  const f1Y = rightTop + 150;
  drawFieldCard(ctx, rightX, f1Y, cardW, cardH, "Email", email, FONT);

  const f2Y = f1Y + cardH + gap;
  drawFieldCard(ctx, rightX, f2Y, cardW, cardH, "Password", password, FONT);

  // extras row
  const extraY = f2Y + cardH + 34;

  // mini cards
  const miniGap = 18;
  const miniW = Math.floor((cardW - miniGap) / 2);
  const miniH = 146;

  const leftMiniX = rightX;
  const rightMiniX = rightX + miniW + miniGap;

  const attText = attendanceMode ? (attendanceMode === "online" ? "Online" : "Offline") : "Mode";
  const subText = subscriptionType ? subMap[subscriptionType] || subscriptionType : "Subscription";

  drawFieldCard(ctx, leftMiniX, extraY, miniW, miniH, "Attendance", attText, FONT);
  drawFieldCard(ctx, rightMiniX, extraY, miniW, miniH, "Plan", subText, FONT);

  // QR placeholder
  const qrSize = 190;
  const qrX = rightX;
  const qrY = H - 84 - qrSize - 64;

  drawQrPlaceholder(ctx, qrX, qrY, qrSize);

  // footer text
  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.45)";
  ctx.font = `900 22px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText("KOJOBOT ACADEMY", qrX + qrSize + 26, qrY + qrSize - 8);

  ctx.fillStyle = "rgba(15, 23, 42, 0.40)";
  ctx.font = `700 18px ${FONT}`;
  ctx.fillText("Scan for quick verification", qrX + qrSize + 26, qrY + qrSize - 36);
  ctx.restore();

  // release clip
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
