import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Loader2, Plus, Copy, BookOpen, Video, Film, ClipboardList, HelpCircle,
  AlertCircle, CheckCircle2, Lock, Unlock, Eye, ArrowLeft,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CurriculumOverviewGrid } from '@/components/curriculum/CurriculumOverviewGrid';
import { VersionHistoryPanel } from '@/components/curriculum/VersionHistoryPanel';
import { CloneCurriculumDialog } from '@/components/curriculum/CloneCurriculumDialog';
import { SessionEditDialog } from '@/components/curriculum/SessionEditDialog';

interface CurriculumSession {
  id: string;
  age_group_id: string;
  level_id: string;
  session_number: number;
  title: string;
  title_ar: string;
  description: string | null;
  description_ar: string | null;
  slides_url: string | null;
  summary_video_url: string | null;
  full_video_url: string | null;
  quiz_id: string | null;
  assignment_title: string | null;
  assignment_title_ar: string | null;
  assignment_description: string | null;
  assignment_description_ar: string | null;
  assignment_attachment_url: string | null;
  assignment_attachment_type: string | null;
  assignment_max_score: number | null;
  version: number;
  is_published: boolean;
  published_at: string | null;
  is_active: boolean;
  updated_at: string;
  student_pdf_path: string | null;
  student_pdf_filename: string | null;
  student_pdf_size: number | null;
  student_pdf_text: string | null;
  student_pdf_text_updated_at: string | null;
}

