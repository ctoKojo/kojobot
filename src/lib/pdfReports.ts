// PDF-like report generation using browser print
// Opens a new window with formatted content ready for print/save as PDF

interface ReportOptions {
  title: string;
  subtitle?: string;
  logoUrl?: string;
  direction?: 'ltr' | 'rtl';
}

const getBaseStyles = (direction: string) => `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: ${direction}; padding: 40px; color: #1a1a2e; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #61BAE2; padding-bottom: 20px; }
    .header h1 { font-size: 24px; color: #1a1a2e; margin-bottom: 5px; }
    .header p { font-size: 14px; color: #666; }
    .logo { width: 60px; height: 60px; margin: 0 auto 10px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: linear-gradient(135deg, #61BAE2, #6455F0); color: white; padding: 10px 12px; text-align: ${direction === 'rtl' ? 'right' : 'left'}; font-size: 13px; }
    td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
    tr:nth-child(even) { background: #f8f9fa; }
    .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
    .stat-card { background: #f8f9fa; border-radius: 8px; padding: 15px; text-align: center; }
    .stat-card .value { font-size: 28px; font-weight: bold; color: #6455F0; }
    .stat-card .label { font-size: 12px; color: #666; margin-top: 4px; }
    .section-title { font-size: 18px; font-weight: bold; margin: 25px 0 10px; color: #1a1a2e; border-bottom: 2px solid #eee; padding-bottom: 5px; }
    .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 11px; color: #999; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge-success { background: #d4edda; color: #155724; }
    .badge-warning { background: #fff3cd; color: #856404; }
    .badge-danger { background: #f8d7da; color: #721c24; }
    @media print { body { padding: 20px; } }
  </style>
`;

