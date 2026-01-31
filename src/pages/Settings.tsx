import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SettingsPage() {
  const { t, isRTL } = useLanguage();

  return (
    <DashboardLayout title={t.settings.title}>
      <div className="space-y-6 max-w-2xl">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t.settings.general}</CardTitle>
            <CardDescription>
              {isRTL ? 'إعدادات عامة للنظام' : 'General system settings'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Language */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">{t.settings.language}</Label>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'اختر لغة الواجهة' : 'Select interface language'}
                </p>
              </div>
              <LanguageToggle />
            </div>
          </CardContent>
        </Card>

        {/* Notifications Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{t.notifications.title}</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {isRTL ? 'قريباً' : 'Coming Soon'}
              </Badge>
            </div>
            <CardDescription>
              {isRTL ? 'إعدادات الإشعارات' : 'Notification preferences'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 opacity-60">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">
                  {isRTL ? 'إشعارات الكويزات' : 'Quiz Notifications'}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'تلقي إشعارات عند إسناد كويزات جديدة' : 'Get notified when new quizzes are assigned'}
                </p>
              </div>
              <Switch defaultChecked disabled />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">
                  {isRTL ? 'إشعارات الواجبات' : 'Assignment Notifications'}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'تلقي إشعارات عند إضافة واجبات جديدة' : 'Get notified when new assignments are added'}
                </p>
              </div>
              <Switch defaultChecked disabled />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">
                  {isRTL ? 'تذكيرات المواعيد' : 'Due Date Reminders'}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'تذكيرات قبل انتهاء مواعيد التسليم' : 'Reminders before submission deadlines'}
                </p>
              </div>
              <Switch defaultChecked disabled />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
