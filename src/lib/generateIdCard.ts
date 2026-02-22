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

export async function generateStudentIdCard(options: IdCardOptions): Promise<void> {
  const W = 1600;
  const H = 900;
  const RADIUS = 36;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // clip rounded card
  ctx.save();
  roundRect(ctx, 0, 0, W, H, RADIUS);
  ctx.clip();

  // background gradient theme
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#61C9E0");
  grad.addColorStop(0.6, "#6F7CF2");
  grad.addColorStop(1, "#6455F0");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // soft blobs
  const blob1 = ctx.createRadialGradient(W * 0.18, H * 0.25, 10, W * 0.18, H * 0.25, 520);
  blob1.addColorStop(0, "rgba(255,255,255,0.22)");
  blob1.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = blob1;
  ctx.fillRect(0, 0, W, H);

  const blob2 = ctx.createRadialGradient(W * 0.86, H * 0.75, 10, W * 0.86, H * 0.75, 560);
  blob2.addColorStop(0, "rgba(0,0,0,0.16)");
  blob2.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = blob2;
  ctx.fillRect(0, 0, W, H);

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
      a.download = `id-card-background.png`;
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
