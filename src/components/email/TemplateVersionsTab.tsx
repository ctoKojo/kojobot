import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTemplatePermissions } from '@/hooks/useTemplatePermissions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface VersionRow {
  id: string;
  version_number: number;
  name: string;
  created_at: string;
  created_by: string | null;
  change_note: string | null;
  audience: string;
  is_active: boolean;
}

interface ProfileLite {
  user_id: string;
  full_name: string | null;
}

interface Props {
  templateId: string;
  onRestored: () => void;
}

export function TemplateVersionsTab({ templateId, onRestored }: Props) {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const { permissions } = useTemplatePermissions();
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_template_versions')
        .select('id, version_number, name, created_at, created_by, change_note, audience, is_active')
        .eq('template_id', templateId)
        .order('version_number', { ascending: false });

      if (cancelled) return;
      if (error) {
        toast({ title: isRTL ? 'فشل تحميل النسخ' : 'Failed to load versions', description: error.message, variant: 'destructive' });
      } else {
        const rows = (data ?? []) as VersionRow[];
        setVersions(rows);
        const userIds = Array.from(new Set(rows.map((r) => r.created_by).filter(Boolean))) as string[];
        if (userIds.length) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', userIds);
          const map: Record<string, ProfileLite> = {};
          (profs ?? []).forEach((p: any) => { map[p.user_id] = p; });
          if (!cancelled) setProfiles(map);
        }
      }
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [templateId, isRTL, toast]);

  const handleRestore = async (versionId: string) => {
    setRestoring(versionId);
    const { error } = await supabase.rpc('restore_email_template_version', { p_version_id: versionId });
    setRestoring(null);
    setConfirmId(null);
    if (error) {
      toast({ title: isRTL ? 'فشل الاستعادة' : 'Restore failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: isRTL ? 'تم استعادة النسخة' : 'Version restored' });
    onRestored();
  };

  if (loading) {
    return <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>;
  }

  if (versions.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm py-8">
        {isRTL ? 'مفيش نسخ سابقة' : 'No previous versions'}
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[400px]">
      <div className="space-y-2">
        {versions.map((v, idx) => {
          const isHead = idx === 0;
          const author = v.created_by ? profiles[v.created_by]?.full_name : null;
          return (
            <div key={v.id} className="border rounded-md p-3 flex items-start gap-3">
              <div className="shrink-0 size-9 rounded-md bg-muted flex items-center justify-center">
                <History className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">v{v.version_number}</span>
                  {isHead && <Badge variant="default" className="text-[10px]">{isRTL ? 'الحالي' : 'Current'}</Badge>}
                  {!v.is_active && <Badge variant="outline" className="text-[10px]">{isRTL ? 'موقوف' : 'Inactive'}</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {new Date(v.created_at).toLocaleString(isRTL ? 'ar-EG' : 'en-US')}
                  {author && ` • ${author}`}
                </div>
                {v.change_note && (
                  <div className="text-xs mt-1 italic text-muted-foreground">{v.change_note}</div>
                )}
              </div>
              {!isHead && permissions.canRestoreVersion && (
                <Button variant="outline" size="sm" onClick={() => setConfirmId(v.id)} disabled={restoring === v.id}>
                  <RotateCcw className="h-3.5 w-3.5 me-1" />
                  {isRTL ? 'استعادة' : 'Restore'}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'استعادة هذه النسخة؟' : 'Restore this version?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL
                ? 'سيتم تطبيق محتوى هذه النسخة على القالب الحالي وإنشاء نسخة جديدة. لن يتم حذف أي شيء.'
                : 'This will apply the version content as the current template and create a new version. Nothing is deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmId && handleRestore(confirmId)}>
              {isRTL ? 'استعادة' : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  );
}
