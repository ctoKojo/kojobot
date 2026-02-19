import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Loader2, Plus, Copy, FileUp, BookOpen, Video, Film, ClipboardList, HelpCircle,
  AlertCircle, CheckCircle2, Lock, Unlock, Eye, ExternalLink, Upload, X, FileIcon, Pencil
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
}

export default function CurriculumManagement() {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [editSession, setEditSession] = useState<CurriculumSession | null>(null);
  const [editForm, setEditForm] = useState<Partial<CurriculumSession>>({});
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Fetch age groups
  const { data: ageGroups = [] } = useQuery({
    queryKey: ['age-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('age_groups')
        .select('*')
        .eq('is_active', true)
        .order('min_age');
      if (error) throw error;
      return data;
    },
  });

  // Fetch levels
  const { data: levels = [] } = useQuery({
    queryKey: ['levels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('levels')
        .select('*')
        .eq('is_active', true)
        .order('level_order');
      if (error) throw error;
      return data;
    },
  });

  // Fetch quizzes for selection (with age_group_id and level_id for filtering)
  const { data: allQuizzes = [] } = useQuery({
    queryKey: ['quizzes-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quizzes')
        .select('id, title, title_ar, age_group_id, level_id')
        .eq('is_active', true)
        .order('title');
      if (error) throw error;
      return data;
    },
  });

  // Filter quizzes by selected age group and level
  const filteredQuizzes = allQuizzes.filter(q =>
    (!q.age_group_id || q.age_group_id === selectedAgeGroup) &&
    (!q.level_id || q.level_id === selectedLevel)
  );

  // Fetch curriculum sessions for selected age group + level (latest version)
  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ['curriculum-sessions', selectedAgeGroup, selectedLevel],
    queryFn: async () => {
      if (!selectedAgeGroup || !selectedLevel) return [];

      // Get latest version number first
      const { data: versionData } = await supabase
        .from('curriculum_sessions')
        .select('version')
        .eq('age_group_id', selectedAgeGroup)
        .eq('level_id', selectedLevel)
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1);

      const latestVersion = versionData?.[0]?.version;
      if (!latestVersion) return [];

      const { data, error } = await supabase
        .from('curriculum_sessions')
        .select('*')
        .eq('age_group_id', selectedAgeGroup)
        .eq('level_id', selectedLevel)
        .eq('version', latestVersion)
        .eq('is_active', true)
        .order('session_number');
      if (error) throw error;
      return (data || []) as CurriculumSession[];
    },
    enabled: !!selectedAgeGroup && !!selectedLevel,
  });

  const latestVersion = sessions.length > 0 ? sessions[0].version : 0;
  const isPublished = sessions.length > 0 && sessions[0].is_published;

  // Create empty curriculum (12 sessions)
  const createCurriculumMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAgeGroup || !selectedLevel) throw new Error('Select age group and level');

      const rows = Array.from({ length: 12 }, (_, i) => ({
        age_group_id: selectedAgeGroup,
        level_id: selectedLevel,
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
      toast.success(isRTL ? 'تم إنشاء المنهج بنجاح' : 'Curriculum created successfully');
    },
    onError: (err: any) => {
      toast.error(err.message || (isRTL ? 'فشل في إنشاء المنهج' : 'Failed to create curriculum'));
    },
  });

  // New version mutation
  const newVersionMutation = useMutation({
    mutationFn: async () => {
      if (!sessions.length) throw new Error('No sessions to copy');

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
      toast.success(isRTL ? 'تم إنشاء نسخة جديدة' : 'New version created');
    },
    onError: () => toast.error(isRTL ? 'فشل في إنشاء نسخة جديدة' : 'Failed to create new version'),
  });

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      const ids = sessions.map(s => s.id);
      const { error } = await supabase
        .from('curriculum_sessions')
        .update({ is_published: true, published_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['curriculum-sessions'] });
      toast.success(isRTL ? 'تم نشر المنهج' : 'Curriculum published');
    },
    onError: () => toast.error(isRTL ? 'فشل في النشر' : 'Failed to publish'),
  });

  // Update session mutation
  const updateSessionMutation = useMutation({
    mutationFn: async (data: Partial<CurriculumSession> & { id: string }) => {
      const { id, ...rest } = data;
      const { error } = await supabase
        .from('curriculum_sessions')
        .update(rest)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['curriculum-sessions'] });
      setEditSession(null);
      toast.success(isRTL ? 'تم تحديث السيشن' : 'Session updated');
    },
    onError: () => toast.error(isRTL ? 'فشل في التحديث' : 'Failed to update'),
  });

  const openEditDialog = (session: CurriculumSession) => {
    setEditSession(session);
    setEditForm({ ...session });
    setAssignmentFile(null);
  };

  const handleSaveEdit = async () => {
    if (!editSession) return;

    let attachmentUrl = editForm.assignment_attachment_url;
    let attachmentType = editForm.assignment_attachment_type;

    // Upload file if selected
    if (assignmentFile) {
      setUploadingFile(true);
      try {
        const ext = assignmentFile.name.split('.').pop();
        const fileName = `assignments/${editSession.age_group_id}/${editSession.level_id}/${editSession.session_number}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('curriculum').upload(fileName, assignmentFile);
        if (uploadError) throw uploadError;
        attachmentUrl = fileName;
        attachmentType = assignmentFile.type;
      } catch (err: any) {
        toast.error(err.message || (isRTL ? 'فشل في رفع الملف' : 'Failed to upload file'));
        setUploadingFile(false);
        return;
      }
      setUploadingFile(false);
    }

    updateSessionMutation.mutate({
      id: editSession.id,
      title: editForm.title || '',
      title_ar: editForm.title_ar || '',
      description: editForm.description,
      description_ar: editForm.description_ar,
      slides_url: editForm.slides_url,
      summary_video_url: editForm.summary_video_url,
      full_video_url: editForm.full_video_url,
      quiz_id: editForm.quiz_id,
      assignment_title: editForm.assignment_title,
      assignment_title_ar: editForm.assignment_title_ar,
      assignment_description: editForm.assignment_description,
      assignment_description_ar: editForm.assignment_description_ar,
      assignment_attachment_url: attachmentUrl,
      assignment_attachment_type: attachmentType,
      assignment_max_score: editForm.assignment_max_score,
    });
  };

  const handleRemoveAttachment = () => {
    setEditForm(f => ({ ...f, assignment_attachment_url: null, assignment_attachment_type: null }));
    setAssignmentFile(null);
  };

  const getContentIcons = (s: CurriculumSession) => {
    const items = [
      { has: !!s.slides_url, icon: BookOpen, label: isRTL ? 'سلايد' : 'Slides' },
      { has: !!s.summary_video_url, icon: Video, label: isRTL ? 'فيديو ملخص' : 'Summary Video' },
      { has: !!s.full_video_url, icon: Film, label: isRTL ? 'فيديو كامل' : 'Full Video' },
      { has: !!s.quiz_id, icon: HelpCircle, label: isRTL ? 'كويز' : 'Quiz' },
      { has: !!s.assignment_title, icon: ClipboardList, label: isRTL ? 'واجب' : 'Assignment' },
    ];
    return items;
  };

  const emptySessionsCount = sessions.filter(s =>
    !s.slides_url && !s.summary_video_url && !s.full_video_url && !s.quiz_id && !s.assignment_title
  ).length;

  return (
    <DashboardLayout title={isRTL ? 'إدارة المنهج' : 'Curriculum Management'}>
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Label>{isRTL ? 'الفئة العمرية' : 'Age Group'}</Label>
                <Select value={selectedAgeGroup} onValueChange={setSelectedAgeGroup}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={isRTL ? 'اختر الفئة العمرية' : 'Select Age Group'} />
                  </SelectTrigger>
                  <SelectContent>
                    {ageGroups.map(ag => (
                      <SelectItem key={ag.id} value={ag.id}>
                        {isRTL ? ag.name_ar : ag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label>{isRTL ? 'الليفل' : 'Level'}</Label>
                <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={isRTL ? 'اختر الليفل' : 'Select Level'} />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map(l => (
                      <SelectItem key={l.id} value={l.id}>
                        {isRTL ? l.name_ar : l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions bar */}
        {selectedAgeGroup && selectedLevel && (
          <div className="flex flex-wrap items-center gap-3">
            {sessions.length === 0 && (
              <Button
                onClick={() => createCurriculumMutation.mutate()}
                disabled={createCurriculumMutation.isPending}
              >
                {createCurriculumMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />
                ) : (
                  <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                )}
                {isRTL ? 'إنشاء منهج فارغ' : 'Create Empty Curriculum'}
              </Button>
            )}

            {sessions.length > 0 && (
              <>
                <Badge variant="outline" className="text-sm py-1 px-3">
                  {isRTL ? `النسخة ${latestVersion}` : `Version ${latestVersion}`}
                </Badge>

                {isPublished ? (
                  <Badge className="bg-primary/10 text-primary border-primary/20 py-1 px-3">
                    <Lock className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                    {isRTL ? 'منشور' : 'Published'}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="py-1 px-3">
                    <Unlock className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                    {isRTL ? 'مسودة' : 'Draft'}
                  </Badge>
                )}

                {!isPublished && (
                  <Button
                    variant="default"
                    onClick={() => publishMutation.mutate()}
                    disabled={publishMutation.isPending}
                  >
                    {publishMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />
                    ) : (
                      <Eye className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    )}
                    {isRTL ? 'نشر المنهج' : 'Publish Curriculum'}
                  </Button>
                )}

                {isPublished && (
                  <Button
                    variant="outline"
                    onClick={() => newVersionMutation.mutate()}
                    disabled={newVersionMutation.isPending}
                  >
                    {newVersionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />
                    ) : (
                      <Copy className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    )}
                    {isRTL ? 'نسخة جديدة' : 'New Version'}
                  </Button>
                )}

                {emptySessionsCount > 0 && (
                  <div className="flex items-center gap-1 text-sm text-warning">
                    <AlertCircle className="h-4 w-4" />
                    {isRTL
                      ? `${emptySessionsCount} سيشن فارغة`
                      : `${emptySessionsCount} empty session(s)`}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Sessions Table */}
        {loadingSessions && selectedAgeGroup && selectedLevel ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>{isRTL ? 'العنوان' : 'Title'}</TableHead>
                    <TableHead>{isRTL ? 'المحتوى' : 'Content'}</TableHead>
                    <TableHead className="w-24">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead className="w-24">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => {
                    const icons = getContentIcons(session);
                    const hasAnyContent = icons.some(i => i.has);
                    return (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">{session.session_number}</TableCell>
                        <TableCell>
                          <div className="font-medium">{isRTL ? session.title_ar : session.title}</div>
                          {session.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {isRTL ? session.description_ar : session.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {icons.map((item, idx) => (
                              <Tooltip key={idx}>
                                <TooltipTrigger>
                                  <item.icon
                                    className={`h-4 w-4 ${item.has ? 'text-primary' : 'text-muted-foreground/30'}`}
                                  />
                                </TooltipTrigger>
                                <TooltipContent>{item.label}</TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {hasAnyContent ? (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-warning" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(session)}
                            disabled={isPublished}
                          >
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
        ) : selectedAgeGroup && selectedLevel ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">
                {isRTL ? 'لا يوجد منهج لهذه الفئة والليفل بعد' : 'No curriculum for this age group and level yet'}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* Edit Dialog */}
        <Dialog open={!!editSession} onOpenChange={(open) => !open && setEditSession(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {isRTL
                  ? `تعديل السيشن ${editSession?.session_number}`
                  : `Edit Session ${editSession?.session_number}`}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Title EN/AR */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{isRTL ? 'العنوان (إنجليزي)' : 'Title (English)'}</Label>
                  <Input
                    value={editForm.title || ''}
                    onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>{isRTL ? 'العنوان (عربي)' : 'Title (Arabic)'}</Label>
                  <Input
                    value={editForm.title_ar || ''}
                    onChange={e => setEditForm(f => ({ ...f, title_ar: e.target.value }))}
                    className="mt-1"
                    dir="rtl"
                  />
                </div>
              </div>

              {/* Description EN/AR */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{isRTL ? 'الوصف (إنجليزي)' : 'Description (English)'}</Label>
                  <Textarea
                    value={editForm.description || ''}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    className="mt-1"
                    rows={3}
                  />
                </div>
                <div>
                  <Label>{isRTL ? 'الوصف (عربي)' : 'Description (Arabic)'}</Label>
                  <Textarea
                    value={editForm.description_ar || ''}
                    onChange={e => setEditForm(f => ({ ...f, description_ar: e.target.value }))}
                    className="mt-1"
                    rows={3}
                    dir="rtl"
                  />
                </div>
              </div>

              {/* Content Links */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  {isRTL ? 'المحتوى' : 'Content'}
                </h4>
                <div>
                  <Label className="flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4" />
                    {isRTL ? 'رابط السلايد' : 'Slides URL'}
                  </Label>
                  <Input
                    value={editForm.slides_url || ''}
                    onChange={e => setEditForm(f => ({ ...f, slides_url: e.target.value }))}
                    placeholder="https://docs.google.com/presentation/..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1.5">
                    <Video className="h-4 w-4" />
                    {isRTL ? 'رابط فيديو ملخص' : 'Summary Video URL'}
                  </Label>
                  <Input
                    value={editForm.summary_video_url || ''}
                    onChange={e => setEditForm(f => ({ ...f, summary_video_url: e.target.value }))}
                    placeholder="https://..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1.5">
                    <Film className="h-4 w-4" />
                    {isRTL ? 'رابط فيديو كامل' : 'Full Video URL'}
                  </Label>
                  <Input
                    value={editForm.full_video_url || ''}
                    onChange={e => setEditForm(f => ({ ...f, full_video_url: e.target.value }))}
                    placeholder="https://..."
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Quiz Selection */}
              <div>
                <Label className="flex items-center gap-1.5">
                  <HelpCircle className="h-4 w-4" />
                  {isRTL ? 'الكويز المحضر' : 'Pre-configured Quiz'}
                </Label>
                <div className="flex items-center gap-2 mt-1">
                  <Select
                    value={editForm.quiz_id || 'none'}
                    onValueChange={v => setEditForm(f => ({ ...f, quiz_id: v === 'none' ? null : v }))}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={isRTL ? 'اختر كويز' : 'Select Quiz'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{isRTL ? 'بدون كويز' : 'No Quiz'}</SelectItem>
                      {filteredQuizzes.map(q => (
                        <SelectItem key={q.id} value={q.id}>
                          {isRTL ? q.title_ar : q.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editForm.quiz_id && editForm.quiz_id !== 'none' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => window.open(`/quiz-editor/${editForm.quiz_id}`, '_blank')}
                      title={isRTL ? 'تعديل الأسئلة' : 'Edit Questions'}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/quizzes`, '_blank')}
                  >
                    <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                    {isRTL ? 'جديد' : 'New'}
                  </Button>
                </div>
                {filteredQuizzes.length === 0 && allQuizzes.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {isRTL ? 'لا توجد كويزات لهذه الفئة والليفل. اضغط "جديد" لإنشاء واحد.' : 'No quizzes match this age group/level. Click "New" to create one.'}
                  </p>
                )}
              </div>

              {/* Assignment Details */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  {isRTL ? 'الواجب' : 'Assignment'}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{isRTL ? 'عنوان الواجب (إنجليزي)' : 'Assignment Title (EN)'}</Label>
                    <Input
                      value={editForm.assignment_title || ''}
                      onChange={e => setEditForm(f => ({ ...f, assignment_title: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>{isRTL ? 'عنوان الواجب (عربي)' : 'Assignment Title (AR)'}</Label>
                    <Input
                      value={editForm.assignment_title_ar || ''}
                      onChange={e => setEditForm(f => ({ ...f, assignment_title_ar: e.target.value }))}
                      className="mt-1"
                      dir="rtl"
                    />
                  </div>
                </div>
                <div>
                  <Label>{isRTL ? 'وصف الواجب' : 'Assignment Description'}</Label>
                  <Textarea
                    value={editForm.assignment_description || ''}
                    onChange={e => setEditForm(f => ({ ...f, assignment_description: e.target.value }))}
                    className="mt-1"
                    rows={2}
                  />
                </div>

                {/* Assignment File Upload */}
                <div>
                  <Label className="flex items-center gap-1.5">
                    <Upload className="h-4 w-4" />
                    {isRTL ? 'ملف مرفق' : 'Attachment'}
                  </Label>
                  {editForm.assignment_attachment_url && !assignmentFile ? (
                    <div className="flex items-center gap-2 mt-1 p-2 border rounded-md bg-muted/30">
                      <FileIcon className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm truncate flex-1">
                        {editForm.assignment_attachment_url.split('/').pop()}
                      </span>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={handleRemoveAttachment}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : assignmentFile ? (
                    <div className="flex items-center gap-2 mt-1 p-2 border rounded-md bg-muted/30">
                      <FileIcon className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm truncate flex-1">{assignmentFile.name}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAssignmentFile(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="mt-1 border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                      <p className="text-sm text-muted-foreground">
                        {isRTL ? 'اضغط لاختيار ملف (PDF, صور, ZIP)' : 'Click to select file (PDF, Images, ZIP)'}
                      </p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.zip,.rar"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setAssignmentFile(file);
                      e.target.value = '';
                    }}
                  />
                </div>

                <div className="w-32">
                  <Label>{isRTL ? 'الدرجة القصوى' : 'Max Score'}</Label>
                  <Input
                    type="number"
                    value={editForm.assignment_max_score ?? 100}
                    onChange={e => setEditForm(f => ({ ...f, assignment_max_score: Number(e.target.value) }))}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditSession(null)}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={updateSessionMutation.isPending || uploadingFile}
              >
                {(updateSessionMutation.isPending || uploadingFile) && (
                  <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />
                )}
                {uploadingFile ? (isRTL ? 'جاري الرفع...' : 'Uploading...') : (isRTL ? 'حفظ' : 'Save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
