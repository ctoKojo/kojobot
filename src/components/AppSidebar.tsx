import { useLocation, useNavigate } from 'react-router-dom';
import { useTransition, useState, useMemo, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Calendar,
  BookOpen,
  BookMarked,
  Settings,
  Layers,
  Activity,
  Bell,
  LogOut,
  CalendarDays,
  BarChart3,
  Library,
  Send,
  AlertTriangle,
  RefreshCw,
  DollarSign,
  MessageSquare,
  TrendingUp,
  GraduationCap as AcademicCap,
  ClipboardList,
  ClipboardCheck,
  Target,
  Lock,
  ShieldCheck,
  FileText,
  Mail,
  ChevronDown,
  FileCheck,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSeasonalTheme } from '@/hooks/useSeasonalTheme';
import { RamadanSidebarDecor } from '@/components/RamadanTheme';

type Role = 'admin' | 'instructor' | 'student' | 'reception' | 'parent';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavItem[];
}

interface NavSection {
  label: string;
  labelAr: string;
  icon?: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  /** Tailwind color token name used for icon tint + accent bar. */
  color?: 'primary' | 'success' | 'warning' | 'destructive' | 'kojo-blue' | 'kojo-purple' | 'accent';
}

/**
 * Per-section color styling.
 * - `icon`: icon color (uses semantic tokens; brightened in dark mode for legibility).
 * - `iconBg`: rounded square behind the icon — strong enough to read on both light
 *   and dark sidebar backgrounds, with a subtle hover lift.
 * - `borderVar`: CSS variable name for the left/right accent bar inside the open section.
 */
const SECTION_COLOR_STYLES: Record<
  string,
  { icon: string; iconBg: string; borderVar: string }
> = {
  primary: {
    icon: 'text-primary dark:text-primary',
    iconBg:
      'bg-primary/15 ring-1 ring-inset ring-primary/20 group-hover/section:bg-primary/25 dark:bg-primary/20 dark:ring-primary/30',
    borderVar: '--primary',
  },
  success: {
    // success token is a deep green (36% L) — bump brightness in dark mode for contrast.
    icon: 'text-success dark:text-emerald-400',
    iconBg:
      'bg-success/15 ring-1 ring-inset ring-success/25 group-hover/section:bg-success/25 dark:bg-emerald-400/15 dark:ring-emerald-400/30',
    borderVar: '--success',
  },
  warning: {
    // warning is amber/orange — keep saturated tone but soften background tint.
    icon: 'text-warning dark:text-amber-400',
    iconBg:
      'bg-warning/15 ring-1 ring-inset ring-warning/25 group-hover/section:bg-warning/25 dark:bg-amber-400/15 dark:ring-amber-400/30',
    borderVar: '--warning',
  },
  destructive: {
    icon: 'text-destructive dark:text-red-400',
    iconBg:
      'bg-destructive/15 ring-1 ring-inset ring-destructive/25 group-hover/section:bg-destructive/25 dark:bg-red-400/15 dark:ring-red-400/30',
    borderVar: '--destructive',
  },
  'kojo-blue': {
    icon: 'text-kojo-blue',
    iconBg:
      'bg-kojo-blue/15 ring-1 ring-inset ring-kojo-blue/25 group-hover/section:bg-kojo-blue/25 dark:bg-kojo-blue/20 dark:ring-kojo-blue/30',
    borderVar: '--kojo-blue',
  },
  'kojo-purple': {
    icon: 'text-kojo-purple',
    iconBg:
      'bg-kojo-purple/15 ring-1 ring-inset ring-kojo-purple/25 group-hover/section:bg-kojo-purple/25 dark:bg-kojo-purple/20 dark:ring-kojo-purple/30',
    borderVar: '--kojo-purple',
  },
  accent: {
    // Neutral fallback — uses sidebar tokens so it always blends with the surface.
    icon: 'text-sidebar-foreground/80',
    iconBg:
      'bg-sidebar-accent ring-1 ring-inset ring-sidebar-border group-hover/section:bg-sidebar-accent/80',
    borderVar: '--sidebar-border',
  },
};

