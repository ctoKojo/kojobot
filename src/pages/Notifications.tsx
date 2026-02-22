import { useState, useEffect, useMemo } from 'react';
import { formatDateTime } from '@/lib/timeUtils';
import { Bell, Check, CheckCheck, Filter, Inbox, BookOpen, ClipboardList, Calendar, CreditCard, Settings, Clock } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface NotificationItem {
  id: string;
  title: string;
  title_ar: string;
  message: string;
  message_ar: string;
  type: string;
  category: string;
  is_read: boolean | null;
  action_url: string | null;
  created_at: string;
}

type ReadFilter = 'all' | 'unread' | 'read';

const CATEGORY_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  general: { icon: Bell, color: 'bg-blue-500' },
  quiz: { icon: BookOpen, color: 'bg-purple-500' },
  assignment: { icon: ClipboardList, color: 'bg-amber-500' },
  attendance: { icon: Calendar, color: 'bg-green-500' },
  subscription: { icon: CreditCard, color: 'bg-pink-500' },
  system: { icon: Settings, color: 'bg-gray-500' },
  schedule: { icon: Clock, color: 'bg-teal-500' },
};

// Role-specific category order
function getCategoriesForRole(role: string | null): string[] {
  switch (role) {
    case 'admin':
      return ['general', 'system', 'attendance', 'subscription', 'quiz', 'assignment', 'schedule'];
    case 'instructor':
      return ['general', 'quiz', 'assignment', 'attendance', 'schedule'];
    case 'student':
      return ['general', 'quiz', 'assignment', 'attendance', 'subscription'];
    case 'reception':
      return ['general', 'subscription', 'attendance', 'system'];
    default:
      return ['general'];
  }
}

export default function NotificationsPage() {
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');

  const categories = useMemo(() => getCategoriesForRole(role), [role]);

  const categoryLabelMap: Record<string, string> = {
    general: t.notifications.categoryGeneral,
    quiz: t.notifications.categoryQuiz,
    assignment: t.notifications.categoryAssignment,
    attendance: t.notifications.categoryAttendance,
    subscription: t.notifications.categorySubscription,
    system: t.notifications.categorySystem,
    schedule: t.notifications.categorySchedule,
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();

      // Real-time subscription
      const channel = supabase
        .channel('notifications-page')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setNotifications(prev => [payload.new as NotificationItem, ...prev]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredNotifications = useMemo(() => {
    let filtered = notifications;
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(n => n.category === selectedCategory);
    }
    if (readFilter === 'unread') {
      filtered = filtered.filter(n => !n.is_read);
    } else if (readFilter === 'read') {
      filtered = filtered.filter(n => n.is_read);
    }
    return filtered;
  }, [notifications, selectedCategory, readFilter]);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    notifications.forEach(n => {
      if (!n.is_read) {
        counts[n.category] = (counts[n.category] || 0) + 1;
      }
    });
    return counts;
  }, [notifications]);

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('is_read', false);
      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast({ title: t.common.success, description: isRTL ? 'تم تحديد الكل كمقروء' : 'All marked as read' });
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'warning': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    }
  };

  const getCategoryIcon = (category: string) => {
    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.general;
    const Icon = config.icon;
    return <Icon className="h-4 w-4" />;
  };

  const getCategoryDotColor = (category: string) => {
    return CATEGORY_CONFIG[category]?.color || CATEGORY_CONFIG.general.color;
  };

  return (
    <DashboardLayout title={t.notifications.title}>
      <div className="space-y-6">
        {/* Header with stats */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                {t.notifications.title}
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {unreadCount}
                  </Badge>
                )}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isRTL ? `${notifications.length} إشعار` : `${notifications.length} notifications`}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllAsRead} size="sm">
              <CheckCheck className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t.notifications.markAllAsRead}
            </Button>
          )}
        </div>

        {/* Category filter chips */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('all')}
            className="gap-1.5"
          >
            <Filter className="h-3.5 w-3.5" />
            {t.notifications.allCategories}
            {unreadCount > 0 && (
              <Badge variant={selectedCategory === 'all' ? 'secondary' : 'destructive'} className="text-xs px-1.5 py-0 h-5 min-w-5">
                {unreadCount}
              </Badge>
            )}
          </Button>
          {categories.map(cat => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className="gap-1.5"
            >
              {getCategoryIcon(cat)}
              {categoryLabelMap[cat] || cat}
              {(categoryCounts[cat] || 0) > 0 && (
                <Badge variant={selectedCategory === cat ? 'secondary' : 'destructive'} className="text-xs px-1.5 py-0 h-5 min-w-5">
                  {categoryCounts[cat]}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Read/Unread filter */}
        <Tabs value={readFilter} onValueChange={(v) => setReadFilter(v as ReadFilter)} className="w-full">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="all" className="flex-1 sm:flex-initial">{t.common.all}</TabsTrigger>
            <TabsTrigger value="unread" className="flex-1 sm:flex-initial">{t.notifications.unread}</TabsTrigger>
            <TabsTrigger value="read" className="flex-1 sm:flex-initial">{t.notifications.read}</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Notifications List */}
        <div className="space-y-3">
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {t.common.loading}
              </CardContent>
            </Card>
          ) : filteredNotifications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t.notifications.noNotifications}</p>
              </CardContent>
            </Card>
          ) : (
            filteredNotifications.map((notification) => (
              <Card
                key={notification.id}
                className={cn(
                  'transition-all cursor-pointer hover:shadow-md',
                  !notification.is_read && 'border-l-4 border-l-primary bg-primary/5'
                )}
                onClick={() => {
                  if (!notification.is_read) markAsRead(notification.id);
                  if (notification.action_url) navigate(notification.action_url);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={cn('w-2.5 h-2.5 rounded-full mt-1.5 shrink-0', getCategoryDotColor(notification.category))} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge className={cn('text-xs', getTypeStyles(notification.type))}>
                            {categoryLabelMap[notification.category] || notification.category}
                          </Badge>
                          {!notification.is_read && (
                            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        <h3 className="font-medium text-sm">
                          {language === 'ar' ? notification.title_ar : notification.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                          {language === 'ar' ? notification.message_ar : notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {formatDateTime(notification.created_at, language)}
                        </p>
                      </div>
                    </div>
                    {!notification.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
