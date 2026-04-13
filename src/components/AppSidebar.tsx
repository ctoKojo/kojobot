import { useLocation, useNavigate } from 'react-router-dom';
import { useTransition } from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Calendar,
  BookOpen,
  BookMarked,
  UserCheck,
  Settings,
  Layers,
  Activity,
  Bell,
  LogOut,
  CalendarDays,
  BarChart3,
  Library,
  Send,
  FileCheck,
  AlertTriangle,
  RefreshCw,
  DollarSign,
  CreditCard,
  MessageSquare,
  TrendingUp,
  Briefcase,
  GraduationCap as AcademicCap,
  ClipboardList,
  ClipboardCheck,
  Target,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { KojobotLogo } from '@/components/KojobotLogo';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSeasonalTheme } from '@/hooks/useSeasonalTheme';
import { RamadanSidebarDecor } from '@/components/RamadanTheme';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: ('admin' | 'instructor' | 'student' | 'reception' | 'parent')[];
}

interface NavSection {
  label: string;
  labelAr: string;
  items: NavItem[];
}

export function AppSidebar() {
  const { t, isRTL } = useLanguage();
  const { role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [, startTransition] = useTransition();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const getSections = (): NavSection[] => {
    switch (role) {
      case 'admin':
        return [
          {
            label: 'Main', labelAr: 'الرئيسية',
            items: [
              { title: t.nav.dashboard, url: '/dashboard', icon: LayoutDashboard, roles: ['admin'] },
              { title: isRTL ? 'الرسائل' : 'Messages', url: '/messages', icon: MessageSquare, roles: ['admin'] },
              { title: t.nav.notifications, url: '/notifications', icon: Bell, roles: ['admin'] },
            ],
          },
          {
            label: 'People', labelAr: 'الأشخاص',
            items: [
              { title: t.nav.students, url: '/students', icon: GraduationCap, roles: ['admin'] },
              { title: t.nav.instructors, url: '/instructors', icon: Users, roles: ['admin'] },
              { title: isRTL ? 'أولياء الأمور' : 'Parents', url: '/parents', icon: Users, roles: ['admin'] },
            ],
          },
          {
            label: 'Academic', labelAr: 'الأكاديمي',
            items: [
              { title: t.nav.groups, url: '/groups', icon: Calendar, roles: ['admin'] },
              { title: t.groups.sessions, url: '/sessions', icon: BookOpen, roles: ['admin'] },
              
              { title: isRTL ? 'السيشنات التعويضية' : 'Makeup Sessions', url: '/makeup-sessions', icon: RefreshCw, roles: ['admin'] },
              { title: isRTL ? 'الامتحانات النهائية' : 'Final Exams', url: '/final-exams', icon: Target, roles: ['admin'] },
              { title: isRTL ? 'تحليلات التقدم' : 'Progression Metrics', url: '/progression-metrics', icon: BarChart3, roles: ['admin'] },
            ],
          },
          {
            label: 'Content', labelAr: 'المحتوى',
            items: [
              { title: isRTL ? 'المنهج' : 'Curriculum', url: '/curriculum', icon: Library, roles: ['admin'] },
              { title: isRTL ? 'المواد التعليمية' : 'Materials', url: '/materials', icon: BookMarked, roles: ['admin'] },
              { title: t.nav.questionBank, url: '/quizzes', icon: Library, roles: ['admin'] },
              { title: isRTL ? 'إسناد الكويزات' : 'Quiz Assignments', url: '/my-instructor-quizzes', icon: Send, roles: ['admin'] },
              { title: isRTL ? 'تقارير الكويزات' : 'Quiz Reports', url: '/quiz-reports', icon: BarChart3, roles: ['admin'] },
              { title: t.nav.assignments, url: '/assignments', icon: ClipboardList, roles: ['admin'] },
            ],
          },
          {
            label: 'Finance', labelAr: 'المالية',
            items: [
              { title: isRTL ? 'الإدارة المالية' : 'Finance', url: '/finance', icon: DollarSign, roles: ['admin'] },
              { title: isRTL ? 'خطط التسعير' : 'Pricing Plans', url: '/pricing-plans', icon: CreditCard, roles: ['admin'] },
              { title: isRTL ? 'قواعد الخصم' : 'Deduction Rules', url: '/deduction-rules', icon: AlertTriangle, roles: ['admin'] },
              { title: isRTL ? 'طلبات الاشتراك' : 'Subscription Requests', url: '/subscription-requests', icon: ClipboardList, roles: ['admin'] },
            ],
          },
          {
            label: 'Management', labelAr: 'الإدارة',
            items: [
              { title: isRTL ? 'أداء المدربين' : 'Instructor Performance', url: '/instructor-performance', icon: TrendingUp, roles: ['admin'] },
              { title: isRTL ? 'إنذارات المدربين' : 'Instructor Warnings', url: '/instructor-warnings', icon: AlertTriangle, roles: ['admin'] },
              { title: isRTL ? 'مراجعة تحديد المستوى' : 'Placement Review', url: '/placement-test-review', icon: ClipboardCheck, roles: ['admin'] },
              { title: isRTL ? 'طلبات الإجازة' : 'Leave Requests', url: '/leave-requests', icon: CalendarDays, roles: ['admin'] },
              { title: isRTL ? 'لوحة الترتيب' : 'Leaderboard', url: '/leaderboard', icon: BarChart3, roles: ['admin', 'reception'] },
              { title: isRTL ? 'التقارير الشهرية' : 'Monthly Reports', url: '/monthly-reports', icon: BarChart3, roles: ['admin'] },
              { title: t.nav.activityLog, url: '/activity-log', icon: Activity, roles: ['admin'] },
            ],
          },
          {
            label: 'Settings', labelAr: 'الإعدادات',
            items: [
              { title: isRTL ? 'إعدادات تحديد المستوى' : 'Placement Settings', url: '/placement-test-settings', icon: ClipboardCheck, roles: ['admin'] },
              { title: t.nav.ageGroups, url: '/age-groups', icon: Layers, roles: ['admin'] },
              { title: t.nav.levels, url: '/levels', icon: BookOpen, roles: ['admin'] },
              { title: t.nav.settings, url: '/settings', icon: Settings, roles: ['admin'] },
            ],
          },
        ];

      case 'instructor':
        return [
          {
            label: 'Main', labelAr: 'الرئيسية',
            items: [
              { title: t.nav.dashboard, url: '/dashboard', icon: LayoutDashboard, roles: ['instructor'] },
              { title: isRTL ? 'الرسائل' : 'Messages', url: '/messages', icon: MessageSquare, roles: ['instructor'] },
              { title: isRTL ? 'جدول العمل' : 'My Schedule', url: '/instructor-schedule', icon: CalendarDays, roles: ['instructor'] },
            ],
          },
          {
            label: 'Work', labelAr: 'العمل',
            items: [
              { title: t.nav.groups, url: '/groups', icon: Calendar, roles: ['instructor'] },
              { title: t.groups.sessions, url: '/sessions', icon: BookOpen, roles: ['instructor'] },
              { title: isRTL ? 'السيشنات التعويضية' : 'Makeup Sessions', url: '/makeup-sessions', icon: RefreshCw, roles: ['instructor'] },
            ],
          },
          {
            label: 'Teaching', labelAr: 'التدريس',
            items: [
              { title: isRTL ? 'إسناد الكويزات' : 'Quiz Assignments', url: '/my-instructor-quizzes', icon: Send, roles: ['instructor'] },
              { title: t.nav.assignments, url: '/assignments', icon: ClipboardList, roles: ['instructor'] },
              { title: isRTL ? 'لوحة الترتيب' : 'Leaderboard', url: '/leaderboard', icon: BarChart3, roles: ['instructor'] },
            ],
          },
          {
            label: 'Personal', labelAr: 'الشخصي',
            items: [
              { title: isRTL ? 'إنذاراتي' : 'My Warnings', url: '/my-instructor-warnings', icon: AlertTriangle, roles: ['instructor'] },
              { title: t.nav.notifications, url: '/notifications', icon: Bell, roles: ['instructor'] },
            ],
          },
        ];

      case 'student':
        return [
          {
            label: 'Main', labelAr: 'الرئيسية',
            items: [
              { title: t.nav.dashboard, url: '/dashboard', icon: LayoutDashboard, roles: ['student'] },
              { title: isRTL ? 'الرسائل' : 'Messages', url: '/messages', icon: MessageSquare, roles: ['student'] },
              { title: t.nav.notifications, url: '/notifications', icon: Bell, roles: ['student'] },
            ],
          },
          {
            label: 'My Learning', labelAr: 'دراستي',
            items: [
              { title: isRTL ? 'كويزاتي' : 'My Quizzes', url: '/my-quizzes', icon: FileCheck, roles: ['student'] },
              { title: t.nav.assignments, url: '/assignments', icon: ClipboardList, roles: ['student'] },
              { title: isRTL ? 'موادي التعليمية' : 'My Materials', url: '/my-materials', icon: BookMarked, roles: ['student'] },
              { title: isRTL ? 'سيشناتي' : 'My Sessions', url: '/my-sessions', icon: BookOpen, roles: ['student'] },
              { title: isRTL ? 'شهاداتي' : 'My Certificates', url: '/my-certificates', icon: AcademicCap, roles: ['student'] },
              { title: isRTL ? 'الترتيب' : 'Leaderboard', url: '/leaderboard', icon: BarChart3, roles: ['student'] },
            ],
          },
          {
            label: 'Support', labelAr: 'الدعم',
            items: [
              { title: isRTL ? 'سيشناتي التعويضية' : 'My Makeup Sessions', url: '/my-makeup-sessions', icon: RefreshCw, roles: ['student'] },
              { title: isRTL ? 'التقارير الشهرية' : 'Monthly Reports', url: '/monthly-reports', icon: BarChart3, roles: ['student'] },
              { title: isRTL ? 'إنذاراتي' : 'My Warnings', url: '/my-warnings', icon: AlertTriangle, roles: ['student'] },
            ],
          },
        ];

      case 'reception':
        return [
          {
            label: 'Main', labelAr: 'الرئيسية',
            items: [
              { title: t.nav.dashboard, url: '/dashboard', icon: LayoutDashboard, roles: ['reception'] },
              { title: isRTL ? 'الرسائل' : 'Messages', url: '/messages', icon: MessageSquare, roles: ['reception'] },
              { title: t.nav.notifications, url: '/notifications', icon: Bell, roles: ['reception'] },
            ],
          },
          {
            label: 'Operations', labelAr: 'العمليات',
            items: [
              { title: t.nav.students, url: '/students', icon: GraduationCap, roles: ['reception'] },
              { title: isRTL ? 'أولياء الأمور' : 'Parents', url: '/parents', icon: Users, roles: ['reception'] },
              { title: t.nav.groups, url: '/groups', icon: Calendar, roles: ['reception'] },
              { title: t.groups.sessions, url: '/sessions', icon: BookOpen, roles: ['reception'] },
              
              { title: isRTL ? 'السيشنات التعويضية' : 'Makeup Sessions', url: '/makeup-sessions', icon: RefreshCw, roles: ['reception'] },
              { title: isRTL ? 'الامتحانات النهائية' : 'Final Exams', url: '/final-exams', icon: Target, roles: ['reception'] },
              { title: isRTL ? 'جدول العمل' : 'Schedule', url: '/instructor-schedule', icon: CalendarDays, roles: ['reception'] },
              { title: isRTL ? 'مراجعة تحديد المستوى' : 'Placement Review', url: '/placement-test-review', icon: ClipboardCheck, roles: ['reception'] },
              { title: isRTL ? 'طلبات الإجازة' : 'Leave Requests', url: '/leave-requests', icon: CalendarDays, roles: ['reception'] },
            ],
          },
          {
            label: 'Finance', labelAr: 'المالية',
            items: [
              { title: isRTL ? 'الإدارة المالية' : 'Finance', url: '/finance', icon: DollarSign, roles: ['reception'] },
              { title: isRTL ? 'خطط التسعير' : 'Pricing Plans', url: '/pricing-plans', icon: CreditCard, roles: ['reception'] },
              { title: isRTL ? 'طلبات الاشتراك' : 'Subscription Requests', url: '/subscription-requests', icon: ClipboardList, roles: ['reception'] },
            ],
          },
        ];

      case 'parent':
        return [
          {
            label: 'Main', labelAr: 'الرئيسية',
            items: [
              { title: t.nav.dashboard, url: '/dashboard', icon: LayoutDashboard, roles: ['parent'] },
              { title: isRTL ? 'الرسائل' : 'Messages', url: '/messages', icon: MessageSquare, roles: ['parent'] },
              { title: t.nav.notifications, url: '/notifications', icon: Bell, roles: ['parent'] },
            ],
          },
          {
            label: 'Management', labelAr: 'الإدارة',
            items: [
              { title: isRTL ? 'طلبات الإجازة' : 'Leave Requests', url: '/parent-leave-requests', icon: CalendarDays, roles: ['parent'] },
              { title: isRTL ? 'الحساب المالي' : 'Finances', url: '/my-finances', icon: DollarSign, roles: ['parent'] },
            ],
          },
        ];

      default:
        return [
          {
            label: 'Main', labelAr: 'الرئيسية',
            items: [
              { title: t.nav.dashboard, url: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'instructor', 'student', 'reception'] },
            ],
          },
        ];
    }
  };

  const sections = getSections();
  const isActive = (url: string) => location.pathname === url;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const renderNavItems = (items: NavItem[]) => (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton
            asChild
            isActive={isActive(item.url)}
            tooltip={collapsed ? item.title : undefined}
          >
            <a
              href={item.url}
              onClick={(e) => {
                e.preventDefault();
                startTransition(() => {
                  navigate(item.url);
                });
              }}
              className={cn(
                'flex items-center gap-3 rounded-lg transition-colors text-sm',
                collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2',
                isActive(item.url)
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="truncate">{item.title}</span>}
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  const isRamadan = useSeasonalTheme('ramadan');

  return (
    <Sidebar side={isRTL ? 'right' : 'left'} collapsible="icon" className="font-sans">
      {isRamadan && <RamadanSidebarDecor />}
      <SidebarHeader className="border-b border-sidebar-border h-16 flex items-center justify-center">
        <div className="flex items-center justify-center overflow-hidden">
          <KojobotLogo size={collapsed ? 'sm' : 'md'} showText={!collapsed} />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {sections.map((section, idx) => (
          <SidebarGroup key={section.label} className={idx > 0 ? 'mt-4' : ''}>
            {!collapsed && (
              <SidebarGroupLabel className="text-xs uppercase text-muted-foreground mb-2">
                {isRTL ? section.labelAr : section.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>{renderNavItems(section.items)}</SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <Button
          variant="ghost"
          className={cn(
            'w-full gap-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            collapsed ? 'justify-center px-2' : 'justify-start'
          )}
          onClick={handleSignOut}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>{t.auth.logout}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
