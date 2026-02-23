import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { GraduationCap, ArrowUpCircle, PartyPopper } from 'lucide-react';

interface LevelPassedBannerProps {
  studentId: string;
  onUpgraded?: () => void;
}

interface TrackOption {
  id: string;
  name: string;
  name_ar: string;
}

export function LevelPassedBanner({ studentId, onUpgraded }: LevelPassedBannerProps) {
  const { isRTL, language } = useLanguage();
  const { toast } = useToast();
  const [progress, setProgress] = useState<any>(null);
  const [levelName, setLevelName] = useState('');
  const [percentage, setPercentage] = useState<number | null>(null);
  const [tracks, setTracks] = useState<TrackOption[]>([]);
  const [chosenTrackId, setChosenTrackId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [hasBranching, setHasBranching] = useState(false);

  useEffect(() => {
    fetchProgress();
  }, [studentId]);

  const fetchProgress = async () => {
    // Get latest progress where student passed
    const { data: gsp } = await supabase
      .from('group_student_progress')
      .select('*, levels!group_student_progress_current_level_id_fkey(name, name_ar)')
      .eq('student_id', studentId)
      .eq('outcome', 'passed')
      .eq('status', 'graded')
      .order('graded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!gsp) return;
    setProgress(gsp);
    setLevelName(language === 'ar' ? gsp.levels?.name_ar || gsp.levels?.name : gsp.levels?.name || '');

    // Get grade percentage
    const { data: grade } = await supabase
      .from('level_grades')
      .select('percentage')
      .eq('student_id', studentId)
      .eq('group_id', gsp.group_id)
      .eq('level_id', gsp.current_level_id)
      .maybeSingle();

    if (grade?.percentage != null) setPercentage(Math.round(grade.percentage));

    // Check if next level has branching (children with tracks)
    const { data: children } = await supabase
      .from('levels')
      .select('id, track_id')
      .eq('parent_level_id', gsp.current_level_id)
      .eq('is_active', true)
      .not('track_id', 'is', null);

    if (children && children.length > 0) {
      setHasBranching(true);
      // Fetch track details
      const trackIds = children.map(c => c.track_id!);
      const { data: trackData } = await supabase
        .from('tracks')
        .select('id, name, name_ar')
        .in('id', trackIds)
        .eq('is_active', true);
      setTracks(trackData || []);
    }
  };

  const handleUpgrade = async () => {
    if (!progress) return;
    if (hasBranching && !chosenTrackId) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'اختر المسار أولاً' : 'Please choose a track first',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('student_choose_track_and_upgrade', {
        p_group_id: progress.group_id,
        p_chosen_track_id: hasBranching ? chosenTrackId : null,
      });
      if (error) throw error;
      const result = data as any;
      if (!result.upgraded) {
        toast({
          variant: 'destructive',
          title: isRTL ? 'خطأ' : 'Error',
          description: result.reason === 'no_next_level'
            ? (isRTL ? 'لا يوجد مستوى تالي' : 'No next level available')
            : result.reason,
        });
      } else {
        toast({
          title: isRTL ? '🎉 مبروك!' : '🎉 Congratulations!',
          description: isRTL ? 'تم ترقيتك للمستوى التالي بنجاح' : 'You have been promoted to the next level!',
        });
        setProgress(null); // Hide banner
        onUpgraded?.();
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!progress) return null;

  return (
    <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
      <CardContent className="py-6">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <PartyPopper className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary">
              {isRTL ? '🎉 مبروك! نجحت في المستوى!' : '🎉 Congratulations! You passed the level!'}
            </h2>
            <p className="text-muted-foreground mt-1">
              {levelName} {percentage != null && `• ${percentage}%`}
            </p>
          </div>

          {hasBranching && tracks.length > 0 ? (
            <div className="w-full max-w-sm space-y-3">
              <p className="text-sm font-medium">
                {isRTL ? 'اختر المسار التخصصي للمستوى القادم:' : 'Choose your specialization track for the next level:'}
              </p>
              <div className="grid gap-2">
                {tracks.map(track => (
                  <Button
                    key={track.id}
                    variant={chosenTrackId === track.id ? 'default' : 'outline'}
                    className="w-full justify-start gap-2"
                    onClick={() => setChosenTrackId(track.id)}
                  >
                    <GraduationCap className="h-4 w-4" />
                    {language === 'ar' ? track.name_ar : track.name}
                  </Button>
                ))}
              </div>
              <Button
                onClick={handleUpgrade}
                disabled={loading || !chosenTrackId}
                className="w-full"
              >
                <ArrowUpCircle className="h-4 w-4 mr-2" />
                {loading
                  ? (isRTL ? 'جاري الترقية...' : 'Upgrading...')
                  : (isRTL ? 'انتقل للمستوى التالي' : 'Proceed to Next Level')}
              </Button>
            </div>
          ) : (
            <Button onClick={handleUpgrade} disabled={loading}>
              <ArrowUpCircle className="h-4 w-4 mr-2" />
              {loading
                ? (isRTL ? 'جاري الترقية...' : 'Upgrading...')
                : (isRTL ? 'انتقل للمستوى التالي' : 'Proceed to Next Level')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
