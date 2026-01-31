// Export utilities for Activity Log and other data

export const exportToCSV = (data: any[], filename: string, headers: { key: string; label: string }[]) => {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Create header row
  const headerRow = headers.map(h => h.label).join(',');
  
  // Create data rows
  const dataRows = data.map(row => {
    return headers.map(header => {
      let value = row[header.key];
      
      // Handle nested objects
      if (header.key.includes('.')) {
        const keys = header.key.split('.');
        value = keys.reduce((obj, key) => obj?.[key], row);
      }
      
      // Handle null/undefined
      if (value === null || value === undefined) {
        value = '';
      }
      
      // Handle objects
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      
      // Escape quotes and wrap in quotes if contains comma
      value = String(value);
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        value = `"${value.replace(/"/g, '""')}"`;
      }
      
      return value;
    }).join(',');
  }).join('\n');

  const csvContent = `${headerRow}\n${dataRows}`;
  
  // Create and download file
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportActivityLogs = (logs: any[], users: Record<string, { full_name: string }>, language: string) => {
  const headers = [
    { key: 'created_at', label: language === 'ar' ? 'التاريخ' : 'Date' },
    { key: 'user_name', label: language === 'ar' ? 'المستخدم' : 'User' },
    { key: 'action', label: language === 'ar' ? 'الإجراء' : 'Action' },
    { key: 'entity_type', label: language === 'ar' ? 'نوع الكيان' : 'Entity Type' },
    { key: 'entity_id', label: language === 'ar' ? 'معرف الكيان' : 'Entity ID' },
    { key: 'details', label: language === 'ar' ? 'التفاصيل' : 'Details' },
    { key: 'ip_address', label: language === 'ar' ? 'عنوان IP' : 'IP Address' },
  ];

  const enrichedLogs = logs.map(log => ({
    ...log,
    user_name: users[log.user_id]?.full_name || log.user_id,
    details: log.details ? JSON.stringify(log.details) : '',
  }));

  exportToCSV(enrichedLogs, 'activity_logs', headers);
};

export const exportStudentData = (students: any[], language: string) => {
  const headers = [
    { key: 'full_name', label: language === 'ar' ? 'الاسم' : 'Name' },
    { key: 'email', label: language === 'ar' ? 'البريد الإلكتروني' : 'Email' },
    { key: 'phone', label: language === 'ar' ? 'الهاتف' : 'Phone' },
    { key: 'age_group', label: language === 'ar' ? 'الفئة العمرية' : 'Age Group' },
    { key: 'level', label: language === 'ar' ? 'المستوى' : 'Level' },
    { key: 'subscription_status', label: language === 'ar' ? 'حالة الاشتراك' : 'Subscription Status' },
    { key: 'subscription_end', label: language === 'ar' ? 'تاريخ الانتهاء' : 'End Date' },
  ];

  exportToCSV(students, 'students', headers);
};

export const exportAttendance = (attendance: any[], language: string) => {
  const headers = [
    { key: 'student_name', label: language === 'ar' ? 'الطالب' : 'Student' },
    { key: 'session_date', label: language === 'ar' ? 'التاريخ' : 'Date' },
    { key: 'session_time', label: language === 'ar' ? 'الوقت' : 'Time' },
    { key: 'status', label: language === 'ar' ? 'الحالة' : 'Status' },
    { key: 'notes', label: language === 'ar' ? 'ملاحظات' : 'Notes' },
  ];

  exportToCSV(attendance, 'attendance', headers);
};
