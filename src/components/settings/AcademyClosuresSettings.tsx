import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CalendarDays, Plus, Trash2, Loader2, CalendarIcon, Users, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { formatDate, getCairoToday, getCairoDateOffset } from '@/lib/timeUtils';
import { notificationService } from '@/lib/notificationService';
import { cn } from '@/lib/utils';

interface Closure {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  reason_ar: string | null;
  affects_all_groups: boolean;
  created_by: string;
  created_at: string;
  academy_closure_groups?: { group_id: string }[];
}

interface AffectedSession {
  id: string;
  session_date: string;
  session_number: number | null;
  group_id: string;
  groups: { name: string; name_ar: string; instructor_id: string | null } | null;
}

interface PreviewData {
  sessions: AffectedSession[];
  sessionCount: number;
  groupCount: number;
  instructorCount: number;
  studentCount: number;
}

interface ExecutionSummary {
  cancelledCount: number;
  replacementsCreated: number;
  replacementsFailed: number;
  notificationsSent: number;
}

export function AcademyClosuresSettings({ isRTL, language }: { isRTL: boolean; language: string }) {
  const { user } = useAuth();
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<{ id: string; name: string; name_ar: string }[]>([]);

  // Form state
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState('');
  const [reasonAr, setReasonAr] = useState('');
  const [affectsAll, setAffectsAll] = useState(true);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Execution summary
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [executionSummary, setExecutionSummary] = useState<ExecutionSummary | null>(null);

  useEffect(() => {
    fetchClosures();
    fetchGroups();
  }, []);

  const fetchClosures = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('academy_closures' as any)
      .select('*, academy_closure_groups(group_id)')
      .order('start_date', { ascending: false });
    setClosures((data as any) || []);
    setLoading(false);
  };

  const fetchGroups = async () => {
    const { data } = await supabase
      .from('groups')
      .select('id, name, name_ar')
      .eq('is_active', true)
      .order('name');
    setGroups(data || []);
  };

  const resetForm = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setReason('');
    setReasonAr('');
    setAffectsAll(true);
    setSelectedGroupIds([]);
  };

  const handlePreview = async () => {
    if (!startDate || !endDate) {
      toast.error(isRTL ? 'اختر تاريخ البداية والنهاية' : 'Select start and end dates');
      return;
    }
    if (endDate < startDate) {
      toast.error(isRTL ? 'تاريخ النهاية يجب أن يكون بعد البداية' : 'End date must be after start date');
      return;
    }

    setPreviewLoading(true);
    try {
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      let query = supabase
        .from('sessions')
        .select('id, session_date, session_number, group_id, groups(name, name_ar, instructor_id)')
        .eq('status', 'scheduled')
        .gte('session_date', startStr)
        .lte('session_date', endStr);

      if (!affectsAll && selectedGroupIds.length > 0) {
        query = query.in('group_id', selectedGroupIds);
      }

      const { data: sessions } = await query;
      const affected = (sessions || []) as unknown as AffectedSession[];

      // Count unique groups, instructors, students
      const groupIds = [...new Set(affected.map(s => s.group_id))];
      const instructorIds = [...new Set(affected.map(s => s.groups?.instructor_id).filter(Boolean))];

      let studentCount = 0;
      if (groupIds.length > 0) {
        const { count } = await supabase
          .from('group_students')
          .select('student_id', { count: 'exact', head: true })
          .in('group_id', groupIds)
          .eq('is_active', true);
        studentCount = count || 0;
      }

      setPreviewData({
        sessions: affected,
        sessionCount: affected.length,
        groupCount: groupIds.length,
        instructorCount: instructorIds.length,
        studentCount,
      });
      setPreviewOpen(true);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'خطأ في جلب البيانات' : 'Error fetching preview data');
    } finally {
      setPreviewLoading(false);
    }
  };

  const createClosureOnly = async () => {
    if (!startDate || !endDate || !user) return;
    try {
      const { data: closure, error } = await supabase
        .from('academy_closures' as any)
        .insert({
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          reason: reason || null,
          reason_ar: reasonAr || null,
          affects_all_groups: affectsAll,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      if (!affectsAll && selectedGroupIds.length > 0 && closure) {
        await supabase.from('academy_closure_groups' as any).insert(
          selectedGroupIds.map(gid => ({ closure_id: (closure as any).id, group_id: gid }))
        );
      }

      toast.success(isRTL ? 'تم تسجيل الإجازة بنجاح' : 'Closure registered successfully');
      resetForm();
      setPreviewOpen(false);
      fetchClosures();
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'فشل في تسجيل الإجازة' : 'Failed to register closure');
    }
  };

  const cancelSessionsAndCreate = async () => {
    if (!previewData || !user || !startDate || !endDate) return;
    setExecuting(true);

    const summary: ExecutionSummary = {
      cancelledCount: 0,
      replacementsCreated: 0,
      replacementsFailed: 0,
      notificationsSent: 0,
    };

    try {
      // 1. Create closure
      const { data: closure, error: closureErr } = await supabase
        .from('academy_closures' as any)
        .insert({
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          reason: reason || null,
          reason_ar: reasonAr || null,
          affects_all_groups: affectsAll,
          created_by: user.id,
        })
        .select()
        .single();

      if (closureErr) throw closureErr;
      const closureId = (closure as any).id;

      // 1b. Insert closure groups if targeted
      if (!affectsAll && selectedGroupIds.length > 0) {
        await supabase.from('academy_closure_groups' as any).insert(
          selectedGroupIds.map(gid => ({ closure_id: closureId, group_id: gid }))
        );
      }

      // 2. Cancel each affected session + create logs
      for (const session of previewData.sessions) {
        // Cancel session (trigger auto_generate_next_session fires)
        const { error: cancelErr } = await supabase
          .from('sessions')
          .update({ status: 'cancelled', cancellation_reason: 'academy_closure' } as any)
          .eq('id', session.id)
          .eq('status', 'scheduled');

        if (cancelErr) {
          console.error('Cancel error:', cancelErr);
          continue;
        }
        summary.cancelledCount++;

        // Find the replacement session generated by the trigger
        // For academy_closure, the trigger creates replacement with SAME session_number
        let replacementId: string | null = null;
        if (session.session_number !== null) {
          const { data: replacement } = await supabase
            .from('sessions')
            .select('id')
            .eq('group_id', session.group_id)
            .eq('session_number', session.session_number)
            .eq('status', 'scheduled')
            .neq('id', session.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          replacementId = replacement?.id || null;
        }

        if (replacementId) {
          summary.replacementsCreated++;
        } else {
          summary.replacementsFailed++;
        }

        // Insert cancellation log
        await supabase.from('session_cancellation_logs' as any).insert({
          session_id: session.id,
          closure_id: closureId,
          cancelled_by: user.id,
          replacement_session_id: replacementId,
        }).then(() => {});
      }

      // 3. Send notifications (idempotent)
      const groupIds = [...new Set(previewData.sessions.map(s => s.group_id))];
      const closureReason = isRTL ? (reasonAr || reason || 'إجازة الأكاديمية') : (reason || reasonAr || 'Academy Closure');
      const closureReasonAr = reasonAr || reason || 'إجازة الأكاديمية';
      const closureReasonEn = reason || reasonAr || 'Academy Closure';
      const dateRange = startDate.toISOString() === endDate.toISOString()
        ? formatDate(format(startDate, 'yyyy-MM-dd'), language)
        : `${formatDate(format(startDate, 'yyyy-MM-dd'), language)} - ${formatDate(format(endDate, 'yyyy-MM-dd'), language)}`;

      for (const groupId of groupIds) {
        // Notify students
        await notificationService.notifyGroupStudents(
          groupId,
          `Sessions cancelled: ${closureReasonEn}`,
          `تم إلغاء السيشنات: ${closureReasonAr}`,
          `Sessions on ${dateRange} have been cancelled due to "${closureReasonEn}". Replacement sessions will be scheduled automatically.`,
          `تم إلغاء السيشنات في ${dateRange} بسبب "${closureReasonAr}". سيتم جدولة سيشنات بديلة تلقائياً.`,
          'warning',
          'session'
        );
        summary.notificationsSent++;

        // Notify instructor
        const group = previewData.sessions.find(s => s.group_id === groupId);
        if (group?.groups?.instructor_id) {
          await notificationService.create({
            user_id: group.groups.instructor_id,
            title: `Sessions cancelled: ${closureReasonEn}`,
            title_ar: `تم إلغاء السيشنات: ${closureReasonAr}`,
            message: `Sessions on ${dateRange} have been cancelled due to "${closureReasonEn}". Replacements scheduled automatically.`,
            message_ar: `تم إلغاء السيشنات في ${dateRange} بسبب "${closureReasonAr}". سيتم جدولة البدائل تلقائياً.`,
            type: 'warning',
            category: 'session',
          });
          summary.notificationsSent++;
        }
      }

      // 4. Mark notification_sent on logs
      const sessionIds = previewData.sessions.map(s => s.id);
      await supabase
        .from('session_cancellation_logs' as any)
        .update({ notification_sent: true, notification_sent_at: new Date().toISOString() })
        .eq('closure_id', closureId)
        .in('session_id', sessionIds);

      setExecutionSummary(summary);
      setPreviewOpen(false);
      setSummaryOpen(true);
      resetForm();
      fetchClosures();
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'خطأ أثناء تنفيذ العملية' : 'Error during execution');
    } finally {
      setExecuting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('academy_closures' as any).delete().eq('id', id);
      if (error) throw error;
      toast.success(isRTL ? 'تم حذف الإجازة' : 'Closure deleted');
      setDeleteId(null);
      fetchClosures();
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'فشل في الحذف' : 'Failed to delete');
    }
  };

  const toggleGroup = (gid: string) => {
    setSelectedGroupIds(prev =>
      prev.includes(gid) ? prev.filter(id => id !== gid) : [...prev, gid]
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <CardTitle>{isRTL ? 'إجازات الأكاديمية' : 'Academy Closures'}</CardTitle>
          </div>
          <CardDescription>
            {isRTL ? 'إدارة أيام الإجازات والإغلاقات وتأثيرها على السيشنات' : 'Manage holidays and closures and their impact on sessions'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add Closure Form */}
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <Label className="text-base font-semibold block">{isRTL ? 'إضافة إجازة جديدة' : 'Add New Closure'}</Label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Start Date */}
              <div className="space-y-1">
                <Label className="text-sm">{isRTL ? 'تاريخ البداية' : 'Start Date'}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !startDate && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'PPP') : (isRTL ? 'اختر التاريخ' : 'Pick a date')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End Date */}
              <div className="space-y-1">
                <Label className="text-sm">{isRTL ? 'تاريخ النهاية' : 'End Date'}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !endDate && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'PPP') : (isRTL ? 'اختر التاريخ' : 'Pick a date')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="p-3 pointer-events-auto" disabled={(date) => startDate ? date < startDate : false} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input placeholder={isRTL ? 'السبب بالإنجليزية' : 'Reason (English)'} value={reason} onChange={e => setReason(e.target.value)} />
              <Input placeholder={isRTL ? 'السبب بالعربية' : 'Reason (Arabic)'} value={reasonAr} onChange={e => setReasonAr(e.target.value)} dir="rtl" />
            </div>

            {/* Scope */}
            <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
              <div>
                <Label className="text-sm">{isRTL ? 'تنطبق على كل المجموعات' : 'Applies to all groups'}</Label>
                <p className="text-xs text-muted-foreground">{isRTL ? 'أو اختر مجموعات محددة' : 'Or select specific groups'}</p>
              </div>
              <Switch checked={affectsAll} onCheckedChange={setAffectsAll} />
            </div>

            {!affectsAll && (
              <div className="space-y-2">
                <Label className="text-sm">{isRTL ? 'اختر المجموعات' : 'Select Groups'}</Label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-lg">
                  {groups.map(g => (
                    <Badge
                      key={g.id}
                      variant={selectedGroupIds.includes(g.id) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleGroup(g.id)}
                    >
                      {isRTL ? g.name_ar : g.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handlePreview} disabled={previewLoading || !startDate || !endDate} className="w-full">
              {previewLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              {isRTL ? 'معاينة وإضافة' : 'Preview & Add'}
            </Button>
          </div>

          {/* Closures List */}
          <div>
            <Label className="text-base font-semibold mb-3 block">{isRTL ? 'الإجازات المسجلة' : 'Registered Closures'}</Label>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : closures.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">{isRTL ? 'لا توجد إجازات مسجلة' : 'No closures registered'}</p>
            ) : (
              <div className="space-y-2">
                {closures.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {formatDate(c.start_date, language)}
                          {c.start_date !== c.end_date && ` → ${formatDate(c.end_date, language)}`}
                        </span>
                        <Badge variant={c.affects_all_groups ? 'default' : 'secondary'} className="text-xs">
                          {c.affects_all_groups
                            ? (isRTL ? 'عامة' : 'All Groups')
                            : (isRTL ? 'مخصصة' : 'Specific')}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {isRTL ? (c.reason_ar || c.reason || '-') : (c.reason || c.reason_ar || '-')}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)} className="text-destructive hover:bg-destructive/10 flex-shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-start">{isRTL ? 'معاينة تأثير الإجازة' : 'Closure Impact Preview'}</DialogTitle>
            <DialogDescription className="text-start">
              {previewData && previewData.sessionCount > 0
                ? (isRTL
                  ? `يوجد ${previewData.sessionCount} سيشن scheduled تخص ${previewData.groupCount} مجموعة و ${previewData.instructorCount} مدرب و ${previewData.studentCount} طالب. سيتم إلغاؤها وإنشاء سيشنات بديلة تلقائياً.`
                  : `${previewData.sessionCount} scheduled sessions affecting ${previewData.groupCount} groups, ${previewData.instructorCount} instructors, and ${previewData.studentCount} students will be cancelled with automatic replacements.`)
                : (isRTL ? 'لا توجد سيشنات متأثرة في هذه الفترة' : 'No sessions affected in this period')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 pt-2">
            <Button onClick={() => setPreviewOpen(false)} variant="ghost" className="sm:me-auto">
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={createClosureOnly} variant="outline">
              {isRTL ? 'تسجيل الإجازة فقط' : 'Register Closure Only'}
            </Button>
            {previewData && previewData.sessionCount > 0 && (
              <Button onClick={cancelSessionsAndCreate} disabled={executing} variant="destructive">
                {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                {isRTL ? 'إلغاء السيشنات وإنشاء بدائل' : 'Cancel & Replace'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'حذف الإجازة' : 'Delete Closure'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL
                ? 'حذف هذه الإجازة لن يعكس الإلغاءات السابقة أو السيشنات البديلة التي تم إنشاؤها. هل تريد المتابعة؟'
                : 'Deleting this closure will NOT reverse previous cancellations or replacement sessions. Continue?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isRTL ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Execution Summary */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              {isRTL ? 'ملخص التنفيذ' : 'Execution Summary'}
            </DialogTitle>
          </DialogHeader>
          {executionSummary && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between p-2 bg-muted/50 rounded">
                <span>{isRTL ? 'سيشنات ملغاة' : 'Sessions cancelled'}</span>
                <span className="font-bold">{executionSummary.cancelledCount}</span>
              </div>
              <div className="flex justify-between p-2 bg-muted/50 rounded">
                <span>{isRTL ? 'بدائل تم إنشاؤها' : 'Replacements created'}</span>
                <span className="font-bold">{executionSummary.replacementsCreated}</span>
              </div>
              {executionSummary.replacementsFailed > 0 && (
                <div className="flex justify-between p-2 bg-destructive/10 rounded text-destructive">
                  <span>{isRTL ? 'بدائل تعذر إنشاؤها' : 'Replacements failed'}</span>
                  <span className="font-bold">{executionSummary.replacementsFailed}</span>
                </div>
              )}
              <div className="flex justify-between p-2 bg-muted/50 rounded">
                <span>{isRTL ? 'إشعارات مرسلة' : 'Notifications sent'}</span>
                <span className="font-bold">{executionSummary.notificationsSent}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setSummaryOpen(false)}>{isRTL ? 'تم' : 'Done'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
