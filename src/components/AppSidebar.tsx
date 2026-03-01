import { useLocation, useNavigate } from 'react-router-dom';
import { useTransition } from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Calendar,
  BookOpen,
  BookMarked,
  ClipboardList,
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
  Scroll,
  Sword,
  BookOpenCheck,
  Sparkles,
  Wallet,
  ShieldAlert,
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
  roles: ('admin' | 'instructor' | 'student' | 'reception')[];
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
  const isStudent = role === 'student';

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
            ],
          },
          {
            label: 'Academic', labelAr: 'الأكاديمي',
            items: [
              { title: t.nav.groups, url: '/groups', icon: Calendar, roles: ['admin'] },
              { title: t.groups.sessions, url: '/sessions', icon: BookOpen, roles: ['admin'] },
              { title: isRTL ? 'السيشنات التعويضية' : 'Makeup Sessions', url: '/makeup-sessions', icon: RefreshCw, roles: ['admin'] },
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
            ],
          },
          {
            label: 'Management', labelAr: 'الإدارة',
            items: [
              { title: isRTL ? 'أداء المدربين' : 'Instructor Performance', url: '/instructor-performance', icon: TrendingUp, roles: ['admin'] },
              { title: isRTL ? 'إنذارات المدربين' : 'Instructor Warnings', url: '/instructor-warnings', icon: AlertTriangle, roles: ['admin'] },
              { title: isRTL ? 'لوحة الترتيب' : 'Leaderboard', url: '/leaderboard', icon: BarChart3, roles: ['admin', 'reception'] },
              { title: isRTL ? 'التقارير الشهرية' : 'Monthly Reports', url: '/monthly-reports', icon: BarChart3, roles: ['admin'] },
              { title: t.nav.activityLog, url: '/activity-log', icon: Activity, roles: ['admin'] },
            ],
          },
          {
            label: 'Settings', labelAr: 'الإعدادات',
            items: [
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
            label: 'Quest Hub', labelAr: '⚔️ مركز المهام',
            items: [
              { title: isRTL ? '🏠 القاعدة' : '🏠 Base', url: '/dashboard', icon: Sparkles, roles: ['student'] },
              { title: isRTL ? '💬 الرسائل' : '💬 Messages', url: '/messages', icon: MessageSquare, roles: ['student'] },
              { title: isRTL ? '🔔 التنبيهات' : '🔔 Alerts', url: '/notifications', icon: Bell, roles: ['student'] },
            ],
          },
          {
            label: 'Adventures', labelAr: '🗺️ المغامرات',
            items: [
              { title: isRTL ? '📜 الكويزات' : '📜 Quizzes', url: '/my-quizzes', icon: Scroll, roles: ['student'] },
              { title: isRTL ? '⚔️ المهمات' : '⚔️ Missions', url: '/assignments', icon: Sword, roles: ['student'] },
              { title: isRTL ? '📖 الكتب السحرية' : '📖 Spellbook', url: '/my-materials', icon: BookOpenCheck, roles: ['student'] },
              { title: isRTL ? '🏰 الحصص' : '🏰 Dungeons', url: '/my-sessions', icon: BookOpen, roles: ['student'] },
              { title: isRTL ? '🏆 الترتيب' : '🏆 Rankings', url: '/leaderboard', icon: BarChart3, roles: ['student'] },
            ],
          },
          {
            label: 'Inventory', labelAr: '🎒 الحقيبة',
            items: [
              { title: isRTL ? '💰 الخزينة' : '💰 Treasury', url: '/my-finances', icon: Wallet, roles: ['student'] },
              { title: isRTL ? '🔄 التعويضية' : '🔄 Side Quests', url: '/my-makeup-sessions', icon: RefreshCw, roles: ['student'] },
              { title: isRTL ? '📊 التقارير' : '📊 Reports', url: '/monthly-reports', icon: BarChart3, roles: ['student'] },
              { title: isRTL ? '⚠️ الإنذارات' : '⚠️ Warnings', url: '/my-warnings', icon: ShieldAlert, roles: ['student'] },
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
              { title: t.nav.groups, url: '/groups', icon: Calendar, roles: ['reception'] },
              { title: t.groups.sessions, url: '/sessions', icon: BookOpen, roles: ['reception'] },
              { title: isRTL ? 'السيشنات التعويضية' : 'Makeup Sessions', url: '/makeup-sessions', icon: RefreshCw, roles: ['reception'] },
              { title: isRTL ? 'جدول العمل' : 'Schedule', url: '/instructor-schedule', icon: CalendarDays, roles: ['reception'] },
            ],
          },
          {
            label: 'Finance', labelAr: 'المالية',
            items: [
              { title: isRTL ? 'الإدارة المالية' : 'Finance', url: '/finance', icon: DollarSign, roles: ['reception'] },
              { title: isRTL ? 'خطط التسعير' : 'Pricing Plans', url: '/pricing-plans', icon: CreditCard, roles: ['reception'] },
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
                'flex items-center gap-3 rounded-lg transition-all text-sm',
                collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2',
                isStudent && 'game-menu-item',
                isActive(item.url)
                  ? isStudent
                    ? 'game-menu-item-active text-primary font-semibold'
                    : 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : isStudent
                    ? 'text-sidebar-foreground/80 hover:text-primary'
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
    <Sidebar
      side={isRTL ? 'right' : 'left'}
      collapsible="icon"
      className={cn('font-sans', isStudent && 'game-sidebar [&_*]:!border-white/10')}
    >
      {isRamadan && <RamadanSidebarDecor />}
      <SidebarHeader className={cn(
        'border-b h-16 flex items-center justify-center',
        isStudent ? 'border-white/10' : 'border-sidebar-border'
      )}>
        <div className="flex items-center justify-center overflow-hidden">
          <KojobotLogo size={collapsed ? 'sm' : 'md'} showText={!collapsed} />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {sections.map((section, idx) => (
          <SidebarGroup key={section.label} className={idx > 0 ? 'mt-4' : ''}>
            {!collapsed && (
              <SidebarGroupLabel className={cn(
                'text-xs uppercase mb-2',
                isStudent ? 'text-primary/70 font-bold tracking-wider' : 'text-muted-foreground'
              )}>
                {isRTL ? section.labelAr : section.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>{renderNavItems(section.items)}</SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className={cn(
        'border-t p-4',
        isStudent ? 'border-white/10' : 'border-sidebar-border'
      )}>
        <Button
          variant="ghost"
          className={cn(
            'w-full gap-2 text-sm',
            collapsed ? 'justify-center px-2' : 'justify-start',
            isStudent
              ? 'text-red-400/70 hover:text-red-400 hover:bg-red-500/10'
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
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
