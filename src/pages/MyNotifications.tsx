import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { TelegramLinkCard } from '@/components/telegram/TelegramLinkCard';
import { NotificationChannelPreferences } from '@/components/telegram/NotificationChannelPreferences';
import { useLanguage } from '@/contexts/LanguageContext';
import { Bell } from 'lucide-react';

export default function MyNotifications() {
  const { isRTL } = useLanguage();
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          icon={Bell}
          title={isRTL ? 'إشعاراتي' : 'My Notifications'}
          subtitle={
            isRTL
              ? 'اربط Telegram وتحكم في القنوات اللي توصلك منها الإشعارات'
              : 'Link Telegram and control which channels deliver your notifications'
          }
        />
        <TelegramLinkCard />
        <NotificationChannelPreferences />
      </div>
    </DashboardLayout>
  );
}