const openPrintWindow = (content: string, options: ReportOptions) => {
  const win = window.open('', '_blank');
  if (!win) return;

  const dir = options.direction || 'ltr';
  const date = new Date().toLocaleDateString(dir === 'rtl' ? 'ar-EG' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  win.document.write(`
    <!DOCTYPE html>
    <html dir="${dir}">
    <head>
      <meta charset="UTF-8">
      <title>${options.title}</title>
      ${getBaseStyles(dir)}
    </head>
    <body>
      <div class="header">
        <h1>${options.title}</h1>
        ${options.subtitle ? `<p>${options.subtitle}</p>` : ''}
        <p>${date}</p>
      </div>
      ${content}
      <div class="footer">
        Kojobot &copy; ${new Date().getFullYear()} — ${dir === 'rtl' ? 'تم إنشاء التقرير تلقائياً' : 'Auto-generated report'}
      </div>
    </body>
    </html>
  `);
  win.document.close();
  setTimeout(() => win.print(), 500);
};

// Student Performance Report
export const generateStudentReport = (
  student: { name: string; email: string; group?: string; level?: string; ageGroup?: string },
  stats: {
    attendanceRate: number;
    quizAvg: number;
    assignmentAvg: number;
    totalSessions: number;
    presentSessions: number;
    warningsCount: number;
  },
  isRTL: boolean,
) => {
  const content = `
    <div class="stat-grid">
      <div class="stat-card">
        <div class="value">${stats.attendanceRate}%</div>
        <div class="label">${isRTL ? 'نسبة الحضور' : 'Attendance Rate'}</div>
      </div>
      <div class="stat-card">
        <div class="value">${stats.quizAvg}%</div>
        <div class="label">${isRTL ? 'متوسط الكويزات' : 'Quiz Average'}</div>
      </div>
      <div class="stat-card">
        <div class="value">${stats.assignmentAvg}%</div>
        <div class="label">${isRTL ? 'متوسط الواجبات' : 'Assignment Average'}</div>
      </div>
    </div>

    <div class="section-title">${isRTL ? 'معلومات الطالب' : 'Student Information'}</div>
    <table>
      <tr><td><strong>${isRTL ? 'الاسم' : 'Name'}</strong></td><td>${student.name}</td></tr>
      <tr><td><strong>${isRTL ? 'البريد الإلكتروني' : 'Email'}</strong></td><td>${student.email}</td></tr>
      ${student.group ? `<tr><td><strong>${isRTL ? 'المجموعة' : 'Group'}</strong></td><td>${student.group}</td></tr>` : ''}
      ${student.level ? `<tr><td><strong>${isRTL ? 'المستوى' : 'Level'}</strong></td><td>${student.level}</td></tr>` : ''}
      ${student.ageGroup ? `<tr><td><strong>${isRTL ? 'الفئة العمرية' : 'Age Group'}</strong></td><td>${student.ageGroup}</td></tr>` : ''}
    </table>

    <div class="section-title">${isRTL ? 'ملخص الأداء' : 'Performance Summary'}</div>
    <table>
      <tr><td>${isRTL ? 'الحصص المحضورة' : 'Sessions Attended'}</td><td>${stats.presentSessions} / ${stats.totalSessions}</td></tr>
      <tr><td>${isRTL ? 'عدد الإنذارات' : 'Warnings'}</td><td><span class="badge ${stats.warningsCount > 0 ? 'badge-danger' : 'badge-success'}">${stats.warningsCount}</span></td></tr>
    </table>
  `;

  openPrintWindow(content, {
    title: isRTL ? 'تقرير أداء الطالب' : 'Student Performance Report',
    subtitle: student.name,
    direction: isRTL ? 'rtl' : 'ltr',
  });
};

// Salary Slip
export const generateSalarySlip = (
  employee: { name: string; email: string; type: string },
  salary: {
    month: string;
    baseSalary: number;
    earnings: number;
    bonuses: number;
    deductions: number;
    netAmount: number;
  },
  isRTL: boolean,
) => {
  const content = `
    <div class="section-title">${isRTL ? 'معلومات الموظف' : 'Employee Information'}</div>
    <table>
      <tr><td><strong>${isRTL ? 'الاسم' : 'Name'}</strong></td><td>${employee.name}</td></tr>
      <tr><td><strong>${isRTL ? 'البريد الإلكتروني' : 'Email'}</strong></td><td>${employee.email}</td></tr>
      <tr><td><strong>${isRTL ? 'النوع' : 'Type'}</strong></td><td>${employee.type}</td></tr>
      <tr><td><strong>${isRTL ? 'الشهر' : 'Month'}</strong></td><td>${salary.month}</td></tr>
    </table>

    <div class="section-title">${isRTL ? 'تفاصيل الراتب' : 'Salary Details'}</div>
    <table>
      <tr><td>${isRTL ? 'الراتب الأساسي' : 'Base Salary'}</td><td>${salary.baseSalary.toFixed(2)} ${isRTL ? 'ج.م' : 'EGP'}</td></tr>
      <tr><td>${isRTL ? 'الأرباح (ساعات)' : 'Hourly Earnings'}</td><td>${salary.earnings.toFixed(2)} ${isRTL ? 'ج.م' : 'EGP'}</td></tr>
      <tr><td>${isRTL ? 'المكافآت' : 'Bonuses'}</td><td style="color: green;">+${salary.bonuses.toFixed(2)} ${isRTL ? 'ج.م' : 'EGP'}</td></tr>
      <tr><td>${isRTL ? 'الخصومات' : 'Deductions'}</td><td style="color: red;">-${salary.deductions.toFixed(2)} ${isRTL ? 'ج.م' : 'EGP'}</td></tr>
    </table>

    <div class="stat-grid" style="grid-template-columns: 1fr;">
      <div class="stat-card">
        <div class="value">${salary.netAmount.toFixed(2)}</div>
        <div class="label">${isRTL ? 'صافي الراتب (ج.م)' : 'Net Salary (EGP)'}</div>
      </div>
    </div>
  `;

  openPrintWindow(content, {
    title: isRTL ? 'كشف الراتب' : 'Salary Slip',
    subtitle: `${employee.name} — ${salary.month}`,
    direction: isRTL ? 'rtl' : 'ltr',
  });
};

// Student ID Card
interface StudentCardData {
  name: string;
  nameAr?: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  ageGroup?: string;
  level?: string;
  subscriptionType?: string;
  attendanceMode?: string;
  group?: string;
}

interface StudentCardOptions {
  password?: string;
  isRTL: boolean;
}

const isEmptyField = (val?: string) => !val || val === '-';

const loadImage = (src: string, timeout = 2000): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => { img.onload = null; img.onerror = null; resolve(null); }, timeout);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = src;
  });

