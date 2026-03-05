import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, Eye, ClipboardCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/timeUtils';

interface PlacementResult {
  id: string;
  placement_test_id: string;
  score: number;
  max_score: number;
  percentage: number;
  suggested_level_id: string | null;
  approved_level_id: string | null;
  review_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submission_answers: Record<string, number> | null;
  created_at: string;
  placement_tests: {
    id: string;
    student_id: string;
    quiz_id: string;
    age_group_id: string | null;
    attempt_number: number;
    scheduled_at: string;
    status: string;
  };
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
  const [results, setResults] = useState<PlacementResult[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [profiles, setProfiles] = useState<Record<string, StudentProfile>>({});
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState<PlacementResult | null>(null);
  const [overrideLevel, setOverrideLevel] = useState<string>('');
  const [approving, setApproving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<any>(null);
  const [previewQuestions, setPreviewQuestions] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [resultsRes, levelsRes] = await Promise.all([
        supabase.from('placement_test_results')
          .select('*, placement_tests(*)')
          .order('created_at', { ascending: false }),
        supabase.from('levels').select('id, name, name_ar, level_order').eq('is_active', true).order('level_order'),
      ]);

      const resultsData = (resultsRes.data || []) as PlacementResult[];
      setResults(resultsData);
      setLevels(levelsRes.data || []);

      // Fetch student profiles
      const studentIds = [...new Set(resultsData.map(r => r.placement_tests?.student_id).filter(Boolean))];
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

  const getLevelName = (levelId: string | null) => {
    if (!levelId) return isRTL ? 'غير محدد' : 'Not set';
    const level = levels.find(l => l.id === levelId);
    return level ? (isRTL ? level.name_ar : level.name) : levelId;
  };

  const handleApprove = async (result: PlacementResult, levelId: string) => {
    setApproving(true);
    try {
      // Update result
      const { error: resultError } = await supabase.from('placement_test_results')
        .update({
          approved_level_id: levelId,
          review_status: levelId === result.suggested_level_id ? 'approved' : 'overridden',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', result.id);

      if (resultError) throw resultError;

      // Update student profile level_id
      const { error: profileError } = await supabase.from('profiles')
        .update({ level_id: levelId })
        .eq('user_id', result.placement_tests.student_id);

      if (profileError) throw profileError;

      toast({ title: isRTL ? 'تمت الموافقة وتحديد المستوى' : 'Approved and level assigned' });
      fetchData();
    } catch (err: any) {
      toast({ title: isRTL ? 'خطأ' : 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setApproving(false);
    }
  };

  const handlePreview = async (result: PlacementResult) => {
    setPreviewAnswers(result.submission_answers);

    // Fetch questions
    const { data } = await supabase
      .from('quiz_questions')
      .select('id, question_text, question_text_ar, options, correct_answer, points, order_index')
      .eq('quiz_id', result.placement_tests.quiz_id)
      .order('order_index');

    setPreviewQuestions(data || []);
    setPreviewOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">{isRTL ? 'في انتظار المراجعة' : 'Pending Review'}</Badge>;
      case 'approved':
        return <Badge className="bg-green-600">{isRTL ? 'تمت الموافقة' : 'Approved'}</Badge>;
      case 'overridden':
        return <Badge className="bg-amber-600">{isRTL ? 'تم تعديل المستوى' : 'Overridden'}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <DashboardLayout title={isRTL ? 'مراجعة تحديد المستوى' : 'Placement Test Review'}>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  const pendingCount = results.filter(r => r.review_status === 'pending').length;

  return (
    <DashboardLayout title={isRTL ? 'مراجعة تحديد المستوى' : 'Placement Test Review'}>
      <div className="space-y-6">
        {pendingCount > 0 && (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-6 flex items-center gap-3">
              <ClipboardCheck className="h-5 w-5 text-amber-600" />
              <span className="font-medium">
                {isRTL ? `${pendingCount} امتحان في انتظار المراجعة` : `${pendingCount} test(s) pending review`}
              </span>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'نتائج امتحانات تحديد المستوى' : 'Placement Test Results'}</CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {isRTL ? 'لا توجد نتائج بعد' : 'No results yet'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                    <TableHead>{isRTL ? 'المحاولة' : 'Attempt'}</TableHead>
                    <TableHead>{isRTL ? 'الدرجة' : 'Score'}</TableHead>
                    <TableHead>{isRTL ? 'النسبة' : 'Percentage'}</TableHead>
                    <TableHead>{isRTL ? 'المستوى المقترح' : 'Suggested Level'}</TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead>{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map(r => {
                    const studentId = r.placement_tests?.student_id;
                    const profile = studentId ? profiles[studentId] : null;
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          {profile ? (isRTL ? (profile.full_name_ar || profile.full_name) : profile.full_name) : '—'}
                        </TableCell>
                        <TableCell>#{r.placement_tests?.attempt_number}</TableCell>
                        <TableCell>{r.score}/{r.max_score}</TableCell>
                        <TableCell>
                          <Badge variant={r.percentage >= 60 ? 'default' : 'destructive'}>
                            {r.percentage}%
                          </Badge>
                        </TableCell>
                        <TableCell>{getLevelName(r.suggested_level_id)}</TableCell>
                        <TableCell>{getStatusBadge(r.review_status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handlePreview(r)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {r.review_status === 'pending' && (
                              <>
                                {r.suggested_level_id && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleApprove(r, r.suggested_level_id!)}
                                    disabled={approving}
                                  >
                                    <CheckCircle className="h-4 w-4 me-1" />
                                    {isRTL ? 'موافقة' : 'Approve'}
                                  </Button>
                                )}
                                <Select onValueChange={val => handleApprove(r, val)}>
                                  <SelectTrigger className="w-32">
                                    <SelectValue placeholder={isRTL ? 'تغيير' : 'Override'} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {levels.map(l => (
                                      <SelectItem key={l.id} value={l.id}>
                                        {isRTL ? l.name_ar : l.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </>
                            )}
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

      {/* Answer Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isRTL ? 'بريفيو الإجابات' : 'Answer Preview'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {previewQuestions.map((q, i) => {
              const selectedIdx = previewAnswers?.[q.id];
              const opts = q.options as any;
              let optionsList: string[] = [];
              if (opts?.en) optionsList = isRTL && opts.ar ? opts.ar : opts.en;
              else if (opts?.options) optionsList = opts.options.map((o: any) => o.text);

              let correctIdx = parseInt(q.correct_answer);
              if (isNaN(correctIdx)) correctIdx = optionsList.findIndex(o => o === q.correct_answer);

              const isCorrect = selectedIdx >= 0 && selectedIdx === correctIdx;

              return (
                <Card key={q.id} className={isCorrect ? 'border-green-300' : 'border-red-300'}>
                  <CardContent className="pt-4">
                    <p className="font-medium mb-2">
                      {i + 1}. {isRTL ? q.question_text_ar : q.question_text}
                      <Badge variant="outline" className="ms-2">{q.points} pts</Badge>
                    </p>
                    <div className="space-y-1">
                      {optionsList.map((opt: string, idx: number) => (
                        <div key={idx} className={`p-2 rounded text-sm ${
                          idx === correctIdx ? 'bg-green-100 dark:bg-green-900/30 font-medium' :
                          idx === selectedIdx && !isCorrect ? 'bg-red-100 dark:bg-red-900/30' : ''
                        }`}>
                          {idx === selectedIdx && '→ '}{opt}
                          {idx === correctIdx && ' ✓'}
                        </div>
                      ))}
                      {selectedIdx === undefined || selectedIdx < 0 ? (
                        <p className="text-sm text-muted-foreground italic">
                          {isRTL ? 'لم يتم الإجابة' : 'Not answered'}
                        </p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
