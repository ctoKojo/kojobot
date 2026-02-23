import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Target } from 'lucide-react';
import { getStudentProgressStatusLabel, getStudentOutcomeLabel } from '@/lib/constants';

interface CurrentLevelStatusProps {
  studentId: string;
}

export function CurrentLevelStatus({ studentId }: CurrentLevelStatusProps) {
  const { isRTL, language } = useLanguage();
  const [progress, setProgress] = useState<any>(null);
  const [levelName, setLevelName] = useState('');
  const [grade, setGrade] = useState<any>(null);

  useEffect(() => {
    const fetch = async () => {
      // Get latest active group progress
      const { data: gsp } = await supabase
        .from('group_student_progress')
        .select('*, levels!group_student_progress_current_level_id_fkey(name, name_ar)')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!gsp) return;
      setProgress(gsp);
      setLevelName(language === 'ar' ? gsp.levels?.name_ar || gsp.levels?.name : gsp.levels?.name || '');

      // Get grade if exists
      const { data: lg } = await supabase
        .from('level_grades')
        .select('*')
        .eq('student_id', studentId)
        .eq('group_id', gsp.group_id)
        .eq('level_id', gsp.current_level_id)
        .maybeSingle();

      if (lg) setGrade(lg);
    };
    fetch();
  }, [studentId, language]);

  if (!progress) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" />
          {isRTL ? 'حالة المستوى الحالي' : 'Current Level Status'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 items-center">
          <Badge variant="outline">{levelName}</Badge>
          <Badge variant="secondary" className="text-xs">
            {getStudentProgressStatusLabel(progress.status, isRTL)}
          </Badge>
          {progress.outcome && (
            <Badge variant={progress.outcome === 'passed' ? 'default' : 'destructive'} className="text-xs">
              {getStudentOutcomeLabel(progress.outcome, isRTL)}
            </Badge>
          )}
          {grade && grade.percentage != null && (
            <span className="text-sm font-bold">{Math.round(grade.percentage)}%</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
