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
