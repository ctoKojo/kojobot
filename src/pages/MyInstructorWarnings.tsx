import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Calendar, FileQuestion, ClipboardList, UserCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useNavigate } from 'react-router-dom';

interface Warning {
  id: string;
  warning_type: string;
  reason: string;
  reason_ar: string | null;
  is_active: boolean;
  created_at: string;
  session_id: string | null;
  sessions?: {
    session_number: number;
    session_date: string;
    groups: {
      name: string;
      name_ar: string;
    };
  } | null;
}

export default function MyInstructorWarnings() {
  const { user } = useAuth();
  const { isRTL, language } = useLanguage();
  const navigate = useNavigate();
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchWarnings();
    }
  }, [user]);

  const fetchWarnings = async () => {
    try {
      const { data, error } = await supabase
        .from('instructor_warnings')
        .select(`
          *,
          sessions(session_number, session_date, groups(name, name_ar))
        `)
        .eq('instructor_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWarnings(data || []);
    } catch (error) {
      console.error('Error fetching warnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const activeWarnings = warnings.filter(w => w.is_active);
  const resolvedWarnings = warnings.filter(w => !w.is_active);

  const getWarningTypeInfo = (type: string) => {
    switch (type) {
      case 'no_quiz':
        return {
          label: isRTL ? 'كويز مفقود' : 'Missing Quiz',
          color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
          icon: FileQuestion,
        };
      case 'no_attendance':
        return {
          label: isRTL ? 'حضور غير مسجل' : 'Missing Attendance',
          color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
          icon: UserCheck,
        };
      case 'no_assignment':
        return {
          label: isRTL ? 'واجب مفقود' : 'Missing Assignment',
          color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
          icon: ClipboardList,
        };
      default:
        return {
          label: type,
          color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
          icon: AlertTriangle,
        };
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const WarningCard = ({ warning }: { warning: Warning }) => {
    const typeInfo = getWarningTypeInfo(warning.warning_type);
    const TypeIcon = typeInfo.icon;

    return (
      <Card 
        className={`${warning.is_active ? 'border-warning' : 'opacity-60'} ${warning.session_id ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
        onClick={() => warning.session_id && navigate(`/session/${warning.session_id}`)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className={`p-2 rounded-lg ${warning.is_active ? 'bg-warning/10' : 'bg-muted'}`}>
              <TypeIcon className={`h-5 w-5 ${warning.is_active ? 'text-warning' : 'text-muted-foreground'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <Badge className={typeInfo.color}>
                  {typeInfo.label}
                </Badge>
                {!warning.is_active && (
                  <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {isRTL ? 'تم الحل' : 'Resolved'}
                  </Badge>
                )}
              </div>
              <p className="font-medium text-sm sm:text-base">
                {language === 'ar' && warning.reason_ar ? warning.reason_ar : warning.reason}
              </p>
              {warning.sessions && (
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {isRTL ? 'السيشن' : 'Session'} {warning.sessions.session_number} - {language === 'ar' ? warning.sessions.groups?.name_ar : warning.sessions.groups?.name}
                  </span>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {formatDate(warning.created_at)}
              </p>
              {warning.session_id && warning.is_active && (
                <p className="text-xs text-primary mt-1">
                  {isRTL ? 'اضغط لفتح السيشن وحل المشكلة' : 'Click to open session and resolve'}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {isRTL ? 'إنذاراتي' : 'My Warnings'}
          </h1>
          <p className="text-muted-foreground">
            {isRTL ? 'تتبع الإنذارات الصادرة لك' : 'Track warnings issued to you'}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-2">
          <Card className={activeWarnings.length > 0 ? 'border-warning' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {isRTL ? 'إنذارات نشطة' : 'Active Warnings'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${activeWarnings.length > 0 ? 'text-warning' : ''}`}>
                {loading ? '...' : activeWarnings.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {isRTL ? 'إنذارات ملغاة' : 'Dismissed Warnings'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-muted-foreground">
                {loading ? '...' : resolvedWarnings.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Warnings Tabs */}
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1">
              <AlertTriangle className="w-4 h-4 mr-2" />
              {isRTL ? 'نشطة' : 'Active'}
              {activeWarnings.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {activeWarnings.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="resolved" className="flex-1">
              <CheckCircle className="w-4 h-4 mr-2" />
              {isRTL ? 'ملغاة' : 'Dismissed'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            {loading ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {isRTL ? 'جاري التحميل...' : 'Loading...'}
                </CardContent>
              </Card>
            ) : activeWarnings.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold">
                    {isRTL ? 'لا توجد إنذارات نشطة' : 'No Active Warnings'}
                  </h3>
                  <p className="text-muted-foreground">
                    {isRTL ? 'أحسنت! استمر في العمل الجيد' : 'Great job! Keep up the good work'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {activeWarnings.map(warning => (
                  <WarningCard key={warning.id} warning={warning} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="resolved" className="mt-4">
            {resolvedWarnings.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {isRTL ? 'لا توجد إنذارات ملغاة' : 'No dismissed warnings'}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {resolvedWarnings.map(warning => (
                  <WarningCard key={warning.id} warning={warning} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Tips Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">
              {isRTL ? 'نصائح لتجنب الإنذارات' : 'Tips to Avoid Warnings'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                {isRTL 
                  ? 'أضف كويز لكل سيشن قبل انتهائها'
                  : 'Add a quiz for each session before it ends'}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                {isRTL 
                  ? 'سجل الحضور أثناء السيشن'
                  : 'Record attendance during the session'}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                {isRTL 
                  ? 'ارفع الواجب خلال 24 ساعة من انتهاء السيشن'
                  : 'Upload assignment within 24 hours after session'}
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
