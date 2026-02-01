import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Calendar,
  BookOpen,
  ClipboardList,
  UserCheck,
  Settings,
  Layers,
  Activity,
  Bell,
  FileQuestion,
  LogOut,
  CalendarDays,
  BarChart3,
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

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: ('admin' | 'instructor' | 'student')[];
}

export function AppSidebar() {
  const { t, isRTL } = useLanguage();
  const { role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const mainNavItems: NavItem[] = [
    { title: t.nav.dashboard, url: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'instructor', 'student'] },
    { title: t.nav.students, url: '/students', icon: GraduationCap, roles: ['admin'] },
    { title: t.nav.instructors, url: '/instructors', icon: Users, roles: ['admin'] },
    { title: t.nav.groups, url: '/groups', icon: Calendar, roles: ['admin', 'instructor'] },
    { title: t.groups.sessions, url: '/sessions', icon: BookOpen, roles: ['admin', 'instructor'] },
    { title: isRTL ? 'جدول العمل' : 'My Schedule', url: '/instructor-schedule', icon: CalendarDays, roles: ['instructor'] },
  ];

  const educationNavItems: NavItem[] = [
    { title: t.nav.questionBank, url: '/quizzes', icon: FileQuestion, roles: ['admin'] },
    { title: isRTL ? 'كويزات المجموعات' : 'Group Quizzes', url: '/my-instructor-quizzes', icon: FileQuestion, roles: ['instructor'] },
    { title: isRTL ? 'كويزاتي' : 'My Quizzes', url: '/my-quizzes', icon: FileQuestion, roles: ['student'] },
    { title: isRTL ? 'تقارير الكويزات' : 'Quiz Reports', url: '/quiz-reports', icon: BarChart3, roles: ['admin'] },
    { title: t.nav.assignments, url: '/assignments', icon: ClipboardList, roles: ['admin', 'instructor', 'student'] },
    { title: t.nav.attendance, url: '/attendance', icon: UserCheck, roles: ['admin', 'instructor', 'student'] },
  ];

  const settingsNavItems: NavItem[] = [
    { title: t.nav.ageGroups, url: '/age-groups', icon: Layers, roles: ['admin'] },
    { title: t.nav.levels, url: '/levels', icon: BookOpen, roles: ['admin'] },
    { title: t.nav.activityLog, url: '/activity-log', icon: Activity, roles: ['admin'] },
    { title: t.nav.notifications, url: '/notifications', icon: Bell, roles: ['admin', 'student'] },
    { title: t.nav.settings, url: '/settings', icon: Settings, roles: ['admin'] },
  ];

  const filterByRole = (items: NavItem[]) => items.filter((item) => role && item.roles.includes(role));
  const isActive = (url: string) => location.pathname === url;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const renderNavItems = (items: NavItem[]) => (
    <SidebarMenu>
      {filterByRole(items).map((item) => (
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
                navigate(item.url);
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

  return (
    <Sidebar side={isRTL ? 'right' : 'left'} collapsible="icon" className="font-sans">
      <SidebarHeader className="border-b border-sidebar-border h-16 flex items-center justify-center">
        <div className="flex items-center justify-center overflow-hidden">
          <KojobotLogo size={collapsed ? 'sm' : 'md'} showText={!collapsed} />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-xs uppercase text-muted-foreground mb-2">
              {isRTL ? 'القائمة الرئيسية' : 'Main Menu'}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>{renderNavItems(mainNavItems)}</SidebarGroupContent>
        </SidebarGroup>

        {filterByRole(educationNavItems).length > 0 && (
          <SidebarGroup className="mt-4">
            {!collapsed && (
              <SidebarGroupLabel className="text-xs uppercase text-muted-foreground mb-2">
                {isRTL ? 'التعليم' : 'Education'}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>{renderNavItems(educationNavItems)}</SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup className="mt-4">
          {!collapsed && (
            <SidebarGroupLabel className="text-xs uppercase text-muted-foreground mb-2">
              {isRTL ? 'الإعدادات' : 'Settings'}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>{renderNavItems(settingsNavItems)}</SidebarGroupContent>
        </SidebarGroup>
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
