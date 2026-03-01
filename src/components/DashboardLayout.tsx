import React, { useEffect } from 'react';
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
import { cn } from '@/lib/utils';
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
  const queryClient = useQueryClient();
  const isRamadan = useSeasonalTheme('ramadan');
  const isStudent = role === 'student';

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
          {/* Header */}
          <header className={cn(
            'sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b px-4 md:px-6 relative',
            isStudent
              ? 'game-header-light border-border/50 [&_*]:!rounded-none'
              : 'border-border bg-background'
          )}>
            {isRamadan && <RamadanHeaderDecor />}
            <SidebarTrigger className="-ml-2" />
            
            {/* Mobile Logo */}
            <div className="md:hidden flex items-center">
              <div className="h-8 w-8 rounded-lg kojo-gradient flex items-center justify-center p-1">
                <img src={kojobotLogoWhite} alt="Kojobot" className="h-full object-contain" />
              </div>
            </div>
            
            {title && (
              <h1 className="text-lg md:text-xl font-semibold hidden md:block truncate">{title}</h1>
            )}
            
            <div className="hidden md:flex flex-1 mx-4">
              <GlobalSearch />
            </div>
            
            <div className="flex items-center gap-2 md:gap-3 shrink-0">
              <div className="md:hidden">
                <GlobalSearch />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => navigate('/messages')}
              >
                <MessageSquare className="h-5 w-5" />
                {unreadMessages > 0 && (
                  <Badge variant="default" className="absolute -top-1 -right-1 h-5 min-w-5 p-0 flex items-center justify-center rounded-full text-xs">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </Badge>
                )}
              </Button>
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
          <main className={cn(
            'flex-1 p-4 md:p-6 overflow-x-auto relative',
            isStudent && 'game-theme'
          )}>
            {isRamadan && <RamadanContentDecor />}
            {isRamadan && <RamadanBanner />}
            <div className="min-w-fit relative z-[1]">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