const drawCardToCanvas = async (student: StudentCardData, options: StudentCardOptions): Promise<string> => {
  const W = 1016, H = 638, R = 24;
  const isRTL = options.isRTL;
  const headerH = Math.round(H * 0.35); // ~223px
  const font = "'Segoe UI', Tahoma, sans-serif";
  const marginX = 40;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Clip rounded rect for entire card
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, R);
  ctx.clip();

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Header gradient
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#61BAE2');
  grad.addColorStop(1, '#6455F0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, headerH);

  // --- Avatar ---
  const avatarSize = 100;
  const avatarX = isRTL ? W - marginX - avatarSize : marginX;
  const avatarY = (headerH - avatarSize) / 2;
  const avatarCX = avatarX + avatarSize / 2;
  const avatarCY = avatarY + avatarSize / 2;
  const avatarR = avatarSize / 2;

  let avatarImg: HTMLImageElement | null = null;
  if (student.avatarUrl) {
    avatarImg = await loadImage(student.avatarUrl);
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
  ctx.clip();

  if (avatarImg) {
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    const aGrad = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
    aGrad.addColorStop(0, '#61BAE2');
    aGrad.addColorStop(1, '#6455F0');
    ctx.fillStyle = aGrad;
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    const initial = (student.nameAr || student.name || '?').charAt(0);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 44px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, avatarCX, avatarCY);
  }
  ctx.restore();

  // White border around avatar
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
  ctx.stroke();

  // --- Name ---
  const nameX = isRTL ? avatarX - 20 : avatarX + avatarSize + 20;
  const nameAlign: CanvasTextAlign = isRTL ? 'right' : 'left';
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = nameAlign;

  const primaryName = isRTL ? (student.nameAr || student.name) : student.name;
  const secondaryName = isRTL
    ? (student.nameAr && student.name !== student.nameAr ? student.name : null)
    : (!isEmptyField(student.nameAr) ? student.nameAr : null);

  if (secondaryName) {
    ctx.font = `bold 32px ${font}`;
    ctx.fillText(primaryName, nameX, headerH / 2 - 16, W - avatarSize - marginX * 2 - 80);
    ctx.font = `22px ${font}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(secondaryName, nameX, headerH / 2 + 20, W - avatarSize - marginX * 2 - 80);
  } else {
    ctx.font = `bold 32px ${font}`;
    ctx.fillText(primaryName, nameX, headerH / 2, W - avatarSize - marginX * 2 - 80);
  }

  // --- Kojobot vertical text ---
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `12px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const kojoX = isRTL ? 18 : W - 18;
  ctx.translate(kojoX, headerH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Kojobot', 0, 0);
  ctx.restore();

  // --- Fields section ---
  const labels = isRTL
    ? { email: 'الإيميل', phone: 'الهاتف', age: 'الفئة العمرية', level: 'المستوى', sub: 'الاشتراك', mode: 'الحضور', group: 'المجموعة', pw: 'كلمة المرور' }
    : { email: 'Email', phone: 'Phone', age: 'Age Group', level: 'Level', sub: 'Subscription', mode: 'Attendance', group: 'Group', pw: 'Password' };

  const fields: [string, string | undefined][] = [
    [labels.email, student.email],
    [labels.phone, student.phone],
    [labels.age, student.ageGroup],
    [labels.level, student.level],
    [labels.sub, student.subscriptionType],
    [labels.mode, student.attendanceMode],
    [labels.group, student.group],
  ];

  const fieldX = isRTL ? W - marginX : marginX;
  const fieldAlign: CanvasTextAlign = isRTL ? 'right' : 'left';
  let fieldY = headerH + 30;
  const lineH = 34;

  for (const [label, value] of fields) {
    if (isEmptyField(value)) continue;
    ctx.textAlign = fieldAlign;
    ctx.textBaseline = 'top';

    // Label
    ctx.fillStyle = '#666666';
    ctx.font = `13px ${font}`;
    const labelText = `${label}: `;
    const labelWidth = ctx.measureText(labelText).width;

    ctx.fillText(labelText, fieldX, fieldY);

    // Value
    ctx.fillStyle = '#1a1a2e';
    ctx.font = `bold 14px ${font}`;
    const valueX = isRTL ? fieldX - labelWidth : fieldX + labelWidth;
    ctx.fillText(value!, valueX, fieldY, W - marginX * 2 - labelWidth);

    fieldY += lineH;
  }

  // --- Password ---
  if (!isEmptyField(options.password)) {
    fieldY += 4;
    const pwBoxH = 34;
    const pwBoxW = W - marginX * 2;
    const pwBoxX = marginX;

    // Rounded rect background
    ctx.fillStyle = '#fff3cd';
    ctx.beginPath();
    ctx.roundRect(pwBoxX, fieldY, pwBoxW, pwBoxH, 6);
    ctx.fill();

    const pwTextY = fieldY + pwBoxH / 2;
    ctx.textBaseline = 'middle';
    ctx.textAlign = fieldAlign;

    const pwLabelText = `${labels.pw}: `;
    ctx.fillStyle = '#856404';
    ctx.font = `13px ${font}`;
    const pwLabelW = ctx.measureText(pwLabelText).width;
    const pwFieldX = isRTL ? W - marginX - 10 : marginX + 10;
    ctx.fillText(pwLabelText, pwFieldX, pwTextY);

    ctx.font = `bold 14px monospace`;
    const pwValueX = isRTL ? pwFieldX - pwLabelW : pwFieldX + pwLabelW;
    ctx.fillText(options.password!, pwValueX, pwTextY);
  }

  return canvas.toDataURL('image/png');
};

export const generateStudentCard = async (student: StudentCardData, options: StudentCardOptions) => {
  const isRTL = options.isRTL;
  const studentLabel = isRTL ? 'نسخة الطالب' : 'Student Copy';
  const archiveLabel = isRTL ? 'نسخة الأرشيف' : 'Archive Copy';

  const dataURL = await drawCardToCanvas(student, options);

  const content = `
    <style>
      .card-img { display: block; width: 86mm; height: 54mm; margin: 3mm auto; }
      .copy-label { text-align: center; font-size: 10px; color: #999; margin: 8mm auto 1mm; }
      body { line-height: 1.6; }
      @media print { body { margin: 5mm; } }
    </style>
    <div class="copy-label">${studentLabel}</div>
    <img class="card-img" src="${dataURL}" />
    <div class="copy-label">${archiveLabel}</div>
    <img class="card-img" src="${dataURL}" />
  `;

  openPrintWindow(content, {
    title: isRTL ? 'بطاقة هوية الطالب' : 'Student ID Card',
    subtitle: student.name,
    direction: isRTL ? 'rtl' : 'ltr',
  });
};

// Generic Data Export as printable report
export const generateDataReport = (
  title: string,
  headers: { key: string; label: string }[],
  data: any[],
  isRTL: boolean,
) => {
  const tableHeader = headers.map(h => `<th>${h.label}</th>`).join('');
  const tableRows = data.map(row => {
    const cells = headers.map(h => {
      let value = h.key.includes('.') 
        ? h.key.split('.').reduce((obj, key) => obj?.[key], row)
        : row[h.key];
      if (value === null || value === undefined) value = '-';
      return `<td>${value}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const content = `
    <p style="margin-bottom: 15px; color: #666; font-size: 13px;">
      ${isRTL ? `إجمالي السجلات: ${data.length}` : `Total records: ${data.length}`}
    </p>
    <table>
      <thead><tr>${tableHeader}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;

  openPrintWindow(content, {
    title,
    direction: isRTL ? 'rtl' : 'ltr',
  });
};
