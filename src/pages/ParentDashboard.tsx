import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Users, BookOpen, Eye, Plus, Loader2, CheckCircle, AlertCircle, X, UserPlus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { TelegramLinkPromptBanner } from '@/components/telegram/TelegramLinkPromptBanner';

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
  const { toast } = useToast();
  const [students, setStudents] = useState<LinkedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [newCodes, setNewCodes] = useState<string[]>(['']);
  const [isLinking, setIsLinking] = useState(false);
  const [linkResults, setLinkResults] = useState<{ code: string; status: string }[] | null>(null);

  const fetchStudents = async () => {
    if (!user) return;
    
    const { data: links, error } = await supabase
      .from('parent_students')
      .select('student_id, relationship')
      .eq('parent_id', user.id);

    if (error || !links?.length) {
      setLoading(false);
      return;
    }

    const studentIds = links.map(l => l.student_id);

    const [{ data: profiles }, { data: levels }, { data: ageGroups }, { data: subs }] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, full_name_ar, email, phone, level_id, age_group_id').in('user_id', studentIds),
      supabase.from('levels').select('id, name, name_ar'),
      supabase.from('age_groups').select('id, name, name_ar'),
      supabase.from('subscriptions').select('student_id, status').in('student_id', studentIds).eq('status', 'active'),
    ]);

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

  useEffect(() => {
    fetchStudents();
  }, [user]);

  const addCodeField = () => {
    if (newCodes.length < 5) setNewCodes([...newCodes, '']);
  };

  const removeCodeField = (index: number) => {
    if (newCodes.length > 1) setNewCodes(newCodes.filter((_, i) => i !== index));
  };

  const updateCode = (index: number, value: string) => {
    const upper = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const updated = [...newCodes];
    updated[index] = upper;
    setNewCodes(updated);
  };

  const handleLinkMore = async () => {
    const validCodes = newCodes.filter(c => c.trim().length >= 8);
    if (validCodes.length === 0) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'أدخل كود واحد على الأقل' : 'Enter at least one valid code' });
      return;
    }

    setIsLinking(true);
    setLinkResults(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/register-parent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ codes: validCodes }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.details) setLinkResults(data.details);
        toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: data.error || (isRTL ? 'حدث خطأ' : 'Something went wrong') });
      } else {
        setLinkResults(data.details);
        toast({ title: isRTL ? 'تم بنجاح!' : 'Success!', description: isRTL ? `تم ربط ${data.linked} طالب` : `Linked ${data.linked} student(s)` });
        setTimeout(() => {
          setLinkDialogOpen(false);
          setNewCodes(['']);
          setLinkResults(null);
          fetchStudents();
        }, 1500);
      }
    } catch (error) {
      console.error('Link error:', error);
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'خطأ في الاتصال' : 'Connection error' });
    } finally {
      setIsLinking(false);
    }
  };

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success': return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />{isRTL ? 'تم' : 'Linked'}</Badge>;
      case 'invalid': return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{isRTL ? 'غلط' : 'Invalid'}</Badge>;
      case 'expired': return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{isRTL ? 'منتهي' : 'Expired'}</Badge>;
      case 'already_used': return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{isRTL ? 'مستخدم' : 'Used'}</Badge>;
      default: return null;
    }
  };

  return (
    <DashboardLayout title={isRTL ? 'بوابة ولي الأمر' : 'Parent Portal'}>
      <div className="space-y-6">
        <TelegramLinkPromptBanner />
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              {isRTL ? 'مرحباً، تابع أداء أبنائك 👨‍👩‍👧‍👦' : 'Welcome, track your children\'s progress 👨‍👩‍👧‍👦'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isRTL ? `${students.length} ${students.length === 1 ? 'طالب مربوط' : 'طلاب مربوطين'}` : `${students.length} linked student${students.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          <Dialog open={linkDialogOpen} onOpenChange={(open) => { setLinkDialogOpen(open); if (!open) { setNewCodes(['']); setLinkResults(null); } }}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                {isRTL ? 'إضافة طالب' : 'Add Student'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{isRTL ? 'ربط طالب جديد' : 'Link New Student'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'أدخل كود الربط الذي حصلت عليه من الإدارة' : 'Enter the linking code you received from administration'}
                </p>
                {newCodes.map((code, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      value={code}
                      onChange={(e) => updateCode(index, e.target.value)}
                      placeholder={isRTL ? 'مثال: KJB-A7X2-9P3M' : 'e.g. KJB-A7X2-9P3M'}
                      className="font-mono text-center tracking-wider"
                      maxLength={14}
                    />
                    {newCodes.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeCodeField(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    {linkResults && (
                      <div>{getStatusBadge(linkResults.find(r => r.code === code)?.status || '')}</div>
                    )}
                  </div>
                ))}
                {newCodes.length < 5 && (
                  <Button variant="outline" size="sm" onClick={addCodeField} className="w-full">
                    <Plus className="h-4 w-4 mr-1" />
                    {isRTL ? 'كود إضافي' : 'Add another code'}
                  </Button>
                )}
                <Button
                  onClick={handleLinkMore}
                  disabled={isLinking || newCodes.every(c => c.trim().length < 8)}
                  className="w-full"
                >
                  {isLinking ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{isRTL ? 'جاري الربط...' : 'Linking...'}</>
                  ) : (
                    isRTL ? 'ربط' : 'Link'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
              <p className="text-muted-foreground mb-4">
                {isRTL ? 'أضف طالب باستخدام كود الربط' : 'Add a student using a linking code'}
              </p>
              <Button onClick={() => setLinkDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                {isRTL ? 'إضافة طالب' : 'Add Student'}
              </Button>
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