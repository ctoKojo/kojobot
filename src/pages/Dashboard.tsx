import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { InstructorDashboard } from '@/components/dashboard/InstructorDashboard';
import { StudentDashboard } from '@/components/dashboard/StudentDashboard';
import { ReceptionDashboard } from '@/components/dashboard/ReceptionDashboard';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import React, { Suspense } from 'react';
import { LoadingScreen } from '@/components/LoadingScreen';

const ParentDashboard = React.lazy(() => import('./ParentDashboard'));

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
        case 'reception': return 'إدارة العمليات اليومية';
        case 'parent': return 'تابع أداء أبنائك';
        default: return '';
      }
    }
    switch (role) {
      case 'admin': return 'Manage your educational platform';
      case 'instructor': return 'Track your groups and students';
      case 'student': return 'View your courses and assignments';
      case 'reception': return 'Manage daily operations';
      case 'parent': return 'Track your children\'s progress';
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
      case 'reception':
        return <ReceptionDashboard />;
      case 'parent':
        return <Suspense fallback={<LoadingScreen />}><ParentDashboard /></Suspense>;
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

  // For parent role, ParentDashboard renders its own DashboardLayout
  if (role === 'parent') {
    return renderDashboard();
  }

  return (
    <DashboardLayout title={t.nav.dashboard}>
      <div className="space-y-6 md:space-y-8">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">{getWelcomeMessage()}</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">{getSubtitle()}</p>
        </div>
        {renderDashboard()}
      </div>
    </DashboardLayout>
  );
}
