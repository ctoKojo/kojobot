import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { GraduationCap, ArrowUpCircle, PartyPopper } from 'lucide-react';
import type { BranchOption, GradeInfo } from '@/hooks/useStudentLifecycle';

interface LevelPassedBannerProps {
  groupId: string;
  levelName: string;
  percentage: number | null;
  branches: BranchOption[] | null;
  onUpgraded?: () => void;
}

export function LevelPassedBanner({ groupId, levelName, percentage, branches, onUpgraded }: LevelPassedBannerProps) {
  const { isRTL, language } = useLanguage();
  const { toast } = useToast();
  const [chosenBranchId, setChosenBranchId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const hasBranching = branches && branches.length > 0;

  const handleUpgrade = async () => {
    if (hasBranching && !chosenBranchId) {
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
        p_group_id: groupId,
        p_chosen_track_id: hasBranching ? chosenBranchId : null,
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
          description: isRTL ? 'تم ترقيتك — الإدارة هتعينك في جروب قريباً' : 'You have been promoted! Admin will assign you to a group soon.',
        });
        onUpgraded?.();
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: err.message });
    } finally {
      setLoading(false);
    }
  };

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

          {hasBranching ? (
            <div className="w-full max-w-sm space-y-3">
              <p className="text-sm font-medium">
                {isRTL ? 'اختر المسار التخصصي للمستوى القادم:' : 'Choose your specialization track for the next level:'}
              </p>
              <div className="grid gap-2">
                {branches!.map(branch => (
                  <Button
                    key={branch.id}
                    variant={chosenBranchId === branch.id ? 'default' : 'outline'}
                    className="w-full justify-start gap-2"
                    onClick={() => setChosenBranchId(branch.id)}
                  >
                    <GraduationCap className="h-4 w-4" />
                    {language === 'ar' ? branch.name_ar : branch.name}
                  </Button>
                ))}
              </div>
              <Button
                onClick={handleUpgrade}
                disabled={loading || !chosenBranchId}
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
