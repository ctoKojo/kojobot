import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Users, BookOpen, CreditCard, Eye } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface LinkedStudent {
  student_id: string;
  relationship: string;
  profile: {
    full_name: string;
    full_name_ar: string | null;
    email: string;
    phone: string | null;
    level_id: string | null;
    age_group_id: string | null;
  } | null;
  level_name?: string;
  level_name_ar?: string;
  age_group_name?: string;
  age_group_name_ar?: string;
  attendance_rate?: number;
  active_subscription?: boolean;
}

export default function ParentDashboard() {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [students, setStudents] = useState<LinkedStudent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchStudents = async () => {
      // Get linked students
      const { data: links, error } = await supabase
        .from('parent_students')
        .select('student_id, relationship')
        .eq('parent_id', user.id);

      if (error || !links?.length) {
        setLoading(false);
        return;
      }

      const studentIds = links.map(l => l.student_id);

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, full_name_ar, email, phone, level_id, age_group_id')
        .in('user_id', studentIds);

      // Fetch levels
      const { data: levels } = await supabase
        .from('levels')
        .select('id, name, name_ar');

      // Fetch age groups
      const { data: ageGroups } = await supabase
        .from('age_groups')
        .select('id, name, name_ar');

      // Fetch active subscriptions
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('student_id, status')
        .in('student_id', studentIds)
        .eq('status', 'active');

      const enriched: LinkedStudent[] = links.map(link => {
        const profile = profiles?.find(p => p.user_id === link.student_id) || null;
        const level = levels?.find(l => l.id === profile?.level_id);
        const ageGroup = ageGroups?.find(ag => ag.id === profile?.age_group_id);
        const hasSub = subs?.some(s => s.student_id === link.student_id);

        return {
          student_id: link.student_id,
          relationship: link.relationship,
          profile: profile ? {
            full_name: profile.full_name,
            full_name_ar: profile.full_name_ar,
            email: profile.email,
            phone: profile.phone,
            level_id: profile.level_id,
            age_group_id: profile.age_group_id,
          } : null,
          level_name: level?.name,
          level_name_ar: level?.name_ar,
          age_group_name: ageGroup?.name,
          age_group_name_ar: ageGroup?.name_ar,
          active_subscription: hasSub,
        };
      });

      setStudents(enriched);
      setLoading(false);
    };

    fetchStudents();
  }, [user]);

  const getRelationshipLabel = (rel: string) => {
    if (isRTL) {
      switch (rel) {
        case 'father': return 'أب';
        case 'mother': return 'أم';
        case 'guardian': return 'وصي';
        default: return 'ولي أمر';
      }
    }
    switch (rel) {
      case 'father': return 'Father';
      case 'mother': return 'Mother';
      case 'guardian': return 'Guardian';
      default: return 'Parent';
    }
  };

  return (
    <DashboardLayout title={isRTL ? 'بوابة ولي الأمر' : 'Parent Portal'}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            {isRTL ? 'مرحباً، تابع أداء أبنائك 👨‍👩‍👧‍👦' : 'Welcome, track your children\'s progress 👨‍👩‍👧‍👦'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isRTL ? `${students.length} ${students.length === 1 ? 'طالب مربوط' : 'طلاب مربوطين'}` : `${students.length} linked student${students.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2].map(i => (
              <Card key={i}><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : students.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {isRTL ? 'لا يوجد طلاب مربوطين' : 'No linked students'}
              </h3>
              <p className="text-muted-foreground">
                {isRTL ? 'تواصل مع الإدارة لربط حساب ابنك' : 'Contact administration to link your child\'s account'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {students.map(student => (
              <Card key={student.student_id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {isRTL ? student.profile?.full_name_ar || student.profile?.full_name : student.profile?.full_name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {getRelationshipLabel(student.relationship)}
                      </p>
                    </div>
                    <Badge variant={student.active_subscription ? 'default' : 'destructive'}>
                      {student.active_subscription
                        ? (isRTL ? 'مشترك' : 'Active')
                        : (isRTL ? 'غير مشترك' : 'Inactive')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {isRTL ? 'المستوى: ' : 'Level: '}
                      {isRTL ? student.level_name_ar || student.level_name || '—' : student.level_name || '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {isRTL ? 'الفئة: ' : 'Age Group: '}
                      {isRTL ? student.age_group_name_ar || student.age_group_name || '—' : student.age_group_name || '—'}
                    </span>
                  </div>
                  <Button
                    className="w-full mt-2"
                    variant="outline"
                    onClick={() => navigate(`/parent/student/${student.student_id}`)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {isRTL ? 'عرض التفاصيل' : 'View Details'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}