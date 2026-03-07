import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, Eye, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface PlacementAttempt {
  id: string;
  student_id: string;
  age_group: string;
  attempt_number: number;
  status: string;
  total_score: number | null;
  max_score: number | null;
  percentage: number | null;
  recommended_level: string | null;
  confidence_level: string | null;
  needs_manual_review: boolean;
  weak_skills: any;
  foundation_score: number | null;
  foundation_max: number | null;
  intermediate_score: number | null;
  intermediate_max: number | null;
  advanced_score: number | null;
  advanced_max: number | null;
  created_at: string;
  submitted_at: string | null;
}

interface Level {
  id: string;
  name: string;
  name_ar: string;
  level_order: number;
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
  const [attempts, setAttempts] = useState<PlacementAttempt[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [profiles, setProfiles] = useState<Record<string, StudentProfile>>({});
  const [loading, setLoading] = useState(true);
  const [selectedAttempt, setSelectedAttempt] = useState<PlacementAttempt | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [attemptsRes, levelsRes] = await Promise.all([
        (supabase.from('placement_exam_attempts' as any)
          .select('*')
          .eq('status', 'submitted') as any)
          .order('submitted_at', { ascending: false }),
        supabase.from('levels').select('id, name, name_ar, level_order').eq('is_active', true).order('level_order'),
      ]);

      const attemptsData = (attemptsRes.data || []) as unknown as PlacementAttempt[];
      setAttempts(attemptsData);
      setLevels(levelsRes.data || []);

      const studentIds = [...new Set(attemptsData.map(a => a.student_id))];
      if (studentIds.length > 0) {
        const { data: profilesData } = await supabase
          .rpc('get_conversation_participant_profiles', { p_user_ids: studentIds });
        const map: Record<string, StudentProfile> = {};
        (profilesData || []).forEach((p: any) => { map[p.user_id] = p; });
        setProfiles(map);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApproveLevel = async (attempt: PlacementAttempt, levelId: string) => {
    setApproving(true);
    try {
      // Update profile level_id
      const { error } = await supabase.from('profiles')
        .update({ level_id: levelId })
        .eq('user_id', attempt.student_id);

      if (error) throw error;

      // Mark attempt as reviewed
      await (supabase.from('placement_exam_attempts' as any)
        .update({ status: 'reviewed' }) as any)
        .eq('id', attempt.id);

      toast({ title: isRTL ? 'تم تحديد المستوى بنجاح' : 'Level assigned successfully' });
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
    const colors: Record<string, string> = {
      high: 'bg-green-600',
      medium: 'bg-amber-600',
      low: 'bg-red-600',
    };
    return <Badge className={colors[level] || ''}>{level}</Badge>;
  };

  const needsReviewCount = attempts.filter(a => a.needs_manual_review).length;

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
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-lg">
                <ClipboardCheck className="h-5 w-5 text-white" />
              </div>
              {isRTL ? 'مراجعة امتحانات تحديد المستوى' : 'Placement Exam Review'}
            </h1>
          </div>
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
                    <TableHead>{isRTL ? 'الفئة العمرية' : 'Age Group'}</TableHead>
                    <TableHead>{isRTL ? 'المحاولة' : 'Attempt'}</TableHead>
                    <TableHead>{isRTL ? 'الدرجة' : 'Score'}</TableHead>
                    <TableHead>{isRTL ? 'المستوى المقترح' : 'Recommended'}</TableHead>
                    <TableHead>{isRTL ? 'الثقة' : 'Confidence'}</TableHead>
                    <TableHead>{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map(a => {
                    const profile = profiles[a.student_id];
                    return (
                      <TableRow key={a.id} className={a.needs_manual_review ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}>
                        <TableCell>
                          {profile ? (isRTL ? (profile.full_name_ar || profile.full_name) : profile.full_name) : '—'}
                        </TableCell>
                        <TableCell><Badge variant="outline">{a.age_group}</Badge></TableCell>
                        <TableCell>#{a.attempt_number}</TableCell>
                        <TableCell>
                          <span className="font-mono">{a.total_score}/{a.max_score}</span>
                          <span className="text-muted-foreground ms-1">({a.percentage}%)</span>
                        </TableCell>
                        <TableCell>
                          <Badge>{a.recommended_level || '—'}</Badge>
                        </TableCell>
                        <TableCell>{getConfidenceBadge(a.confidence_level)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedAttempt(a); setDetailOpen(true); }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
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

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isRTL ? 'تفاصيل الامتحان' : 'Exam Details'}</DialogTitle>
          </DialogHeader>
          {selectedAttempt && (
            <div className="space-y-4">
              {/* Level breakdown */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Foundation', score: selectedAttempt.foundation_score, max: selectedAttempt.foundation_max },
                  { label: 'Intermediate', score: selectedAttempt.intermediate_score, max: selectedAttempt.intermediate_max },
                  { label: 'Advanced', score: selectedAttempt.advanced_score, max: selectedAttempt.advanced_max },
                ].map(item => (
                  <Card key={item.label}>
                    <CardContent className="pt-4 text-center">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-lg font-bold">{item.score}/{item.max}</p>
                      <p className="text-xs">
                        {item.max ? Math.round(((item.score || 0) / item.max) * 100) : 0}%
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Weak skills */}
              {selectedAttempt.weak_skills && Array.isArray(selectedAttempt.weak_skills) && selectedAttempt.weak_skills.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">{isRTL ? 'مهارات ضعيفة' : 'Weak Skills'}</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedAttempt.weak_skills.map((ws: any, i: number) => (
                      <Badge key={i} variant="destructive">{ws.skill} ({ws.rate}%)</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended level */}
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <span className="text-sm font-medium">{isRTL ? 'المستوى المقترح' : 'Recommended Level'}</span>
                <Badge className="text-base">{selectedAttempt.recommended_level}</Badge>
              </div>

              {selectedAttempt.needs_manual_review && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-800 dark:text-amber-300">
                    {isRTL ? 'يحتاج مراجعة يدوية — الثقة منخفضة أو نتائج غير متسقة' : 'Needs manual review — low confidence or inconsistent results'}
                  </span>
                </div>
              )}

              {/* Approve with level selection */}
              <div className="space-y-2">
                <p className="text-sm font-medium">{isRTL ? 'اعتماد المستوى' : 'Assign Level'}</p>
                <div className="flex gap-2">
                  {selectedAttempt.recommended_level && (
                    <Button
                      size="sm"
                      onClick={() => {
                        // Find matching level by name pattern
                        const matchLevel = levels.find(l =>
                          l.name.toLowerCase().includes(selectedAttempt.recommended_level!.toLowerCase())
                        );
                        if (matchLevel) handleApproveLevel(selectedAttempt, matchLevel.id);
                      }}
                      disabled={approving}
                    >
                      <CheckCircle className="h-4 w-4 me-1" />
                      {isRTL ? 'موافقة على المقترح' : 'Approve Recommended'}
                    </Button>
                  )}
                  <Select onValueChange={val => handleApproveLevel(selectedAttempt, val)} disabled={approving}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder={isRTL ? 'مستوى آخر' : 'Override'} />
                    </SelectTrigger>
                    <SelectContent>
                      {levels.map(l => (
                        <SelectItem key={l.id} value={l.id}>
                          {isRTL ? l.name_ar : l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
