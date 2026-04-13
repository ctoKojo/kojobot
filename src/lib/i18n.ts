export type Language = 'en' | 'ar';

interface Translations {
  common: {
    loading: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    add: string;
    search: string;
    filter: string;
    export: string;
    actions: string;
    back: string;
    next: string;
    submit: string;
    confirm: string;
    close: string;
    yes: string;
    no: string;
    all: string;
    none: string;
    success: string;
    error: string;
    warning: string;
    info: string;
  };
  auth: {
    login: string;
    logout: string;
    signup: string;
    email: string;
    password: string;
    confirmPassword: string;
    forgotPassword: string;
    resetPassword: string;
    welcomeBack: string;
    loginSubtitle: string;
    createAccount: string;
    signupSubtitle: string;
    alreadyHaveAccount: string;
    dontHaveAccount: string;
    loginError: string;
    signupSuccess: string;
    passwordMismatch: string;
    invalidEmail: string;
    passwordTooShort: string;
  };
  roles: {
    admin: string;
    instructor: string;
    student: string;
    reception: string;
    parent: string;
  };
  nav: {
    dashboard: string;
    students: string;
    instructors: string;
    groups: string;
    quizzes: string;
    assignments: string;
    attendance: string;
    settings: string;
    ageGroups: string;
    levels: string;
    activityLog: string;
    notifications: string;
    profile: string;
    questionBank: string;
  };
  dashboard: {
    welcome: string;
    totalStudents: string;
    totalInstructors: string;
    totalGroups: string;
    activeSubscriptions: string;
    expiringSubscriptions: string;
    recentActivity: string;
    upcomingSessions: string;
    pendingAssignments: string;
    attendanceRate: string;
  };
  students: {
    title: string;
    addStudent: string;
    editStudent: string;
    fullName: string;
    ageGroup: string;
    level: string;
    group: string;
    subscription: string;
    subscriptionStart: string;
    subscriptionEnd: string;
    amountPaid: string;
    amountRemaining: string;
    renewalDate: string;
    warnings: string;
    attendedSessions: string;
    missedSessions: string;
  };
  instructors: {
    title: string;
    addInstructor: string;
    editInstructor: string;
    specializations: string;
    assignedGroups: string;
    employeesTitle: string;
    addEmployee: string;
    editEmployee: string;
    employeeType: string;
    allEmployees: string;
    instructorsOnly: string;
    receptionOnly: string;
  };
  groups: {
    title: string;
    addGroup: string;
    editGroup: string;
    groupName: string;
    schedule: string;
    duration: string;
    instructor: string;
    studentCount: string;
    sessions: string;
    attendanceMode: string;
    online: string;
    offline: string;
    sessionLink: string;
    copyLink: string;
    joinSession: string;
    linkCopied: string;
    groupStatus: string;
    newGroup: string;
    existingGroup: string;
    nextSessionNumber: string;
    nextSessionDate: string;
    sessionsPassed: string;
    sessionsRemaining: string;
    progress: string;
    selectDate: string;
  };
  ageGroups: {
    title: string;
    addAgeGroup: string;
    editAgeGroup: string;
    minAge: string;
    maxAge: string;
  };
  levels: {
    title: string;
    addLevel: string;
    editLevel: string;
    levelName: string;
    track: string;
    software: string;
    hardware: string;
    parentLevel: string;
  };
  attendance: {
    title: string;
    present: string;
    absent: string;
    excused: string;
    late: string;
    markAttendance: string;
    sessionDate: string;
  };
  quizzes: {
    title: string;
    addQuiz: string;
    editQuiz: string;
    assignQuiz: string;
    quizName: string;
    questions: string;
    duration: string;
    dueDate: string;
    score: string;
    passed: string;
    failed: string;
    pending: string;
  };
  assignments: {
    title: string;
    addAssignment: string;
    editAssignment: string;
    assignmentName: string;
    description: string;
    attachments: string;
    dueDate: string;
    submitted: string;
    notSubmitted: string;
    graded: string;
    submitAssignment: string;
  };
  notifications: {
    title: string;
    markAsRead: string;
    markAllAsRead: string;
    noNotifications: string;
    newQuiz: string;
    newAssignment: string;
    dueSoon: string;
    quizResult: string;
    newWarning: string;
    subscriptionExpiring: string;
    subscriptionExpired: string;
    allCategories: string;
    categoryGeneral: string;
    categoryQuiz: string;
    categoryAssignment: string;
    categoryAttendance: string;
    categorySubscription: string;
    categorySystem: string;
    categorySchedule: string;
    unread: string;
    read: string;
    deleteAll: string;
    deleteRead: string;
  };
  activityLog: {
    title: string;
    user: string;
    action: string;
    target: string;
    timestamp: string;
    details: string;
    filterByType: string;
    filterByUser: string;
    filterByDate: string;
    login: string;
    logout: string;
    create: string;
    update: string;
    deleteAction: string;
  };
  settings: {
    title: string;
    general: string;
    language: string;
    theme: string;
    lightMode: string;
    darkMode: string;
  };
  evaluation: {
    title: string;
    criteria: string;
    score: string;
    totalScore: string;
    percentage: string;
    save: string;
    saveAll: string;
    autoSaved: string;
    saving: string;
    notes: string;
    feedbackTags: string;
    noAttendance: string;
    evaluationLocked: string;
    behaviorScore: string;
    quizScore: string;
    assignmentScore: string;
    total: string;
    rubricTooltip: string;
    leaderboard: string;
    rank: string;
    points: string;
    gap: string;
    grade: string;
    mostImproved: string;
    bestProblemSolver: string;
    bestCodeQuality: string;
    bestConsistency: string;
    starsOfTheWeek: string;
    starOfEffort: string;
    starOfTeamwork: string;
    starOfImprovement: string;
    lastSession: string;
    monthly: string;
    byLevel: string;
    weak: string;
    good: string;
    excellent: string;
    noEvaluations: string;
    attendanceNotComplete: string;
    scope: string;
    session: string;
    group: string;
    levelInAgeGroup: string;
    levelGlobal: string;
    ageGroupGlobal: string;
    allStudents: string;
    period: string;
    allTime: string;
    thisMonth: string;
    thisWeek: string;
    selectSession: string;
    selectGroup: string;
    selectAgeGroup: string;
    selectLevel: string;
    sessionsCount: string;
    topPerformers: string;
    student: string;
  };
}

