import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, Calendar, Bell, LogOut, Settings, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { KojobotLogo } from '@/components/KojobotLogo';
import { LanguageToggle } from '@/components/LanguageToggle';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, role, loading, signOut } = useAuth();
  const { t, isRTL } = useLanguage();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <KojobotLogo size="xl" />
          <p className="mt-4 text-muted-foreground">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getRoleLabel = () => {
    switch (role) {
      case 'admin': return t.roles.admin;
      case 'instructor': return t.roles.instructor;
      case 'student': return t.roles.student;
      default: return 'User';
    }
  };

  const stats = [
    {
      title: t.dashboard.totalStudents,
      value: '156',
      icon: GraduationCap,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: t.dashboard.totalInstructors,
      value: '12',
      icon: Users,
      color: 'text-secondary',
      bgColor: 'bg-secondary/10',
    },
    {
      title: t.dashboard.totalGroups,
      value: '24',
      icon: Calendar,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: t.dashboard.activeSubscriptions,
      value: '142',
      icon: Bell,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
  ];

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <KojobotLogo size="sm" />
          
          <div className="flex items-center gap-4">
            <LanguageToggle />
            
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{user.email}</span>
              <span className="px-2 py-1 rounded-full text-xs font-medium kojo-gradient text-white">
                {getRoleLabel()}
              </span>
            </div>
            
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            {t.dashboard.welcome}, {user.user_metadata?.full_name || user.email?.split('@')[0]}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            {role === 'admin' && 'Manage your educational platform'}
            {role === 'instructor' && 'Track your groups and students'}
            {role === 'student' && 'View your courses and assignments'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {stats.map((stat) => (
            <Card key={stat.title} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {role === 'admin' && (
            <>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                    {t.nav.students}
                  </CardTitle>
                  <CardDescription>
                    Manage all students and their subscriptions
                  </CardDescription>
                </CardHeader>
              </Card>
              
              <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-secondary group-hover:scale-110 transition-transform" />
                    {t.nav.instructors}
                  </CardTitle>
                  <CardDescription>
                    Manage instructors and their groups
                  </CardDescription>
                </CardHeader>
              </Card>
              
              <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-muted-foreground group-hover:scale-110 transition-transform" />
                    {t.nav.settings}
                  </CardTitle>
                  <CardDescription>
                    Configure age groups, levels, and system settings
                  </CardDescription>
                </CardHeader>
              </Card>
            </>
          )}

          {role === 'instructor' && (
            <>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                    {t.nav.groups}
                  </CardTitle>
                  <CardDescription>
                    View and manage your assigned groups
                  </CardDescription>
                </CardHeader>
              </Card>
              
              <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LayoutDashboard className="h-5 w-5 text-secondary group-hover:scale-110 transition-transform" />
                    {t.nav.attendance}
                  </CardTitle>
                  <CardDescription>
                    Track and record student attendance
                  </CardDescription>
                </CardHeader>
              </Card>
            </>
          )}

          {role === 'student' && (
            <>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                    {t.nav.quizzes}
                  </CardTitle>
                  <CardDescription>
                    View and complete assigned quizzes
                  </CardDescription>
                </CardHeader>
              </Card>
              
              <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LayoutDashboard className="h-5 w-5 text-secondary group-hover:scale-110 transition-transform" />
                    {t.nav.assignments}
                  </CardTitle>
                  <CardDescription>
                    Submit your assignments
                  </CardDescription>
                </CardHeader>
              </Card>
            </>
          )}

          {!role && (
            <Card className="col-span-full">
              <CardHeader>
                <CardTitle className="text-center text-muted-foreground">
                  Your account has not been assigned a role yet.
                </CardTitle>
                <CardDescription className="text-center">
                  Please contact an administrator to get access.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
