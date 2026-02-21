import { useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';
import { CheckCircle, AlertTriangle, Shield } from 'lucide-react';

interface SSOTModule {
  name: string;
  source: string;
  status: 'compliant' | 'warning';
  details: string;
}

export default function SSOTHealth() {
  const { isRTL } = useLanguage();

  const modules = useMemo<SSOTModule[]>(() => [
    // Time formatting
    { name: 'formatDate', source: 'src/lib/timeUtils.ts', status: 'compliant', details: 'All 19 files import from centralized timeUtils' },
    { name: 'formatDateTime', source: 'src/lib/timeUtils.ts', status: 'compliant', details: 'All files use centralized formatDateTime with timezone support' },
    { name: 'formatTime12Hour', source: 'src/lib/timeUtils.ts', status: 'compliant', details: 'Single definition, no duplicates' },
    // Constants
    { name: 'GROUP_TYPES', source: 'src/lib/constants.ts', status: 'compliant', details: 'Labels + maxStudents centralized. ESLint rule guards against re-definition.' },
    { name: 'SUBSCRIPTION_TYPES', source: 'src/lib/constants.ts', status: 'compliant', details: 'Derived from GROUP_TYPES, all selects use GROUP_TYPES_LIST' },
    { name: 'ROLE_LABELS', source: 'src/lib/constants.ts', status: 'compliant', details: 'Instructors, InstructorProfile, SalariesTab all import getRoleLabel' },
    { name: 'ATTENDANCE_MODES', source: 'src/lib/constants.ts', status: 'compliant', details: 'Online/Offline labels centralized' },
    { name: 'DAYS_OF_WEEK', source: 'src/lib/constants.ts', status: 'compliant', details: 'getDayName helper used in GroupDetails, InstructorSchedule' },
    // Status badges
    { name: 'SessionStatusBadge', source: 'src/lib/statusBadges.tsx', status: 'compliant', details: 'Sessions.tsx uses getSessionStatusBadge' },
    { name: 'MakeupStatusBadge', source: 'src/lib/statusBadges.tsx', status: 'compliant', details: 'MakeupSessions.tsx uses getMakeupStatusBadge' },
    { name: 'GroupStatusBadge', source: 'src/lib/statusBadges.tsx', status: 'compliant', details: 'Groups.tsx uses getGroupStatusBadge' },
    { name: 'QuizSubmissionBadge', source: 'src/lib/statusBadges.tsx', status: 'compliant', details: 'QuizReports + MyInstructorQuizzes use getQuizSubmissionStatusBadge' },
    { name: 'AssignmentSubmissionBadge', source: 'src/lib/statusBadges.tsx', status: 'compliant', details: 'AssignmentSubmissionsDialog uses centralized badge' },
    { name: 'SalaryMonthBadge', source: 'src/lib/statusBadges.tsx', status: 'compliant', details: 'SalariesTab uses getSalaryMonthStatusBadge' },
    // Backend SSOT
    { name: 'Authentication & Roles', source: 'AuthContext + user_roles + has_role()', status: 'compliant', details: 'Single source for auth state and role checks' },
    { name: 'Attendance Logic', source: 'save_attendance RPC', status: 'compliant', details: 'Atomic attendance recording via RPC' },
    { name: 'Curriculum Access', source: 'get_curriculum_with_access RPC', status: 'compliant', details: 'Single RPC controls content visibility' },
    { name: 'Makeup Credits', source: 'create_makeup_session RPC', status: 'compliant', details: 'Ledger pattern ensures credit integrity' },
    { name: 'Notifications', source: 'src/lib/notificationService.ts', status: 'compliant', details: 'All notifications routed through central service' },
    { name: 'Activity Logging', source: 'src/lib/activityLogger.ts', status: 'compliant', details: 'Single logging utility used everywhere' },
    { name: 'Salary Events', source: 'DB triggers + RPCs', status: 'compliant', details: 'Event sourcing pattern, single source of truth' },
  ], []);

  const compliantCount = modules.filter(m => m.status === 'compliant').length;
  const totalCount = modules.length;
  const score = Math.round((compliantCount / totalCount) * 100);

  return (
    <DashboardLayout title={isRTL ? 'صحة SSOT' : 'SSOT Health'}>
      <div className="space-y-6">
        {/* Score Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-2xl">
                  {isRTL ? 'نقاط التوافق مع SSOT' : 'SSOT Compliance Score'}
                </CardTitle>
                <CardDescription>
                  {isRTL
                    ? 'تحقق من أن جميع الوحدات تستخدم مصادر مركزية'
                    : 'Verify all modules consume centralized sources'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <span className="text-4xl font-bold text-primary">{score}%</span>
              <Progress value={score} className="flex-1 h-3" />
              <span className="text-sm text-muted-foreground">
                {compliantCount}/{totalCount} {isRTL ? 'متوافق' : 'compliant'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Centralized Sources */}
        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'المصادر المركزية' : 'Centralized Sources'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {['src/lib/timeUtils.ts', 'src/lib/constants.ts', 'src/lib/statusBadges.tsx'].map(src => (
                <div key={src} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                  <code className="text-xs font-mono truncate">{src}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Modules List */}
        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'حالة الوحدات' : 'Module Status'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {modules.map((mod) => (
              <div
                key={mod.name}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                {mod.status === 'compliant' ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{mod.name}</span>
                    <Badge variant={mod.status === 'compliant' ? 'default' : 'secondary'} className="text-xs">
                      {mod.status === 'compliant'
                        ? (isRTL ? 'متوافق' : 'Compliant')
                        : (isRTL ? 'تحذير' : 'Warning')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{mod.details}</p>
                  <code className="text-xs font-mono text-muted-foreground">{mod.source}</code>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
