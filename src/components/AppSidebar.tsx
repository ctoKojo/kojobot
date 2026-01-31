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
  ];

  const educationNavItems: NavItem[] = [
    { title: t.nav.questionBank, url: '/quizzes', icon: FileQuestion, roles: ['admin', 'instructor'] },
    { title: t.nav.assignments, url: '/assignments', icon: ClipboardList, roles: ['admin', 'instructor', 'student'] },
    { title: t.nav.attendance, url: '/attendance', icon: UserCheck, roles: ['admin', 'instructor', 'student'] },
  ];

  const settingsNavItems: NavItem[] = [
    { title: t.nav.ageGroups, url: '/age-groups', icon: Layers, roles: ['admin'] },
    { title: t.nav.levels, url: '/levels', icon: BookOpen, roles: ['admin'] },
    { title: t.nav.activityLog, url: '/activity-log', icon: Activity, roles: ['admin'] },
    { title: t.nav.notifications, url: '/notifications', icon: Bell, roles: ['admin', 'instructor', 'student'] },
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
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                isActive(item.url)
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  return (
    <Sidebar side={isRTL ? 'right' : 'left'} collapsible="icon">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center justify-center">
          <KojobotLogo size={collapsed ? 'sm' : 'md'} />
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

      <SidebarFooter className="border-t p-4">
        <Button
          variant="ghost"
          className={cn('w-full justify-start gap-2', collapsed && 'justify-center')}
          onClick={handleSignOut}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>{t.auth.logout}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