export const translations: Record<Language, Translations> = {
  en: {
    // Common
    common: {
      loading: 'Loading...',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      add: 'Add',
      search: 'Search',
      filter: 'Filter',
      export: 'Export',
      actions: 'Actions',
      back: 'Back',
      next: 'Next',
      submit: 'Submit',
      confirm: 'Confirm',
      close: 'Close',
      yes: 'Yes',
      no: 'No',
      all: 'All',
      none: 'None',
      success: 'Success',
      error: 'Error',
      warning: 'Warning',
      info: 'Info',
    },
    
    // Auth
    auth: {
      login: 'Login',
      logout: 'Logout',
      signup: 'Sign Up',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      forgotPassword: 'Forgot Password?',
      resetPassword: 'Reset Password',
      welcomeBack: 'Welcome Back',
      loginSubtitle: 'Sign in to your account to continue',
      createAccount: 'Create Account',
      signupSubtitle: 'Join Kojobot and start learning',
      alreadyHaveAccount: 'Already have an account?',
      dontHaveAccount: "Don't have an account?",
      loginError: 'Invalid email or password',
      signupSuccess: 'Account created successfully!',
      passwordMismatch: 'Passwords do not match',
      invalidEmail: 'Please enter a valid email',
      passwordTooShort: 'Password must be at least 6 characters',
    },

    // Roles
    roles: {
      admin: 'Admin',
      instructor: 'Instructor',
      student: 'Student',
      reception: 'Reception',
      parent: 'Parent',
    },

    // Navigation
    nav: {
      dashboard: 'Dashboard',
      students: 'Students',
      instructors: 'Employees',
      groups: 'Groups',
      quizzes: 'Quizzes',
      assignments: 'Assignments',
      attendance: 'Attendance',
      settings: 'Settings',
      ageGroups: 'Age Groups',
      levels: 'Levels',
      activityLog: 'Activity Log',
      notifications: 'Notifications',
      profile: 'Profile',
      questionBank: 'Question Bank',
    },

    // Dashboard
    dashboard: {
      welcome: 'Welcome',
      totalStudents: 'Total Students',
      totalInstructors: 'Total Instructors',
      totalGroups: 'Total Groups',
      activeSubscriptions: 'Active Subscriptions',
      expiringSubscriptions: 'Expiring Subscriptions',
      recentActivity: 'Recent Activity',
      upcomingSessions: 'Upcoming Sessions',
      pendingAssignments: 'Pending Assignments',
      attendanceRate: 'Attendance Rate',
    },

    // Students
    students: {
      title: 'Students',
      addStudent: 'Add Student',
      editStudent: 'Edit Student',
      fullName: 'Full Name',
      ageGroup: 'Age Group',
      level: 'Level',
      group: 'Group',
      subscription: 'Subscription',
      subscriptionStart: 'Subscription Start',
      subscriptionEnd: 'Subscription End',
      amountPaid: 'Amount Paid',
      amountRemaining: 'Amount Remaining',
      renewalDate: 'Renewal Date',
      warnings: 'Warnings',
      attendedSessions: 'Attended Sessions',
      missedSessions: 'Missed Sessions',
    },

    // Instructors
    instructors: {
      title: 'Instructors',
      addInstructor: 'Add Instructor',
      editInstructor: 'Edit Instructor',
      specializations: 'Specializations',
      assignedGroups: 'Assigned Groups',
      employeesTitle: 'Employees',
      addEmployee: 'Add Employee',
      editEmployee: 'Edit Employee',
      employeeType: 'Employee Type',
      allEmployees: 'All',
      instructorsOnly: 'Instructors',
      receptionOnly: 'Reception',
    },

    // Groups
    groups: {
      title: 'Groups',
      addGroup: 'Add Group',
      editGroup: 'Edit Group',
      groupName: 'Group Name',
      schedule: 'Schedule',
      duration: 'Duration',
      instructor: 'Instructor',
      studentCount: 'Student Count',
      sessions: 'Sessions',
      attendanceMode: 'Attendance Mode',
      online: 'Online',
      offline: 'Offline (In-Person)',
      sessionLink: 'Session Link',
      copyLink: 'Copy Link',
      joinSession: 'Join Session',
      linkCopied: 'Link copied to clipboard',
      groupStatus: 'Group Status',
      newGroup: 'New Group - Starts from Session 1',
      existingGroup: 'Existing Group - Already Started',
      nextSessionNumber: 'Next Session Number',
      nextSessionDate: 'Next Session Date',
      sessionsPassed: 'Sessions Passed',
      sessionsRemaining: 'Sessions Remaining',
      progress: 'Progress',
      selectDate: 'Select Date',
    },

    // Age Groups
    ageGroups: {
      title: 'Age Groups',
      addAgeGroup: 'Add Age Group',
      editAgeGroup: 'Edit Age Group',
      minAge: 'Minimum Age',
      maxAge: 'Maximum Age',
    },

    // Levels
    levels: {
      title: 'Levels',
      addLevel: 'Add Level',
      editLevel: 'Edit Level',
      levelName: 'Level Name',
      track: 'Track',
      software: 'Software',
      hardware: 'Hardware',
      parentLevel: 'Parent Level',
    },

    // Attendance
    attendance: {
      title: 'Attendance',
      present: 'Present',
      absent: 'Absent',
      excused: 'Excused',
      late: 'Late',
      markAttendance: 'Mark Attendance',
      sessionDate: 'Session Date',
    },

    // Quizzes
    quizzes: {
      title: 'Quizzes',
      addQuiz: 'Add Quiz',
      editQuiz: 'Edit Quiz',
      assignQuiz: 'Assign Quiz',
      quizName: 'Quiz Name',
      questions: 'Questions',
      duration: 'Duration',
      dueDate: 'Due Date',
      score: 'Score',
      passed: 'Passed',
      failed: 'Failed',
      pending: 'Pending',
    },

    // Assignments
    assignments: {
      title: 'Assignments',
      addAssignment: 'Add Assignment',
      editAssignment: 'Edit Assignment',
      assignmentName: 'Assignment Name',
      description: 'Description',
      attachments: 'Attachments',
      dueDate: 'Due Date',
      submitted: 'Submitted',
      notSubmitted: 'Not Submitted',
      graded: 'Graded',
      submitAssignment: 'Submit Assignment',
    },

    // Notifications
    notifications: {
      title: 'Notifications',
      markAsRead: 'Mark as Read',
      markAllAsRead: 'Mark All as Read',
      noNotifications: 'No notifications',
      newQuiz: 'New quiz assigned',
      newAssignment: 'New assignment',
      dueSoon: 'Due soon',
      quizResult: 'Quiz result available',
      newWarning: 'New warning',
      subscriptionExpiring: 'Subscription expiring soon',
      subscriptionExpired: 'Subscription expired',
      allCategories: 'All',
      categoryGeneral: 'General',
      categoryQuiz: 'Quizzes',
      categoryAssignment: 'Assignments',
      categoryAttendance: 'Attendance',
      categorySubscription: 'Subscription',
      categorySystem: 'System',
      categorySchedule: 'Schedule',
      unread: 'Unread',
      read: 'Read',
      deleteAll: 'Delete All',
      deleteRead: 'Delete Read',
    },

    // Activity Log
    activityLog: {
      title: 'Activity Log',
      user: 'User',
      action: 'Action',
      target: 'Target',
      timestamp: 'Timestamp',
      details: 'Details',
      filterByType: 'Filter by Type',
      filterByUser: 'Filter by User',
      filterByDate: 'Filter by Date',
      login: 'Login',
      logout: 'Logout',
      create: 'Create',
      update: 'Update',
      deleteAction: 'Delete',
    },

    // Settings
    settings: {
      title: 'Settings',
      general: 'General',
      language: 'Language',
      theme: 'Theme',
      lightMode: 'Light Mode',
      darkMode: 'Dark Mode',
    },
    // Evaluation
    evaluation: {
      title: 'Evaluation',
      criteria: 'Criteria',
      score: 'Score',
      totalScore: 'Total Score',
      percentage: 'Percentage',
      save: 'Save',
      saveAll: 'Save All',
      autoSaved: 'Auto-saved',
      saving: 'Saving...',
      notes: 'Notes',
      feedbackTags: 'Feedback Tags',
      noAttendance: 'Attendance must be recorded first',
      evaluationLocked: 'Evaluation locked after 24 hours',
      behaviorScore: 'Behavior Score',
      quizScore: 'Quiz Score',
      assignmentScore: 'Assignment Score',
      total: 'Total',
      rubricTooltip: 'Click to see rubric levels',
      leaderboard: 'Leaderboard',
      rank: 'Rank',
      points: 'Points',
      gap: 'Gap',
      grade: 'Grade',
      mostImproved: 'Most Improved',
      bestProblemSolver: 'Best Problem Solver',
      bestCodeQuality: 'Best Code Quality',
      bestConsistency: 'Best Consistency',
      starsOfTheWeek: 'Stars of the Week',
      starOfEffort: 'Star of Effort',
      starOfTeamwork: 'Star of Teamwork',
      starOfImprovement: 'Star of Improvement',
      lastSession: 'Last Session',
      monthly: 'Monthly',
      byLevel: 'By Level',
      weak: 'Weak',
      good: 'Good',
      excellent: 'Excellent',
      noEvaluations: 'No evaluations yet',
      attendanceNotComplete: 'Complete attendance for all students first',
      scope: 'Scope',
      session: 'Session',
      group: 'Group',
      levelInAgeGroup: 'Level in Age Group',
      levelGlobal: 'Level (All)',
      ageGroupGlobal: 'Age Group (All)',
      allStudents: 'All Students',
      period: 'Period',
      allTime: 'All Time',
      thisMonth: 'This Month',
      thisWeek: 'This Week',
      selectSession: 'Select Session',
      selectGroup: 'Select Group',
      selectAgeGroup: 'Select Age Group',
      selectLevel: 'Select Level',
      sessionsCount: 'Sessions',
      topPerformers: 'Top Performers',
      student: 'Student',
    },
  },
  
  ar: {
    // Common
    common: {
      loading: 'جاري التحميل...',
      save: 'حفظ',
      cancel: 'إلغاء',
      delete: 'حذف',
      edit: 'تعديل',
      add: 'إضافة',
      search: 'بحث',
      filter: 'تصفية',
      export: 'تصدير',
      actions: 'إجراءات',
      back: 'رجوع',
      next: 'التالي',
      submit: 'إرسال',
      confirm: 'تأكيد',
      close: 'إغلاق',
      yes: 'نعم',
      no: 'لا',
      all: 'الكل',
      none: 'لا شيء',
      success: 'نجاح',
      error: 'خطأ',
      warning: 'تحذير',
      info: 'معلومات',
    },
    
    // Auth
    auth: {
      login: 'تسجيل الدخول',
      logout: 'تسجيل الخروج',
      signup: 'إنشاء حساب',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      confirmPassword: 'تأكيد كلمة المرور',
      forgotPassword: 'نسيت كلمة المرور؟',
      resetPassword: 'إعادة تعيين كلمة المرور',
      welcomeBack: 'مرحباً بعودتك',
      loginSubtitle: 'سجّل دخولك للمتابعة',
      createAccount: 'إنشاء حساب جديد',
      signupSubtitle: 'انضم إلى كوجوبوت وابدأ التعلم',
      alreadyHaveAccount: 'لديك حساب بالفعل؟',
      dontHaveAccount: 'ليس لديك حساب؟',
      loginError: 'بريد إلكتروني أو كلمة مرور غير صحيحة',
      signupSuccess: 'تم إنشاء الحساب بنجاح!',
      passwordMismatch: 'كلمات المرور غير متطابقة',
      invalidEmail: 'يرجى إدخال بريد إلكتروني صحيح',
      passwordTooShort: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    },

    // Roles
    roles: {
      admin: 'مدير',
      instructor: 'مدرب',
      student: 'طالب',
      reception: 'ريسيبشن',
      parent: 'ولي أمر',
    },

    // Navigation
    nav: {
      dashboard: 'لوحة التحكم',
      students: 'الطلاب',
      instructors: 'الموظفين',
      groups: 'المجموعات',
      quizzes: 'الاختبارات',
      assignments: 'الواجبات',
      attendance: 'الحضور',
      settings: 'الإعدادات',
      ageGroups: 'الفئات العمرية',
      levels: 'المستويات',
      activityLog: 'سجل النشاطات',
      notifications: 'الإشعارات',
      profile: 'الملف الشخصي',
      questionBank: 'بنك الأسئلة',
    },

    // Dashboard
    dashboard: {
      welcome: 'مرحباً',
      totalStudents: 'إجمالي الطلاب',
      totalInstructors: 'إجمالي المدربين',
      totalGroups: 'إجمالي المجموعات',
      activeSubscriptions: 'الاشتراكات النشطة',
      expiringSubscriptions: 'اشتراكات تنتهي قريباً',
      recentActivity: 'آخر النشاطات',
      upcomingSessions: 'الجلسات القادمة',
      pendingAssignments: 'الواجبات المعلقة',
      attendanceRate: 'معدل الحضور',
    },

    // Students
    students: {
      title: 'الطلاب',
      addStudent: 'إضافة طالب',
      editStudent: 'تعديل الطالب',
      fullName: 'الاسم الكامل',
      ageGroup: 'الفئة العمرية',
      level: 'المستوى',
      group: 'المجموعة',
      subscription: 'الاشتراك',
      subscriptionStart: 'بداية الاشتراك',
      subscriptionEnd: 'نهاية الاشتراك',
      amountPaid: 'المبلغ المدفوع',
      amountRemaining: 'المبلغ المتبقي',
      renewalDate: 'تاريخ التجديد',
      warnings: 'الإنذارات',
      attendedSessions: 'الجلسات المحضورة',
      missedSessions: 'الجلسات الغائبة',
    },

    // Instructors
    instructors: {
      title: 'المدربين',
      addInstructor: 'إضافة مدرب',
      editInstructor: 'تعديل المدرب',
      specializations: 'التخصصات',
      assignedGroups: 'المجموعات المسندة',
      employeesTitle: 'الموظفين',
      addEmployee: 'إضافة موظف',
      editEmployee: 'تعديل موظف',
      employeeType: 'نوع الموظف',
      allEmployees: 'الكل',
      instructorsOnly: 'المدربين',
      receptionOnly: 'الريسيبشن',
    },

    // Groups
    groups: {
      title: 'المجموعات',
      addGroup: 'إضافة مجموعة',
      editGroup: 'تعديل المجموعة',
      groupName: 'اسم المجموعة',
      schedule: 'الموعد',
      duration: 'المدة',
      instructor: 'المدرب',
      studentCount: 'عدد الطلاب',
      sessions: 'الجلسات',
      attendanceMode: 'نوع الحضور',
      online: 'أونلاين',
      offline: 'حضوري',
      sessionLink: 'رابط الجلسة',
      copyLink: 'نسخ الرابط',
      joinSession: 'انضم للجلسة',
      linkCopied: 'تم نسخ الرابط',
      groupStatus: 'حالة المجموعة',
      newGroup: 'مجموعة جديدة - تبدأ من السيشن 1',
      existingGroup: 'مجموعة قائمة - بدأت مسبقاً',
      nextSessionNumber: 'رقم السيشن القادم',
      nextSessionDate: 'تاريخ السيشن القادم',
      sessionsPassed: 'سيشنات فاتت',
      sessionsRemaining: 'سيشنات باقية',
      progress: 'التقدم',
      selectDate: 'اختر التاريخ',
    },

    // Age Groups
    ageGroups: {
      title: 'الفئات العمرية',
      addAgeGroup: 'إضافة فئة عمرية',
      editAgeGroup: 'تعديل الفئة العمرية',
      minAge: 'الحد الأدنى للسن',
      maxAge: 'الحد الأقصى للسن',
    },

    // Levels
    levels: {
      title: 'المستويات',
      addLevel: 'إضافة مستوى',
      editLevel: 'تعديل المستوى',
      levelName: 'اسم المستوى',
      track: 'المسار',
      software: 'برمجيات',
      hardware: 'هاردوير',
      parentLevel: 'المستوى السابق',
    },

    // Attendance
    attendance: {
      title: 'الحضور',
      present: 'حاضر',
      absent: 'غائب',
      excused: 'معذور',
      late: 'متأخر',
      markAttendance: 'تسجيل الحضور',
      sessionDate: 'تاريخ الجلسة',
    },

    // Quizzes
    quizzes: {
      title: 'الاختبارات',
      addQuiz: 'إضافة اختبار',
      editQuiz: 'تعديل الاختبار',
      assignQuiz: 'إسناد اختبار',
      quizName: 'اسم الاختبار',
      questions: 'الأسئلة',
      duration: 'المدة',
      dueDate: 'تاريخ التسليم',
      score: 'الدرجة',
      passed: 'ناجح',
      failed: 'راسب',
      pending: 'قيد الانتظار',
    },

    // Assignments
    assignments: {
      title: 'الواجبات',
      addAssignment: 'إضافة واجب',
      editAssignment: 'تعديل الواجب',
      assignmentName: 'اسم الواجب',
      description: 'الوصف',
      attachments: 'المرفقات',
      dueDate: 'تاريخ التسليم',
      submitted: 'تم التسليم',
      notSubmitted: 'لم يتم التسليم',
      graded: 'تم التقييم',
      submitAssignment: 'تسليم الواجب',
    },

    // Notifications
    notifications: {
      title: 'الإشعارات',
      markAsRead: 'تحديد كمقروء',
      markAllAsRead: 'تحديد الكل كمقروء',
      noNotifications: 'لا توجد إشعارات',
      newQuiz: 'اختبار جديد مسند',
      newAssignment: 'واجب جديد',
      dueSoon: 'ينتهي قريباً',
      quizResult: 'نتيجة الاختبار متاحة',
      newWarning: 'إنذار جديد',
      subscriptionExpiring: 'اشتراكك ينتهي قريباً',
      subscriptionExpired: 'انتهى اشتراكك',
      allCategories: 'الكل',
      categoryGeneral: 'عام',
      categoryQuiz: 'الكويزات',
      categoryAssignment: 'الواجبات',
      categoryAttendance: 'الحضور',
      categorySubscription: 'الاشتراك',
      categorySystem: 'النظام',
      categorySchedule: 'الجدول',
      unread: 'غير مقروء',
      read: 'مقروء',
      deleteAll: 'حذف الكل',
      deleteRead: 'حذف المقروء',
    },

    // Activity Log
    activityLog: {
      title: 'سجل النشاطات',
      user: 'المستخدم',
      action: 'الإجراء',
      target: 'الهدف',
      timestamp: 'التوقيت',
      details: 'التفاصيل',
      filterByType: 'تصفية حسب النوع',
      filterByUser: 'تصفية حسب المستخدم',
      filterByDate: 'تصفية حسب التاريخ',
      login: 'تسجيل دخول',
      logout: 'تسجيل خروج',
      create: 'إنشاء',
      update: 'تعديل',
      deleteAction: 'حذف',
    },

    // Settings
    settings: {
      title: 'الإعدادات',
      general: 'عام',
      language: 'اللغة',
      theme: 'المظهر',
      lightMode: 'الوضع الفاتح',
      darkMode: 'الوضع الداكن',
    },
    // Evaluation
    evaluation: {
      title: 'التقييم',
      criteria: 'المعايير',
      score: 'الدرجة',
      totalScore: 'المجموع',
      percentage: 'النسبة',
      save: 'حفظ',
      saveAll: 'حفظ الكل',
      autoSaved: 'تم الحفظ تلقائياً',
      saving: 'جاري الحفظ...',
      notes: 'ملاحظات',
      feedbackTags: 'تعليقات',
      noAttendance: 'يجب تسجيل الحضور أولاً',
      evaluationLocked: 'التقييم مغلق بعد 24 ساعة',
      behaviorScore: 'درجة السلوك',
      quizScore: 'درجة الكويز',
      assignmentScore: 'درجة الواجب',
      total: 'الإجمالي',
      rubricTooltip: 'اضغط لعرض مستويات التقييم',
      leaderboard: 'لوحة الترتيب',
      rank: 'المركز',
      points: 'النقاط',
      gap: 'الفرق',
      grade: 'التقدير',
      mostImproved: 'الأكثر تطوراً',
      bestProblemSolver: 'أفضل حل مشكلات',
      bestCodeQuality: 'أفضل جودة كود',
      bestConsistency: 'الأكثر ثباتاً',
      starsOfTheWeek: 'نجوم الأسبوع',
      starOfEffort: 'نجمة الاجتهاد',
      starOfTeamwork: 'نجمة التعاون',
      starOfImprovement: 'نجمة التطور',
      lastSession: 'آخر سيشن',
      monthly: 'الشهري',
      byLevel: 'حسب الليفل',
      weak: 'ضعيف',
      good: 'جيد',
      excellent: 'ممتاز',
      noEvaluations: 'لا توجد تقييمات بعد',
      attendanceNotComplete: 'أكمل الحضور لكل الطلاب أولاً',
      scope: 'النطاق',
      session: 'السيشن',
      group: 'المجموعة',
      levelInAgeGroup: 'الليفل في الفئة',
      levelGlobal: 'الليفل (عام)',
      ageGroupGlobal: 'الفئة العمرية (عام)',
      allStudents: 'كل الطلاب',
      period: 'الفترة',
      allTime: 'كل الوقت',
      thisMonth: 'هذا الشهر',
      thisWeek: 'هذا الاسبوع',
      selectSession: 'اختر السيشن',
      selectGroup: 'اختر المجموعة',
      selectAgeGroup: 'اختر الفئة العمرية',
      selectLevel: 'اختر الليفل',
      sessionsCount: 'السيشنات',
      topPerformers: 'المتميزون',
      student: 'الطالب',
    },
  },
};

export type TranslationKeys = Translations;
