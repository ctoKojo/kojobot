import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Eye, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PlacementAttemptDetailDialog } from '@/components/placement-exam/PlacementAttemptDetailDialog';

interface V2Attempt {
  id: string;
  student_id: string;
  attempt_number: number;
  status: string;
  section_a_score: number | null;
  section_a_max: number | null;
  section_a_passed: boolean | null;
  section_b_score: number | null;
  section_b_max: number | null;
  section_b_passed: boolean | null;
  section_c_software_score: number | null;
  section_c_software_max: number | null;
  section_c_hardware_score: number | null;
  section_c_hardware_max: number | null;
  recommended_track: string | null;
  recommended_level_id: string | null;
  approved_level_id: string | null;
  confidence_level: string | null;
  needs_manual_review: boolean | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  created_at: string | null;
}

interface Level {
  id: string;
  name: string;
  name_ar: string;
  level_order: number;
  track: string | null;
}

interface StudentProfile {
  user_id: string;
  full_name: string;
  full_name_ar: string | null;
}

export default function PlacementTestReview() {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<V2Attempt[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [profiles, setProfiles] = useState<Record<string, StudentProfile>>({});
  const [loading, setLoading] = useState(true);
  const [selectedAttempt, setSelectedAttempt] = useState<V2Attempt | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [attemptsRes, levelsRes] = await Promise.all([
        supabase.from('placement_v2_attempts')
          .select('*')
          .in('status', ['submitted', 'reviewed'])
          .order('submitted_at', { ascending: false }),
        supabase.from('levels')
          .select('id, name, name_ar, level_order, track')
          .eq('is_active', true)
          .order('level_order'),
      ]);

      const attemptsData = (attemptsRes.data || []) as unknown as V2Attempt[];
      setAttempts(attemptsData);
      setLevels(levelsRes.data || []);

      const studentIds = [...new Set(attemptsData.map(a => a.student_id))];
      if (studentIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, full_name_ar')
          .in('user_id', studentIds);
        const map: Record<string, StudentProfile> = {};
        (profilesData || []).forEach((p: any) => { map[p.user_id] = p; });
        setProfiles(map);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApproveLevel = async (attempt: V2Attempt, levelId: string) => {
    if (!user) return;
    setApproving(true);
    try {
      const { error } = await supabase.from('placement_v2_attempts')
        .update({
          approved_level_id: levelId,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          status: 'reviewed',
        })
        .eq('id', attempt.id);
      if (error) throw error;

      // Also update the student's profile level
      await supabase.from('profiles')
        .update({ level_id: levelId })
        .eq('user_id', attempt.student_id);

      toast({ title: isRTL ? 'تم اعتماد المستوى بنجاح' : 'Level approved successfully' });
      fetchData();
      setDetailOpen(false);
    } catch (err: any) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setApproving(false);
    }
  };

  const getConfidenceBadge = (level: string | null) => {
    if (!level) return null;
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      high: 'default', medium: 'secondary', low: 'destructive',
    };
    return <Badge variant={variants[level] || 'secondary'} className="capitalize">{level}</Badge>;
  };

  const pct = (score: number | null, max: number | null) => {
    if (score == null || !max) return '—';
    return `${score}/${max} (${Math.round((score / max) * 100)}%)`;
  };

  const needsReviewCount = attempts.filter(a => a.needs_manual_review && a.status === 'submitted').length;

  if (loading) {
    return (
      <DashboardLayout title={isRTL ? 'مراجعة تحديد المستوى' : 'Placement Exam Review'}>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={isRTL ? 'مراجعة تحديد المستوى' : 'Placement Exam Review'}>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-lg">
              <ClipboardCheck className="h-5 w-5 text-white" />
            </div>
            {isRTL ? 'مراجعة امتحانات تحديد المستوى' : 'Placement Exam Review'}
          </h1>
          {needsReviewCount > 0 && (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-sm px-3 py-1.5">
              <AlertTriangle className="h-3 w-3 me-1" />
              {isRTL ? `${needsReviewCount} تحتاج مراجعة يدوية` : `${needsReviewCount} need manual review`}
            </Badge>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isRTL ? 'الامتحانات المقدمة' : 'Submitted Exams'}</CardTitle>
          </CardHeader>
          <CardContent>
            {attempts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {isRTL ? 'لا توجد امتحانات مقدمة' : 'No submitted exams yet'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                    <TableHead>{isRTL ? 'القسم A' : 'Sec A'}</TableHead>
                    <TableHead>{isRTL ? 'القسم B' : 'Sec B'}</TableHead>
                    <TableHead>{isRTL ? 'المسار' : 'Track'}</TableHead>
                    <TableHead>{isRTL ? 'الثقة' : 'Confidence'}</TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead>{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map(a => {
                    const profile = profiles[a.student_id];
                    const isBalanced = a.recommended_track === 'balanced';
                    return (
                      <TableRow
                        key={a.id}
                        className={a.needs_manual_review && a.status === 'submitted' ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}
                      >
                        <TableCell className="font-medium">
                          {profile ? (isRTL ? (profile.full_name_ar || profile.full_name) : profile.full_name) : '—'}
                        </TableCell>
                        <TableCell>
                          <span className={a.section_a_passed ? 'text-green-600' : 'text-red-600'}>
                            {pct(a.section_a_score, a.section_a_max)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={a.section_b_passed ? 'text-green-600' : 'text-red-600'}>
                            {pct(a.section_b_score, a.section_b_max)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={isBalanced ? 'destructive' : 'outline'} className="capitalize">
                            {a.recommended_track || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell>{getConfidenceBadge(a.confidence_level)}</TableCell>
                        <TableCell>
                          <Badge variant={a.status === 'reviewed' ? 'default' : 'secondary'} className="capitalize">
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedAttempt(a); setDetailOpen(true); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <PlacementAttemptDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        attempt={selectedAttempt}
        levels={levels}
        isRTL={isRTL}
        onApproveLevel={handleApproveLevel}
        approving={approving}
      />
    </DashboardLayout>
  );
}
