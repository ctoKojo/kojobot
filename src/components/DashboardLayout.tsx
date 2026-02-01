import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import kojobotLogoWhite from '@/assets/kojobot-logo-white.png';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const { t, isRTL } = useLanguage();
  const { user, role, signOut } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const getRoleLabel = () => {
    switch (role) {
      case 'admin': return t.roles.admin;
      case 'instructor': return t.roles.instructor;
      case 'student': return t.roles.student;
      default: return 'User';
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email;
  const userInitials = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full" dir={isRTL ? 'rtl' : 'ltr'}>
        <AppSidebar />
        
        <SidebarInset className="flex-1">
          {/* Header - h-16 matches sidebar header height */}
          <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-background px-4 md:px-6">
            <SidebarTrigger className="-ml-2">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            
            {/* Mobile Logo - shows only on small screens */}
            <div className="md:hidden flex items-center">
              <div className="h-8 w-8 rounded-lg kojo-gradient flex items-center justify-center p-1">
                <img src={kojobotLogoWhite} alt="Kojobot" className="h-full object-contain" />
              </div>
            </div>
            
            {title && (
              <h1 className="text-lg md:text-xl font-semibold hidden md:block">{title}</h1>
            )}
            
            <div className="flex-1" />
            
            <div className="flex items-center gap-3">
              <NotificationBell />
              <ThemeToggle />
              <LanguageToggle />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarImage 
                        src={profile?.avatar_url || ''} 
                        alt={displayName || ''} 
                      />
                      <AvatarFallback className="kojo-gradient text-white">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align={isRTL ? 'start' : 'end'}>
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{displayName}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium kojo-gradient text-white w-fit mt-1">
                        {getRoleLabel()}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    {t.nav.profile}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    {t.nav.settings}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    {t.auth.logout}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          
          {/* Main Content */}
          <main className="flex-1 p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
