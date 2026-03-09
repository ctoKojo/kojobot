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
  confidence_level: string | null;
  needs_manual_review: boolean;
  recommended_level_id: string | null;
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
      .from('placement_v2_attempts')
      .select('*')
      .eq('needs_manual_review', true)
      .in('status', ['submitted'])
      .order('submitted_at', { ascending: false });

    if (data) {
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
      high: 'default', medium: 'secondary', low: 'destructive',
    };
    return <Badge variant={variants[level] || 'secondary'} className="capitalize">{level}</Badge>;
  };

  const pct = (score: number | null, max: number | null) => {
    if (score == null || !max || max === 0) return '—';
    return `${score}/${max} (${Math.round((score / max) * 100)}%)`;
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
                  <TableHead>{isRTL ? 'المحاولة' : 'Attempt'}</TableHead>
                  <TableHead>{isRTL ? 'القسم A' : 'Sec A'}</TableHead>
                  <TableHead>{isRTL ? 'القسم B' : 'Sec B'}</TableHead>
                  <TableHead>{isRTL ? 'المسار المقترح' : 'Track'}</TableHead>
                  <TableHead>{isRTL ? 'الثقة' : 'Confidence'}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.student_name}</TableCell>
                    <TableCell>#{a.attempt_number}</TableCell>
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
                      <Badge variant="outline" className="capitalize">{a.recommended_track || '—'}</Badge>
                    </TableCell>
                    <TableCell>{confidenceBadge(a.confidence_level)}</TableCell>
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
                <div><span className="text-muted-foreground">{isRTL ? 'المحاولة' : 'Attempt'}:</span> #{selectedAttempt.attempt_number}</div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm">{isRTL ? 'الدرجات حسب القسم' : 'Scores by Section'}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Card className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Section A</p>
                    <p className={`font-bold ${selectedAttempt.section_a_passed ? 'text-green-600' : 'text-red-600'}`}>
                      {pct(selectedAttempt.section_a_score, selectedAttempt.section_a_max)}
                    </p>
                    <Badge variant={selectedAttempt.section_a_passed ? 'default' : 'destructive'} className="text-xs mt-1">
                      {selectedAttempt.section_a_passed ? (isRTL ? 'نجح' : 'Passed') : (isRTL ? 'رسب' : 'Failed')}
                    </Badge>
                  </Card>
                  <Card className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Section B</p>
                    <p className={`font-bold ${selectedAttempt.section_b_passed ? 'text-green-600' : 'text-red-600'}`}>
                      {pct(selectedAttempt.section_b_score, selectedAttempt.section_b_max)}
                    </p>
                    <Badge variant={selectedAttempt.section_b_passed ? 'default' : 'destructive'} className="text-xs mt-1">
                      {selectedAttempt.section_b_passed ? (isRTL ? 'نجح' : 'Passed') : (isRTL ? 'رسب' : 'Failed')}
                    </Badge>
                  </Card>
                </div>

                {/* Section C details */}
                {(selectedAttempt.section_c_software_max || selectedAttempt.section_c_hardware_max) && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Card className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">Section C — Software</p>
                      <p className="font-bold">{pct(selectedAttempt.section_c_software_score, selectedAttempt.section_c_software_max)}</p>
                    </Card>
                    <Card className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">Section C — Hardware</p>
                      <p className="font-bold">{pct(selectedAttempt.section_c_hardware_score, selectedAttempt.section_c_hardware_max)}</p>
                    </Card>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{isRTL ? 'المسار المقترح' : 'Track'}:</span>
                <Badge className="capitalize">{selectedAttempt.recommended_track || '—'}</Badge>
                {confidenceBadge(selectedAttempt.confidence_level)}
              </div>

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
