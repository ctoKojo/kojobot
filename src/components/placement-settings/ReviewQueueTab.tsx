import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, AlertTriangle, CheckCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

interface ReviewAttempt {
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
  submitted_at: string | null;
  student_name?: string;
}

export default function ReviewQueueTab() {
  const { isRTL } = useLanguage();
  const [attempts, setAttempts] = useState<ReviewAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAttempt, setSelectedAttempt] = useState<ReviewAttempt | null>(null);

  useEffect(() => { fetchReviewQueue(); }, []);

  const fetchReviewQueue = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('placement_exam_attempts' as any)
      .select('*')
      .eq('needs_manual_review', true)
      .in('status', ['submitted'])
      .order('submitted_at', { ascending: false });

    if (data) {
      // Fetch student names
      const studentIds = [...new Set((data as any[]).map(a => a.student_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, full_name_ar')
        .in('user_id', studentIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      
      setAttempts((data as any[]).map(a => ({
        ...a,
        student_name: isRTL 
          ? (profileMap.get(a.student_id)?.full_name_ar || profileMap.get(a.student_id)?.full_name || '-')
          : (profileMap.get(a.student_id)?.full_name || '-'),
      })));
    }
    setLoading(false);
  };

  const confidenceBadge = (level: string | null) => {
    if (!level) return null;
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      high: 'default', medium: 'secondary', low: 'destructive'
    };
    return <Badge variant={variants[level] || 'secondary'}>{level}</Badge>;
  };

  const pct = (score: number | null, max: number | null) => {
    if (!score || !max || max === 0) return '—';
    return `${score}/${max} (${Math.round((score/max)*100)}%)`;
  };

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      {attempts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-medium">{isRTL ? 'لا توجد محاولات تحتاج مراجعة' : 'No attempts need review'}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                  <TableHead>{isRTL ? 'الفئة' : 'Age'}</TableHead>
                  <TableHead>{isRTL ? 'المحاولة' : 'Attempt'}</TableHead>
                  <TableHead>{isRTL ? 'الدرجة' : 'Score'}</TableHead>
                  <TableHead>{isRTL ? 'المستوى المقترح' : 'Recommended'}</TableHead>
                  <TableHead>{isRTL ? 'الثقة' : 'Confidence'}</TableHead>
                  <TableHead>{isRTL ? 'نقاط ضعف' : 'Weak Skills'}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.student_name}</TableCell>
                    <TableCell><Badge variant="outline">{a.age_group}</Badge></TableCell>
                    <TableCell>#{a.attempt_number}</TableCell>
                    <TableCell>{a.percentage != null ? `${a.percentage}%` : '—'}</TableCell>
                    <TableCell>
                      <Badge className="capitalize">{a.recommended_level || '—'}</Badge>
                    </TableCell>
                    <TableCell>{confidenceBadge(a.confidence_level)}</TableCell>
                    <TableCell>
                      {Array.isArray(a.weak_skills) && a.weak_skills.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {a.weak_skills.slice(0, 3).map((ws: any, i: number) => (
                            <Badge key={i} variant="destructive" className="text-xs">
                              {ws.skill} ({ws.rate}%)
                            </Badge>
                          ))}
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setSelectedAttempt(a)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedAttempt} onOpenChange={() => setSelectedAttempt(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {isRTL ? 'تفاصيل المراجعة' : 'Review Details'}
            </DialogTitle>
          </DialogHeader>
          {selectedAttempt && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">{isRTL ? 'الطالب' : 'Student'}:</span> {selectedAttempt.student_name}</div>
                <div><span className="text-muted-foreground">{isRTL ? 'الفئة' : 'Age'}:</span> {selectedAttempt.age_group}</div>
                <div><span className="text-muted-foreground">{isRTL ? 'الدرجة' : 'Score'}:</span> {selectedAttempt.total_score}/{selectedAttempt.max_score}</div>
                <div><span className="text-muted-foreground">{isRTL ? 'النسبة' : 'Percentage'}:</span> {selectedAttempt.percentage}%</div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm">{isRTL ? 'الدرجات حسب المستوى' : 'Scores by Level'}</h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <Card className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Foundation</p>
                    <p className="font-bold">{pct(selectedAttempt.foundation_score, selectedAttempt.foundation_max)}</p>
                  </Card>
                  <Card className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Intermediate</p>
                    <p className="font-bold">{pct(selectedAttempt.intermediate_score, selectedAttempt.intermediate_max)}</p>
                  </Card>
                  <Card className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Advanced</p>
                    <p className="font-bold">{pct(selectedAttempt.advanced_score, selectedAttempt.advanced_max)}</p>
                  </Card>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{isRTL ? 'المستوى المقترح' : 'Recommended'}:</span>
                <Badge className="capitalize">{selectedAttempt.recommended_level}</Badge>
                {confidenceBadge(selectedAttempt.confidence_level)}
              </div>

              {Array.isArray(selectedAttempt.weak_skills) && selectedAttempt.weak_skills.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">{isRTL ? 'نقاط الضعف' : 'Weak Skills'}</h4>
                  <div className="space-y-1">
                    {selectedAttempt.weak_skills.map((ws: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm bg-destructive/10 rounded px-3 py-1">
                        <span className="capitalize">{ws.skill}</span>
                        <span>{ws.correct}/{ws.total} ({ws.rate}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button variant="outline" className="w-full" onClick={() => {
                window.open('/placement-test-review', '_blank');
              }}>
                {isRTL ? 'فتح صفحة المراجعة الكاملة' : 'Open Full Review Page'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