export default function CurriculumManagement() {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();

  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const [editSession, setEditSession] = useState<CurriculumSession | null>(null);
  const [cloneOpen, setCloneOpen] = useState(false);

  // Inline edit state
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');

  const { data: ageGroups = [] } = useQuery({
    queryKey: ['age-groups'],
    queryFn: async () => {
      const { data, error } = await supabase.from('age_groups').select('*').eq('is_active', true).order('min_age');
      if (error) throw error;
      return data;
    },
  });

  const { data: levels = [] } = useQuery({
    queryKey: ['levels'],
    queryFn: async () => {
      const { data, error } = await supabase.from('levels').select('*').eq('is_active', true).order('level_order');
      if (error) throw error;
      return data;
    },
  });

  // Overview data from the View
  const { data: overviewData = [] } = useQuery({
    queryKey: ['curriculum-overview'],
    queryFn: async () => {
      const { data, error } = await supabase.from('curriculum_overview_latest').select('*');
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch sessions for selected age group + level
  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ['curriculum-sessions', selectedAgeGroup, selectedLevel, viewingVersion],
    queryFn: async () => {
      if (!selectedAgeGroup || !selectedLevel) return [];

      let version = viewingVersion;
      if (!version) {
        const { data: versionData } = await supabase
          .from('curriculum_sessions')
          .select('version')
          .eq('age_group_id', selectedAgeGroup)
          .eq('level_id', selectedLevel)
          .eq('is_active', true)
          .order('version', { ascending: false })
          .limit(1);
        version = versionData?.[0]?.version;
      }
      if (!version) return [];

      const { data, error } = await supabase
        .from('curriculum_sessions')
        .select('*')
        .eq('age_group_id', selectedAgeGroup)
        .eq('level_id', selectedLevel)
        .eq('version', version)
        .eq('is_active', true)
        .order('session_number');
      if (error) throw error;
      return (data || []) as CurriculumSession[];
    },
    enabled: !!selectedAgeGroup && !!selectedLevel,
  });

  const latestVersion = sessions.length > 0 ? sessions[0].version : 0;
  const isPublished = sessions.length > 0 && sessions[0].is_published;
  const isViewingOldVersion = viewingVersion !== null;

  const selectedLevelData = levels.find(l => l.id === selectedLevel);
  const expectedCount = (selectedLevelData as any)?.expected_sessions_count ?? 12;

  // Create empty curriculum
  const createCurriculumMutation = useMutation({
    mutationFn: async ({ agId, lvId, count }: { agId: string; lvId: string; count: number }) => {
      const rows = Array.from({ length: count }, (_, i) => ({
        age_group_id: agId,
        level_id: lvId,
        session_number: i + 1,
        title: `Session ${i + 1}`,
        title_ar: `السيشن ${i + 1}`,
        version: 1,
        is_published: false,
        is_active: true,
      }));
      const { error } = await supabase.from('curriculum_sessions').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['curriculum-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['curriculum-overview'] });
      toast.success(isRTL ? 'تم إنشاء المنهج بنجاح' : 'Curriculum created successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // New version mutation
  const newVersionMutation = useMutation({
    mutationFn: async () => {
      if (!sessions.length) throw new Error('No sessions');
      const newVersion = latestVersion + 1;
      const rows = sessions.map(s => ({
        age_group_id: s.age_group_id,
        level_id: s.level_id,
        session_number: s.session_number,
        title: s.title,
        title_ar: s.title_ar,
        description: s.description,
        description_ar: s.description_ar,
        slides_url: s.slides_url,
        summary_video_url: s.summary_video_url,
        full_video_url: s.full_video_url,
        quiz_id: s.quiz_id,
        assignment_title: s.assignment_title,
        assignment_title_ar: s.assignment_title_ar,
        assignment_description: s.assignment_description,
        assignment_description_ar: s.assignment_description_ar,
        assignment_attachment_url: s.assignment_attachment_url,
        assignment_attachment_type: s.assignment_attachment_type,
        assignment_max_score: s.assignment_max_score,
        version: newVersion,
        is_published: false,
        is_active: true,
      }));
      const { error } = await supabase.from('curriculum_sessions').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['curriculum-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['curriculum-overview'] });
      toast.success(isRTL ? 'تم إنشاء نسخة جديدة' : 'New version created');
    },
    onError: () => toast.error(isRTL ? 'فشل في إنشاء نسخة جديدة' : 'Failed to create new version'),
  });

  // Publish via RPC
  const publishMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('publish_curriculum', {
        p_age_group_id: selectedAgeGroup,
        p_level_id: selectedLevel,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.published === false) {
        throw new Error(result.reason === 'already_published'
          ? (isRTL ? 'المنهج منشور بالفعل' : 'Already published')
          : result.reason);
      }
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['curriculum-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['curriculum-overview'] });
      toast.success(isRTL ? `تم نشر النسخة ${result.version}` : `Published version ${result.version}`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Inline title save
  const saveInlineEdit = async (id: string, value: string) => {
    const session = sessions.find(s => s.id === id);
    if (!session) return;
    const field = isRTL ? 'title_ar' : 'title';
    try {
      const { data, error } = await supabase.rpc('update_curriculum_session', {
        p_id: id,
        p_expected_updated_at: session.updated_at,
        p_data: { [field]: value, [field === 'title' ? 'title_ar' : 'title']: field === 'title' ? session.title_ar : session.title },
      });
      if (error) throw error;
      const result = data as any;
      if (result?.updated === false) {
        toast.error(isRTL ? 'تم تعديل السيشن من مستخدم آخر' : 'Modified by another user');
      } else {
        queryClient.invalidateQueries({ queryKey: ['curriculum-sessions'] });
      }
    } catch (err: any) {
      toast.error(err.message);
    }
    setInlineEditId(null);
  };

  const getContentIcons = (s: CurriculumSession) => [
    { has: !!s.slides_url, icon: BookOpen, label: isRTL ? 'سلايد' : 'Slides' },
    { has: !!s.summary_video_url, icon: Video, label: isRTL ? 'فيديو ملخص' : 'Summary Video' },
    { has: !!s.full_video_url, icon: Film, label: isRTL ? 'فيديو كامل' : 'Full Video' },
    { has: !!s.quiz_id, icon: HelpCircle, label: isRTL ? 'كويز' : 'Quiz' },
    { has: !!s.assignment_title, icon: ClipboardList, label: isRTL ? 'واجب' : 'Assignment' },
  ];

  const getSessionCompletion = (s: CurriculumSession) => {
    const fields = [s.slides_url, s.summary_video_url, s.full_video_url, s.quiz_id, s.assignment_title];
    return Math.round(fields.filter(Boolean).length / fields.length * 100);
  };

  const handleSelect = (agId: string, lvId: string) => {
    setSelectedAgeGroup(agId);
    setSelectedLevel(lvId);
    setViewingVersion(null);
  };

  const handleBack = () => {
    setSelectedAgeGroup('');
    setSelectedLevel('');
    setViewingVersion(null);
  };

  const selectedAgeGroupData = ageGroups.find(ag => ag.id === selectedAgeGroup);

  // ==================== RENDER ====================

  // If no selection: show overview grid
  if (!selectedAgeGroup || !selectedLevel) {
    return (
      <DashboardLayout title={isRTL ? 'إدارة المنهج' : 'Curriculum Management'}>
        <div className="space-y-6">
          <CurriculumOverviewGrid
            ageGroups={ageGroups}
            levels={levels}
            overviewData={overviewData}
            onSelect={handleSelect}
            onCreateEmpty={(agId, lvId, count) => {
              setSelectedAgeGroup(agId);
              setSelectedLevel(lvId);
              createCurriculumMutation.mutate({ agId, lvId, count });
            }}
          />
        </div>
      </DashboardLayout>
    );
  }

  // Detail view
  return (
    <DashboardLayout title={isRTL ? 'إدارة المنهج' : 'Curriculum Management'}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1 rtl:rotate-180" />
            {isRTL ? 'رجوع' : 'Back'}
          </Button>
          <span className="font-semibold">
            {isRTL ? selectedAgeGroupData?.name_ar : selectedAgeGroupData?.name} — {isRTL ? selectedLevelData?.name_ar : selectedLevelData?.name}
          </span>

          {sessions.length > 0 && (
            <>
              <Badge variant="outline" className="text-sm py-1 px-3">
                {isRTL ? `النسخة ${latestVersion}` : `Version ${latestVersion}`}
                {isViewingOldVersion && <span className="text-muted-foreground ms-1">({isRTL ? 'قراءة فقط' : 'read-only'})</span>}
              </Badge>

              {isPublished ? (
                <Badge className="bg-primary/10 text-primary border-primary/20 py-1 px-3">
                  <Lock className="h-3 w-3 ltr:mr-1 rtl:ml-1" />{isRTL ? 'منشور' : 'Published'}
                </Badge>
              ) : (
                <Badge variant="secondary" className="py-1 px-3">
                  <Unlock className="h-3 w-3 ltr:mr-1 rtl:ml-1" />{isRTL ? 'مسودة' : 'Draft'}
                </Badge>
              )}

              {!isPublished && !isViewingOldVersion && (
                <Button variant="default" onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending} size="sm">
                  {publishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" /> : <Eye className="h-4 w-4 ltr:mr-2 rtl:ml-2" />}
                  {isRTL ? 'نشر' : 'Publish'}
                </Button>
              )}

              {isPublished && !isViewingOldVersion && (
                <Button variant="outline" onClick={() => newVersionMutation.mutate()} disabled={newVersionMutation.isPending} size="sm">
                  {newVersionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" /> : <Copy className="h-4 w-4 ltr:mr-2 rtl:ml-2" />}
                  {isRTL ? 'نسخة جديدة' : 'New Version'}
                </Button>
              )}

              {isViewingOldVersion && (
                <Button variant="outline" size="sm" onClick={() => setViewingVersion(null)}>
                  {isRTL ? 'العودة للنسخة الحالية' : 'Back to Latest'}
                </Button>
              )}
            </>
          )}

          {sessions.length > 0 && !isViewingOldVersion && (
            <Button variant="outline" size="sm" onClick={() => setCloneOpen(true)}>
              <Copy className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{isRTL ? 'نسخ من آخر' : 'Clone From...'}
            </Button>
          )}

          {sessions.length === 0 && (
            <div className="flex gap-2">
              <Button onClick={() => createCurriculumMutation.mutate({ agId: selectedAgeGroup, lvId: selectedLevel, count: expectedCount })} disabled={createCurriculumMutation.isPending} size="sm">
                {createCurriculumMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" /> : <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />}
                {isRTL ? 'إنشاء منهج فارغ' : 'Create Empty'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCloneOpen(true)}>
                <Copy className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{isRTL ? 'نسخ من آخر' : 'Clone From...'}
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main content */}
          <div className="lg:col-span-3">
            {loadingSessions ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : sessions.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>{isRTL ? 'العنوان' : 'Title'}</TableHead>
                        <TableHead className="w-40">{isRTL ? 'الاكتمال' : 'Completion'}</TableHead>
                        <TableHead>{isRTL ? 'المحتوى' : 'Content'}</TableHead>
                        <TableHead className="w-20">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map(session => {
                        const icons = getContentIcons(session);
                        const completion = getSessionCompletion(session);
                        return (
                          <TableRow key={session.id}>
                            <TableCell className="font-medium">{session.session_number}</TableCell>
                            <TableCell>
                              {inlineEditId === session.id ? (
                                <input
                                  className="w-full bg-transparent border-b border-primary outline-none text-sm py-0.5"
                                  value={inlineEditValue}
                                  autoFocus
                                  onChange={e => setInlineEditValue(e.target.value)}
                                  onBlur={() => saveInlineEdit(session.id, inlineEditValue)}
                                  onKeyDown={e => e.key === 'Enter' && saveInlineEdit(session.id, inlineEditValue)}
                                />
                              ) : (
                                <div
                                  className="cursor-pointer hover:text-primary transition-colors"
                                  onClick={() => {
                                    setInlineEditId(session.id);
                                    setInlineEditValue(isRTL ? session.title_ar : session.title);
                                  }}
                                >
                                  <div className="font-medium text-sm">{isRTL ? session.title_ar : session.title}</div>
                                  {session.description && (
                                    <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{isRTL ? session.description_ar : session.description}</div>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger className="w-full">
                                  <Progress value={completion} className="h-2" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs space-y-0.5">
                                    {icons.map((item, idx) => (
                                      <div key={idx} className="flex items-center gap-1">
                                        {item.has ? <CheckCircle2 className="h-3 w-3 text-primary" /> : <AlertCircle className="h-3 w-3 text-muted-foreground" />}
                                        {item.label}
                                      </div>
                                    ))}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {icons.map((item, idx) => (
                                  <Tooltip key={idx}>
                                    <TooltipTrigger><item.icon className={`h-4 w-4 ${item.has ? 'text-primary' : 'text-muted-foreground/30'}`} /></TooltipTrigger>
                                    <TooltipContent>{item.label}</TooltipContent>
                                  </Tooltip>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => setEditSession(session)}>
                                {isRTL ? 'تعديل' : 'Edit'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">{isRTL ? 'لا يوجد منهج بعد' : 'No curriculum yet'}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            <VersionHistoryPanel
              ageGroupId={selectedAgeGroup}
              levelId={selectedLevel}
              currentVersion={latestVersion}
              onViewVersion={setViewingVersion}
            />
          </div>
        </div>

        {/* Clone Dialog */}
        <CloneCurriculumDialog
          open={cloneOpen}
          onOpenChange={setCloneOpen}
          ageGroups={ageGroups}
          levels={levels}
          defaultTargetAgeGroupId={selectedAgeGroup}
          defaultTargetLevelId={selectedLevel}
        />

        {/* Edit Dialog */}
        <SessionEditDialog
          session={editSession}
          onClose={() => setEditSession(null)}
        />
      </div>
    </DashboardLayout>
  );
}
