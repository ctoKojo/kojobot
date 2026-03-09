import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, CheckCircle, ShieldAlert } from 'lucide-react';
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
  needs_manual_review: boolean | null;
  recommended_level_id: string | null;
  submitted_at: string | null;
  student_name?: string;
}

export default function ReviewQueueTab() {
  const { isRTL } = useLanguage();
  const [attempts, setAttempts] = useState<ReviewAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchReviewQueue(); }, []);

  const fetchReviewQueue = async () => {
    setLoading(true);
    // Fetch attempts that need manual review OR have low/medium confidence and are still submitted
    const { data } = await supabase
      .from('placement_v2_attempts')
      .select('*')
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false });

    if (data) {
      // Filter: needs_manual_review OR confidence not high
      const filtered = (data as any[]).filter(
        a => a.needs_manual_review || (a.confidence_level && a.confidence_level !== 'high')
      );

      const studentIds = [...new Set(filtered.map(a => a.student_id))];
      let profileMap = new Map<string, any>();
      if (studentIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, full_name_ar')
          .in('user_id', studentIds);
        profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      }

      setAttempts(filtered.map(a => ({
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
                  <TableHead>{isRTL ? 'القسم A' : 'Sec A'}</TableHead>
                  <TableHead>{isRTL ? 'القسم B' : 'Sec B'}</TableHead>
                  <TableHead>{isRTL ? 'المسار المقترح' : 'Track'}</TableHead>
                  <TableHead>{isRTL ? 'الثقة' : 'Confidence'}</TableHead>
                  <TableHead>{isRTL ? 'السبب' : 'Reason'}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map(a => {
                  const isBalanced = a.recommended_track === 'balanced';
                  const reason = isBalanced
                    ? (isRTL ? 'نتائج متوازنة' : 'Balanced')
                    : a.confidence_level === 'low'
                    ? (isRTL ? 'ثقة منخفضة' : 'Low confidence')
                    : a.confidence_level === 'medium'
                    ? (isRTL ? 'ثقة متوسطة' : 'Medium confidence')
                    : (isRTL ? 'مراجعة يدوية' : 'Manual review');

                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.student_name}</TableCell>
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
                      <TableCell>{confidenceBadge(a.confidence_level)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {isBalanced && <ShieldAlert className="h-3 w-3 me-1" />}
                          {reason}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open('/placement-test-review', '_blank')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
