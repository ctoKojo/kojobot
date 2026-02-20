import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { History, GitCompare, Loader2, Lock, Unlock, Eye } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface VersionInfo {
  version: number;
  is_published: boolean;
  published_at: string | null;
  session_count: number;
}

interface Props {
  ageGroupId: string;
  levelId: string;
  currentVersion: number;
  onViewVersion: (version: number) => void;
}

export function VersionHistoryPanel({ ageGroupId, levelId, currentVersion, onViewVersion }: Props) {
  const { isRTL } = useLanguage();
  const [compareOpen, setCompareOpen] = useState(false);
  const [versionA, setVersionA] = useState<string>('');
  const [versionB, setVersionB] = useState<string>('');
  const [comparing, setComparing] = useState(false);
  const [diffResult, setDiffResult] = useState<any[] | null>(null);

  const { data: versions = [] } = useQuery({
    queryKey: ['curriculum-versions', ageGroupId, levelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('curriculum_sessions')
        .select('version, is_published, published_at')
        .eq('age_group_id', ageGroupId)
        .eq('level_id', levelId)
        .eq('is_active', true)
        .order('version', { ascending: false });
      if (error) throw error;

      const map = new Map<number, VersionInfo>();
      for (const row of data || []) {
        const existing = map.get(row.version);
        if (existing) {
          existing.session_count++;
          if (row.is_published) existing.is_published = true;
          if (row.published_at && (!existing.published_at || row.published_at > existing.published_at)) {
            existing.published_at = row.published_at;
          }
        } else {
          map.set(row.version, {
            version: row.version,
            is_published: row.is_published ?? false,
            published_at: row.published_at,
            session_count: 1,
          });
        }
      }
      return Array.from(map.values()).sort((a, b) => b.version - a.version);
    },
    enabled: !!ageGroupId && !!levelId,
  });

  const handleCompare = async () => {
    if (!versionA || !versionB) return;
    setComparing(true);
    try {
      const { data, error } = await supabase.rpc('compare_curriculum_versions', {
        p_age_group_id: ageGroupId,
        p_level_id: levelId,
        p_version_a: parseInt(versionA),
        p_version_b: parseInt(versionB),
      });
      if (error) throw error;
      setDiffResult(data as any[]);
    } catch (err: any) {
      toast.error(err.message);
    }
    setComparing(false);
  };

  if (versions.length <= 1) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4" />
            {isRTL ? 'تاريخ النسخ' : 'Version History'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {versions.map(v => (
            <div key={v.version} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">v{v.version}</span>
                {v.is_published ? (
                  <Badge variant="default" className="text-xs"><Lock className="h-3 w-3 ltr:mr-0.5 rtl:ml-0.5" />{isRTL ? 'منشور' : 'Published'}</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs"><Unlock className="h-3 w-3 ltr:mr-0.5 rtl:ml-0.5" />{isRTL ? 'مسودة' : 'Draft'}</Badge>
                )}
                <span className="text-xs text-muted-foreground">({v.session_count})</span>
              </div>
              {v.version !== currentVersion && (
                <Button variant="ghost" size="sm" onClick={() => onViewVersion(v.version)}>
                  <Eye className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                  {isRTL ? 'عرض' : 'View'}
                </Button>
              )}
            </div>
          ))}

          <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setCompareOpen(true)}>
            <GitCompare className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
            {isRTL ? 'مقارنة نسختين' : 'Compare Versions'}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isRTL ? 'مقارنة النسخ' : 'Compare Versions'}</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-3 mb-4">
            <Select value={versionA} onValueChange={setVersionA}>
              <SelectTrigger className="w-32"><SelectValue placeholder="v..." /></SelectTrigger>
              <SelectContent>
                {versions.map(v => (
                  <SelectItem key={v.version} value={String(v.version)}>v{v.version}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">→</span>
            <Select value={versionB} onValueChange={setVersionB}>
              <SelectTrigger className="w-32"><SelectValue placeholder="v..." /></SelectTrigger>
              <SelectContent>
                {versions.map(v => (
                  <SelectItem key={v.version} value={String(v.version)}>v{v.version}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleCompare} disabled={!versionA || !versionB || comparing} size="sm">
              {comparing && <Loader2 className="h-3 w-3 animate-spin ltr:mr-1 rtl:ml-1" />}
              {isRTL ? 'قارن' : 'Compare'}
            </Button>
          </div>

          {diffResult && (
            diffResult.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">{isRTL ? 'لا توجد فروقات' : 'No differences found'}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>{isRTL ? 'الحقل' : 'Field'}</TableHead>
                    <TableHead>{isRTL ? 'القديم' : 'Old'}</TableHead>
                    <TableHead>{isRTL ? 'الجديد' : 'New'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diffResult.map((diff: any) => {
                    const changes = diff.changes || {};
                    return Object.entries(changes).map(([field, change]: [string, any]) => (
                      <TableRow key={`${diff.session_number}-${field}`}>
                        <TableCell className="font-medium">{diff.session_number}</TableCell>
                        <TableCell className="text-sm">{field}</TableCell>
                        <TableCell className="text-sm text-destructive max-w-[200px] truncate">{change?.old || '—'}</TableCell>
                        <TableCell className="text-sm text-primary max-w-[200px] truncate">{change?.new || '—'}</TableCell>
                      </TableRow>
                    ));
                  })}
                </TableBody>
              </Table>
            )
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
