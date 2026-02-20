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
  targetAgeGroupId: string;
  targetLevelId: string;
}

export function CloneCurriculumDialog({ open, onOpenChange, ageGroups, levels, targetAgeGroupId, targetLevelId }: Props) {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [sourceAgeGroup, setSourceAgeGroup] = useState('');
  const [sourceLevel, setSourceLevel] = useState('');
  const [sourceVersion, setSourceVersion] = useState('');
  const [cloning, setCloning] = useState(false);

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

  const handleClone = async () => {
    if (!sourceAgeGroup || !sourceLevel || !sourceVersion) return;
    setCloning(true);
    try {
      const { data, error } = await supabase.rpc('clone_curriculum', {
        p_source_age_group_id: sourceAgeGroup,
        p_source_level_id: sourceLevel,
        p_source_version: parseInt(sourceVersion),
        p_target_age_group_id: targetAgeGroupId,
        p_target_level_id: targetLevelId,
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
          <div>
            <Label>{isRTL ? 'الفئة المصدر' : 'Source Age Group'}</Label>
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
            <Label>{isRTL ? 'الليفل المصدر' : 'Source Level'}</Label>
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
              <Label>{isRTL ? 'النسخة' : 'Version'}</Label>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleClone} disabled={!sourceVersion || cloning}>
            {cloning && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
            {isRTL ? 'نسخ' : 'Clone'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
