import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Copy } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface AgeGroup { id: string; name: string; name_ar: string; }
interface Level { id: string; name: string; name_ar: string; }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ageGroups: AgeGroup[];
  levels: Level[];
  defaultTargetAgeGroupId: string;
  defaultTargetLevelId: string;
}

export function CloneCurriculumDialog({ open, onOpenChange, ageGroups, levels, defaultTargetAgeGroupId, defaultTargetLevelId }: Props) {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [sourceAgeGroup, setSourceAgeGroup] = useState('');
  const [sourceLevel, setSourceLevel] = useState('');
  const [sourceVersion, setSourceVersion] = useState('');
  const [targetAgeGroup, setTargetAgeGroup] = useState(defaultTargetAgeGroupId);
  const [targetLevel, setTargetLevel] = useState(defaultTargetLevelId);
  const [cloning, setCloning] = useState(false);

  // Sync defaults when they change
  if (open && targetAgeGroup !== defaultTargetAgeGroupId && !targetAgeGroup) {
    setTargetAgeGroup(defaultTargetAgeGroupId);
    setTargetLevel(defaultTargetLevelId);
  }

  const { data: sourceVersions = [] } = useQuery({
    queryKey: ['clone-source-versions', sourceAgeGroup, sourceLevel],
    queryFn: async () => {
      if (!sourceAgeGroup || !sourceLevel) return [];
      const { data, error } = await supabase
        .from('curriculum_sessions')
        .select('version, is_published')
        .eq('age_group_id', sourceAgeGroup)
        .eq('level_id', sourceLevel)
        .eq('is_active', true);
      if (error) throw error;

      const map = new Map<number, boolean>();
      for (const r of data || []) {
        if (!map.has(r.version) || r.is_published) map.set(r.version, r.is_published ?? false);
      }
      return Array.from(map.entries())
        .map(([v, pub]) => ({ version: v, is_published: pub }))
        .sort((a, b) => b.version - a.version);
    },
    enabled: !!sourceAgeGroup && !!sourceLevel,
  });

  // Check if target already has curriculum
  const { data: targetHasCurriculum } = useQuery({
    queryKey: ['clone-target-check', targetAgeGroup, targetLevel],
    queryFn: async () => {
      if (!targetAgeGroup || !targetLevel) return false;
      const { count, error } = await supabase
        .from('curriculum_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('age_group_id', targetAgeGroup)
        .eq('level_id', targetLevel)
        .eq('is_active', true);
      if (error) return false;
      return (count ?? 0) > 0;
    },
    enabled: !!targetAgeGroup && !!targetLevel,
  });

  const handleClone = async () => {
    if (!sourceAgeGroup || !sourceLevel || !sourceVersion || !targetAgeGroup || !targetLevel) return;
    setCloning(true);
    try {
      const { data, error } = await supabase.rpc('clone_curriculum', {
        p_source_age_group_id: sourceAgeGroup,
        p_source_level_id: sourceLevel,
        p_source_version: parseInt(sourceVersion),
        p_target_age_group_id: targetAgeGroup,
        p_target_level_id: targetLevel,
      });
      if (error) throw error;
      const result = data as any;
      toast.success(isRTL
        ? `تم نسخ ${result.sessions_copied} سيشن (نسخة ${result.target_version})`
        : `Cloned ${result.sessions_copied} sessions (version ${result.target_version})`);
      queryClient.invalidateQueries({ queryKey: ['curriculum-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['curriculum-overview'] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    }
    setCloning(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-4 w-4" />
            {isRTL ? 'نسخ من منهج آخر' : 'Clone From Another Curriculum'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Source Section */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">{isRTL ? '📥 المصدر' : '📥 Source'}</Label>
            <div>
              <Label className="text-xs">{isRTL ? 'الفئة المصدر' : 'Source Age Group'}</Label>
              <Select value={sourceAgeGroup} onValueChange={(v) => { setSourceAgeGroup(v); setSourceLevel(''); setSourceVersion(''); }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ageGroups.map(ag => (
                    <SelectItem key={ag.id} value={ag.id}>{isRTL ? ag.name_ar : ag.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">{isRTL ? 'الليفل المصدر' : 'Source Level'}</Label>
              <Select value={sourceLevel} onValueChange={(v) => { setSourceLevel(v); setSourceVersion(''); }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {levels.map(l => (
                    <SelectItem key={l.id} value={l.id}>{isRTL ? l.name_ar : l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {sourceVersions.length > 0 && (
              <div>
                <Label className="text-xs">{isRTL ? 'النسخة' : 'Version'}</Label>
                <Select value={sourceVersion} onValueChange={setSourceVersion}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sourceVersions.map(v => (
                      <SelectItem key={v.version} value={String(v.version)}>
                        v{v.version} {v.is_published ? (isRTL ? '(منشور)' : '(Published)') : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="border-t" />

          {/* Target Section */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">{isRTL ? '📤 الهدف' : '📤 Target'}</Label>
            <div>
              <Label className="text-xs">{isRTL ? 'الفئة الهدف' : 'Target Age Group'}</Label>
              <Select value={targetAgeGroup} onValueChange={(v) => { setTargetAgeGroup(v); setTargetLevel(''); }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ageGroups.map(ag => (
                    <SelectItem key={ag.id} value={ag.id}>{isRTL ? ag.name_ar : ag.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">{isRTL ? 'الليفل الهدف' : 'Target Level'}</Label>
              <Select value={targetLevel} onValueChange={setTargetLevel}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {levels.map(l => (
                    <SelectItem key={l.id} value={l.id}>{isRTL ? l.name_ar : l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {targetHasCurriculum && (
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs">
                <span>⚠️</span>
                <span>{isRTL 
                  ? 'الهدف يحتوي على منهج بالفعل. النسخ سينشئ نسخة جديدة (version) بدون حذف الموجود.' 
                  : 'Target already has curriculum. Cloning will create a new version without deleting existing data.'}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleClone} disabled={!sourceVersion || !targetAgeGroup || !targetLevel || cloning}>
            {cloning && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
            {isRTL ? 'نسخ' : 'Clone'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
