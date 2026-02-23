import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { GraduationCap, Loader2 } from 'lucide-react';
import { getStudentOutcomeLabel } from '@/lib/constants';

interface LevelHistorySectionProps {
  studentId: string;
}

export function LevelHistorySection({ studentId }: LevelHistorySectionProps) {
  const { isRTL, language } = useLanguage();
  const [grades, setGrades] = useState<any[]>([]);
  const [transitions, setTransitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [gradesRes, transitionsRes] = await Promise.all([
          supabase
            .from('level_grades')
            .select('*, levels(name, name_ar), groups(name, name_ar)')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false }),
          supabase
            .from('student_level_transitions')
            .select('*, from_level:levels!student_level_transitions_from_level_id_fkey(name, name_ar), to_level:levels!student_level_transitions_to_level_id_fkey(name, name_ar)')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false }),
        ]);
        setGrades(gradesRes.data || []);
        setTransitions(transitionsRes.data || []);
      } catch (err) {
        console.error('Error fetching level history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [studentId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (grades.length === 0 && transitions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          {isRTL ? 'سجل المستويات' : 'Level History'}
        </CardTitle>
        <CardDescription>
          {isRTL ? `${grades.length} مستوى مسجل` : `${grades.length} level(s) recorded`}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {grades.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isRTL ? 'المستوى' : 'Level'}</TableHead>
                <TableHead className="text-center">{isRTL ? 'تقييم' : 'Eval'}</TableHead>
                <TableHead className="text-center">{isRTL ? 'امتحان' : 'Exam'}</TableHead>
                <TableHead className="text-center">%</TableHead>
                <TableHead className="text-center">{isRTL ? 'النتيجة' : 'Outcome'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grades.map((g: any) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">
                    {language === 'ar' ? g.levels?.name_ar || g.levels?.name : g.levels?.name}
                  </TableCell>
                  <TableCell className="text-center text-sm">{g.evaluation_avg ?? '-'}</TableCell>
                  <TableCell className="text-center text-sm">{g.final_exam_score ?? '-'}</TableCell>
                  <TableCell className="text-center text-sm font-bold">
                    {g.percentage != null ? `${Math.round(g.percentage)}%` : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {g.outcome ? (
                      <Badge variant={g.outcome === 'passed' ? 'default' : 'destructive'} className="text-xs">
                        {getStudentOutcomeLabel(g.outcome, isRTL)}
                      </Badge>
                    ) : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