export function AppSidebar() {
  const { t, isRTL } = useLanguage();
  const { role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [, startTransition] = useTransition();
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === 'collapsed';

  const sections = useMemo<NavSection[]>(() => {
    switch (role) {
      case 'admin':
        return [
          {
            label: 'Main', labelAr: 'الرئيسية', icon: LayoutDashboard, color: 'primary',
            items: [
              { title: t.nav.dashboard, url: '/dashboard', icon: LayoutDashboard },
              { title: isRTL ? 'الرسائل' : 'Messages', url: '/messages', icon: MessageSquare },
              { title: t.nav.notifications, url: '/notifications', icon: Bell },
            ],
          },
          {
            label: 'Students & People', labelAr: 'الطلاب والأشخاص', icon: GraduationCap, color: 'kojo-blue',
            items: [
              { title: t.nav.students, url: '/students', icon: GraduationCap },
              { title: isRTL ? 'أولياء الأمور' : 'Parents', url: '/parents', icon: Users },
              { title: t.nav.instructors, url: '/instructors', icon: Users },
            ],
          },
          {
            label: 'Sessions & Academic', labelAr: 'الحصص والأكاديمي', icon: Calendar, color: 'kojo-purple',
            items: [
              { title: t.groups.sessions, url: '/sessions', icon: BookOpen },
              { title: t.nav.groups, url: '/groups', icon: Calendar },
              { title: isRTL ? 'السيشنات التعويضية' : 'Makeup Sessions', url: '/makeup-sessions', icon: RefreshCw },
              { title: isRTL ? 'الامتحانات النهائية' : 'Final Exams', url: '/final-exams', icon: Target },
              { title: isRTL ? 'طابور الشهادات' : 'Certificates Queue', url: '/certificates-queue', icon: AcademicCap },
              { title: isRTL ? 'تحليلات التقدم' : 'Progression Metrics', url: '/progression-metrics', icon: BarChart3 },
            ],
          },
          {
            label: 'Finance', labelAr: 'المالية', icon: DollarSign, color: 'success',
            items: [
              { title: isRTL ? 'الإدارة والخزنة' : 'Finance & Treasury', url: '/finance', icon: DollarSign },
              { title: isRTL ? 'الإقفال والتدقيق' : 'Closing & Audit', url: '/finance/closing', icon: Lock },
              { title: isRTL ? 'الإعدادات المالية' : 'Finance Settings', url: '/finance/settings', icon: Settings },
            ],
          },
          {
            label: 'Content & Curriculum', labelAr: 'المحتوى والمنهج', icon: Library, color: 'kojo-purple',
            items: [
              { title: isRTL ? 'المنهج' : 'Curriculum', url: '/curriculum', icon: Library },
              { title: isRTL ? 'المواد التعليمية' : 'Materials', url: '/materials', icon: BookMarked },
              { title: t.nav.questionBank, url: '/quizzes', icon: Library },
              { title: isRTL ? 'إسناد الكويزات' : 'Quiz Assignments', url: '/my-instructor-quizzes', icon: Send },
              { title: isRTL ? 'تقارير الكويزات' : 'Quiz Reports', url: '/quiz-reports', icon: BarChart3 },
              { title: t.nav.assignments, url: '/assignments', icon: ClipboardList },
            ],
          },
          {
            label: 'Operations & Compliance', labelAr: 'العمليات والالتزام', icon: ShieldCheck, color: 'warning',
            items: [
              { title: isRTL ? 'طلبات الإجازة والأعذار' : 'Leave & Absence', url: '/leave-requests', icon: CalendarDays },
              { title: isRTL ? 'مراجعة تحديد المستوى' : 'Placement Review', url: '/placement-test-review', icon: ClipboardCheck },
              { title: isRTL ? 'مراقبة الالتزام' : 'Compliance Monitor', url: '/compliance-monitor', icon: ShieldCheck },
              { title: isRTL ? 'إنذارات الطلاب' : 'Student Warnings', url: '/student-warnings', icon: AlertTriangle },
              { title: isRTL ? 'إنذارات المدربين' : 'Instructor Warnings', url: '/instructor-warnings', icon: AlertTriangle },
              { title: isRTL ? 'أداء المدربين' : 'Instructor Performance', url: '/instructor-performance', icon: TrendingUp },
            ],
          },
          {
            label: 'Reports & Insights', labelAr: 'التقارير والتحليلات', icon: BarChart3, color: 'kojo-blue',
            items: [
              { title: isRTL ? 'لوحة الترتيب' : 'Leaderboard', url: '/leaderboard', icon: BarChart3 },
              { title: isRTL ? 'التقارير الشهرية' : 'Monthly Reports', url: '/monthly-reports', icon: BarChart3 },
              { title: t.nav.activityLog, url: '/activity-log', icon: Activity },
            ],
          },
          {
            label: 'Communications', labelAr: 'التواصل', icon: Mail, color: 'primary',
            items: [
              { title: isRTL ? 'تذكيرات جماعية' : 'Bulk Reminders', url: '/bulk-reminders', icon: Send },
              { title: isRTL ? 'قوالب الإيميل' : 'Email Templates', url: '/email-templates', icon: FileText },
              { title: isRTL ? 'سجلات الإيميل' : 'Email Logs', url: '/email-logs', icon: Mail },
              { title: isRTL ? 'إعدادات الإشعارات' : 'Notification Settings', url: '/notification-settings', icon: Bell },
            ],
          },
          {
            label: 'System Settings', labelAr: 'إعدادات النظام', icon: Settings, color: 'accent',
            items: [
              { title: t.nav.settings, url: '/settings', icon: Settings },
              { title: t.nav.ageGroups, url: '/age-groups', icon: Layers },
              { title: t.nav.levels, url: '/levels', icon: BookOpen },
              { title: isRTL ? 'إعدادات تحديد المستوى' : 'Placement Settings', url: '/placement-test-settings', icon: ClipboardCheck },
            ],
          },
        ];

      case 'instructor':
        return [
          {
            label: 'Main', labelAr: 'الرئيسية', icon: LayoutDashboard, color: 'primary',
            items: [
              { title: t.nav.dashboard, url: '/dashboard', icon: LayoutDashboard },
              { title: isRTL ? 'جدول العمل' : 'My Schedule', url: '/instructor-schedule', icon: CalendarDays },
              { title: isRTL ? 'الرسائل' : 'Messages', url: '/messages', icon: MessageSquare },
              { title: t.nav.notifications, url: '/notifications', icon: Bell },
            ],
          },
          {
            label: 'Teaching', labelAr: 'التدريس', icon: BookOpen, color: 'kojo-purple',
            items: [
              { title: t.groups.sessions, url: '/sessions', icon: BookOpen },
              { title: t.nav.groups, url: '/groups', icon: Calendar },
              { title: isRTL ? 'السيشنات التعويضية' : 'Makeup Sessions', url: '/makeup-sessions', icon: RefreshCw },
              { title: isRTL ? 'إسناد الكويزات' : 'Quiz Assignments', url: '/my-instructor-quizzes', icon: Send },
              { title: t.nav.assignments, url: '/assignments', icon: ClipboardList },
            ],
          },
          {
            label: 'Personal', labelAr: 'الشخصي', icon: BarChart3, color: 'kojo-blue',
            items: [
              { title: isRTL ? 'لوحة الترتيب' : 'Leaderboard', url: '/leaderboard', icon: BarChart3 },
              { title: isRTL ? 'إنذاراتي' : 'My Warnings', url: '/my-instructor-warnings', icon: AlertTriangle },
            ],
          },
        ];

      case 'student':
        return [
          {
            label: 'Main', labelAr: 'الرئيسية', icon: LayoutDashboard, color: 'primary',
            items: [
              { title: t.nav.dashboard, url: '/dashboard', icon: LayoutDashboard },
              { title: isRTL ? 'الرسائل' : 'Messages', url: '/messages', icon: MessageSquare },
              { title: t.nav.notifications, url: '/notifications', icon: Bell },
            ],
          },
          {
            label: 'Learning', labelAr: 'التعلم', icon: BookOpen, color: 'kojo-purple',
            items: [
              { title: isRTL ? 'سيشناتي' : 'My Sessions', url: '/my-sessions', icon: BookOpen },
              { title: isRTL ? 'سيشناتي التعويضية' : 'Makeup Sessions', url: '/my-makeup-sessions', icon: RefreshCw },
              { title: isRTL ? 'موادي التعليمية' : 'My Materials', url: '/my-materials', icon: BookMarked },
              { title: isRTL ? 'كويزاتي' : 'My Quizzes', url: '/my-quizzes', icon: FileCheck },
              { title: t.nav.assignments, url: '/assignments', icon: ClipboardList },
            ],
          },
          {
            label: 'Progress', labelAr: 'تقدمي', icon: TrendingUp, color: 'success',
            items: [
              { title: isRTL ? 'الترتيب' : 'Leaderboard', url: '/leaderboard', icon: BarChart3 },
              { title: isRTL ? 'التقارير الشهرية' : 'Monthly Reports', url: '/monthly-reports', icon: TrendingUp },
              { title: isRTL ? 'شهاداتي' : 'My Certificates', url: '/my-certificates', icon: AcademicCap },
              { title: isRTL ? 'إنذاراتي' : 'My Warnings', url: '/my-warnings', icon: AlertTriangle },
            ],
          },
        ];

      case 'reception':
        return [
          {
            label: 'Main', labelAr: 'الرئيسية', icon: LayoutDashboard, color: 'primary',
            items: [
              { title: t.nav.dashboard, url: '/dashboard', icon: LayoutDashboard },
              { title: isRTL ? 'الرسائل' : 'Messages', url: '/messages', icon: MessageSquare },
              { title: t.nav.notifications, url: '/notifications', icon: Bell },
            ],
          },
          {
            label: 'Students & People', labelAr: 'الطلاب والأشخاص', icon: GraduationCap, color: 'kojo-blue',
            items: [
              { title: t.nav.students, url: '/students', icon: GraduationCap },
              { title: isRTL ? 'أولياء الأمور' : 'Parents', url: '/parents', icon: Users },
            ],
          },
          {
            label: 'Sessions & Academic', labelAr: 'الحصص والأكاديمي', icon: Calendar, color: 'kojo-purple',
            items: [
              { title: t.groups.sessions, url: '/sessions', icon: BookOpen },
              { title: t.nav.groups, url: '/groups', icon: Calendar },
              { title: isRTL ? 'السيشنات التعويضية' : 'Makeup Sessions', url: '/makeup-sessions', icon: RefreshCw },
              { title: isRTL ? 'الامتحانات النهائية' : 'Final Exams', url: '/final-exams', icon: Target },
              { title: isRTL ? 'طابور الشهادات' : 'Certificates Queue', url: '/certificates-queue', icon: AcademicCap },
              { title: isRTL ? 'جدول العمل' : 'Schedule', url: '/instructor-schedule', icon: CalendarDays },
            ],
          },
          {
            label: 'Finance', labelAr: 'المالية', icon: DollarSign, color: 'success',
            items: [
              { title: isRTL ? 'الإدارة والخزنة' : 'Finance & Treasury', url: '/finance', icon: DollarSign },
              { title: isRTL ? 'الإعدادات المالية' : 'Finance Settings', url: '/finance/settings', icon: Settings },
            ],
          },
          {
            label: 'Operations', labelAr: 'العمليات', icon: ShieldCheck, color: 'warning',
            items: [
              { title: isRTL ? 'طلبات الإجازة والأعذار' : 'Leave & Absence', url: '/leave-requests', icon: CalendarDays },
              { title: isRTL ? 'مراجعة تحديد المستوى' : 'Placement Review', url: '/placement-test-review', icon: ClipboardCheck },
              { title: isRTL ? 'إنذارات الطلاب' : 'Student Warnings', url: '/student-warnings', icon: AlertTriangle },
              { title: isRTL ? 'إنذارات المدربين' : 'Instructor Warnings', url: '/instructor-warnings', icon: AlertTriangle },
            ],
          },
          {
            label: 'Reports & Comms', labelAr: 'التقارير والتواصل', icon: BarChart3, color: 'kojo-blue',
            items: [
              { title: isRTL ? 'لوحة الترتيب' : 'Leaderboard', url: '/leaderboard', icon: BarChart3 },
              { title: isRTL ? 'تذكيرات جماعية' : 'Bulk Reminders', url: '/bulk-reminders', icon: Send },
            ],
          },
        ];

      case 'parent':
        return [
          {
            label: 'Main', labelAr: 'الرئيسية', icon: LayoutDashboard, color: 'primary',
            items: [
              { title: t.nav.dashboard, url: '/dashboard', icon: LayoutDashboard },
              { title: isRTL ? 'الرسائل' : 'Messages', url: '/messages', icon: MessageSquare },
              { title: t.nav.notifications, url: '/notifications', icon: Bell },
            ],
          },
          {
            label: 'My Children', labelAr: 'أبنائي', icon: GraduationCap, color: 'kojo-blue',
            items: [
              { title: isRTL ? 'الإجازات والأعذار' : 'Leave & Absence', url: '/parent-leave-requests', icon: CalendarDays },
              { title: isRTL ? 'الحساب المالي' : 'Finances', url: '/my-finances', icon: DollarSign },
            ],
          },
        ];

      default:
        return [
          {
            label: 'Main', labelAr: 'الرئيسية', icon: LayoutDashboard, color: 'primary',
            items: [
              { title: t.nav.dashboard, url: '/dashboard', icon: LayoutDashboard },
            ],
          },
        ];
    }
  }, [role, isRTL, t]);

  const isActive = (url: string) => location.pathname === url || location.pathname.startsWith(url + '/');
  const sectionHasActive = (section: NavSection) =>
    section.items.some((item) => isActive(item.url) || item.children?.some((c) => isActive(c.url)));

  // Track open/closed state per section. Default: ALL sections collapsed.
  // Persisted to localStorage (per role) so the user's choices survive page reloads.
  const storageKey = `kojo:sidebar:openSections:${role ?? 'guest'}`;
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  // Re-hydrate when the role changes (different storage key).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      setOpenMap(raw ? (JSON.parse(raw) as Record<string, boolean>) : {});
    } catch {
      setOpenMap({});
    }
  }, [storageKey]);

  // Persist on every change.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(openMap));
    } catch {
      /* quota / private mode — ignore */
    }
  }, [openMap, storageKey]);

  const isSectionOpen = (section: NavSection) => {
    if (section.label in openMap) return openMap[section.label];
    return false; // default closed for all sections
  };

  const toggleSection = (label: string, value: boolean) => {
    setOpenMap((prev) => ({ ...prev, [label]: value }));
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleNav = (url: string) => {
    startTransition(() => navigate(url));
    if (isMobile) setOpenMobile(false);
  };

  const isRamadan = useSeasonalTheme('ramadan');

  // Collapsed mode: show flat list of items (no group labels)
  if (collapsed) {
    return (
      <Sidebar side={isRTL ? 'right' : 'left'} collapsible="icon" className="font-sans">
        {isRamadan && <RamadanSidebarDecor />}
        <SidebarHeader className="border-b border-sidebar-border h-16 flex items-center justify-center">
          <KojobotLogo size="sm" showText={false} />
        </SidebarHeader>
        <SidebarContent className="px-1.5 py-3">
          {sections.map((section) => (
            <SidebarGroup key={section.label}>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.url)}
                        tooltip={item.title}
                      >
                        <a
                          href={item.url}
                          onClick={(e) => { e.preventDefault(); handleNav(item.url); }}
                          className={cn(
                            'flex items-center justify-center rounded-lg transition-colors',
                            isActive(item.url)
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                          )}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={handleSignOut}
            title={t.auth.logout}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </SidebarFooter>
      </Sidebar>
    );
  }

  return (
    <Sidebar side={isRTL ? 'right' : 'left'} collapsible="icon" className="font-sans">
      {isRamadan && <RamadanSidebarDecor />}
      <SidebarHeader className="border-b border-sidebar-border h-16 flex items-center justify-center">
        <KojobotLogo size="md" showText />
      </SidebarHeader>

      <SidebarContent className="px-2 py-3 gap-1.5">
        {sections.map((section) => {
          const open = isSectionOpen(section);
          const SectionIcon = section.icon;
          const colorKey = section.color ?? 'primary';
          const colors = SECTION_COLOR_STYLES[colorKey];
          return (
            <Collapsible
              key={section.label}
              open={open}
              onOpenChange={(v) => toggleSection(section.label, v)}
              className="group/section"
            >
              <SidebarGroup className="py-0">
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger
                    className={cn(
                      'group/trigger flex w-full items-center justify-between rounded-lg px-2 py-2 text-xs font-semibold tracking-wide transition-all',
                      'border border-transparent text-sidebar-foreground/85',
                      'hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
                      'data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground data-[state=open]:border-sidebar-border data-[state=open]:shadow-sm',
                    )}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                          colors.iconBg
                        )}
                      >
                        {SectionIcon && (
                          <SectionIcon className={cn('h-4 w-4 shrink-0', colors.icon)} />
                        )}
                      </span>
                      <span className="truncate text-[0.78rem]">
                        {isRTL ? section.labelAr : section.label}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 transition-transform duration-200 text-sidebar-foreground/50',
                        open ? 'rotate-0' : isRTL ? 'rotate-90' : '-rotate-90'
                      )}
                    />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
                  <SidebarGroupContent
                    className="mt-1 ms-3 ps-2 border-s-2 transition-colors"
                    style={{
                      borderInlineStartColor: `hsl(var(${colors.borderVar}) / 0.4)`,
                    }}
                  >
                    <SidebarMenu>
                      {section.items.map((item) => {
                        const active = isActive(item.url);
                        const hasChildren = item.children && item.children.length > 0;
                        return (
                          <SidebarMenuItem key={item.url}>
                            <SidebarMenuButton
                              asChild
                              isActive={active}
                              size="sm"
                            >
                              <a
                                href={item.url}
                                onClick={(e) => { e.preventDefault(); handleNav(item.url); }}
                                className={cn(
                                  'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                                  active
                                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                                    : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                                )}
                              >
                                <item.icon className="h-4 w-4 shrink-0" />
                                <span className="truncate">{item.title}</span>
                              </a>
                            </SidebarMenuButton>
                            {hasChildren && (
                              <SidebarMenuSub>
                                {item.children!.map((child) => (
                                  <SidebarMenuSubItem key={child.url}>
                                    <SidebarMenuSubButton asChild isActive={isActive(child.url)}>
                                      <a
                                        href={child.url}
                                        onClick={(e) => { e.preventDefault(); handleNav(child.url); }}
                                      >
                                        <child.icon className="h-3.5 w-3.5" />
                                        <span>{child.title}</span>
                                      </a>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                ))}
                              </SidebarMenuSub>
                            )}
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>{t.auth.logout}</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
