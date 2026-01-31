import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { InstructorDashboard } from '@/components/dashboard/InstructorDashboard';
import { StudentDashboard } from '@/components/dashboard/StudentDashboard';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function Dashboard() {
  const { user, role } = useAuth();
  const { t, isRTL } = useLanguage();

  const getWelcomeMessage = () => {
    const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
    return `${t.dashboard.welcome}, ${name}! 👋`;
  };

  const getSubtitle = () => {
    if (isRTL) {
      switch (role) {
        case 'admin': return 'إدارة منصتك التعليمية';
        case 'instructor': return 'تابع مجموعاتك وطلابك';
        case 'student': return 'شاهد دوراتك ومهامك';
        default: return '';
      }
    }
    switch (role) {
      case 'admin': return 'Manage your educational platform';
      case 'instructor': return 'Track your groups and students';
      case 'student': return 'View your courses and assignments';
      default: return '';
    }
  };

  const renderDashboard = () => {
    switch (role) {
      case 'admin':
        return <AdminDashboard />;
      case 'instructor':
        return <InstructorDashboard />;
      case 'student':
        return <StudentDashboard />;
      default:
        return (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-muted-foreground">
                {isRTL ? 'لم يتم تعيين دور لحسابك بعد' : 'Your account has not been assigned a role yet'}
              </CardTitle>
              <CardDescription>
                {isRTL ? 'يرجى التواصل مع المسؤول للحصول على صلاحيات' : 'Please contact an administrator to get access'}
              </CardDescription>
            </CardHeader>
          </Card>
        );
    }
  };

  return (
    <DashboardLayout title={t.nav.dashboard}>
      <div className="space-y-6 md:space-y-8">
        {/* Welcome Section */}
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">{getWelcomeMessage()}</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">{getSubtitle()}</p>
        </div>

        {/* Role-specific Dashboard */}
        {renderDashboard()}
      </div>
    </DashboardLayout>
  );
}
