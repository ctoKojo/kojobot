import React, { useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { useSeasonalTheme } from '@/hooks/useSeasonalTheme';
import { RamadanBanner, RamadanHeaderDecor, RamadanContentDecor } from '@/components/RamadanTheme';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { GlobalSearch } from '@/components/GlobalSearch';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import kojobotLogoWhite from '@/assets/kojobot-logo-white.png';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const KojoChatWidget = lazy(() => import('@/components/KojoChatWidget').then(m => ({ default: m.KojoChatWidget })));

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const { t, isRTL } = useLanguage();
  const { user, role, signOut } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isRamadan = useSeasonalTheme('ramadan');

  // Unread messages count (refreshed by realtime via useRealtimeMessages hook in Messages page)
  const { data: unreadMessages = 0 } = useQuery({
    queryKey: ['unread-messages-count'],
    queryFn: async () => {
      if (!user) return 0;
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id);
      if (!participations?.length) return 0;
      let total = 0;
      for (const p of participations) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', p.conversation_id)
          .neq('sender_id', user.id)
          .gt('created_at', p.last_read_at || '1970-01-01');
        total += count || 0;
      }
      return total;
    },
    enabled: !!user,
    staleTime: 30000,
  });

  // Realtime subscription for unread count updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('dashboard-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_participants' }, () => {
        queryClient.invalidateQueries({ queryKey: ['unread-messages-count'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

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
        
        <SidebarInset className="flex-1 flex flex-col min-w-0">
          {/* Header - fixed height, doesn't scroll with content */}
          <header className="sticky top-0 z-40 flex h-14 md:h-16 shrink-0 items-center gap-1.5 sm:gap-3 border-b border-border bg-background px-2 sm:px-4 md:px-6 w-full relative">
            {isRamadan && <RamadanHeaderDecor />}
            <SidebarTrigger className="-ml-1 sm:-ml-2" />
            
            {/* Mobile Logo - shows only on small screens */}
            <div className="md:hidden flex items-center">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg kojo-gradient flex items-center justify-center p-1">
                <img src={kojobotLogoWhite} alt="Kojobot" className="h-full object-contain" />
              </div>
            </div>
            
            {title && (
              <h1 className="text-lg md:text-xl font-semibold hidden md:block truncate">{title}</h1>
            )}
            
            <div className="hidden md:flex flex-1 mx-4">
              <GlobalSearch />
            </div>

            {/* Spacer to push right side items */}
            <div className="flex-1 md:hidden" />
            
            <div className="flex items-center gap-1 sm:gap-2 md:gap-3 shrink-0">
              <div className="md:hidden">
                <GlobalSearch />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-8 w-8 sm:h-10 sm:w-10"
                onClick={() => navigate('/messages')}
              >
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                {unreadMessages > 0 && (
                  <Badge variant="default" className="absolute -top-1 -right-1 h-4 min-w-4 sm:h-5 sm:min-w-5 p-0 flex items-center justify-center rounded-full text-[10px] sm:text-xs">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </Badge>
                )}
              </Button>
              <NotificationBell />
              <span className="hidden sm:inline-flex"><ThemeToggle /></span>
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
                  <div className="sm:hidden px-2 py-1.5 flex items-center gap-2">
                    <ThemeToggle />
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    {t.auth.logout}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          
          {/* Main Content - scrollable area for tables */}
          <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden relative">
            {isRamadan && <RamadanContentDecor />}
            {isRamadan && <RamadanBanner />}
            <div className="w-full max-w-full relative z-[1]">
              {children}
            </div>
          </main>
        </SidebarInset>
        {role === 'student' && (
          <Suspense fallback={null}>
            <KojoChatWidget />
          </Suspense>
        )}
      </div>
    </SidebarProvider>
  );
}
