import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, Clock, Trash2, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import type { RecipientMode, StudentFilters } from './types';

interface ScheduleSenderProps {
  selectedStudentIds: string[];
  templateName: string;
  templateData: Record<string, string>;
  customSubject: string;
  customMessage: string;
  recipientMode: RecipientMode;
  filters: StudentFilters;
  disabled?: boolean;
}

interface ScheduledRow {
  id: string;
  scheduled_at: string;
  template_name: string;
  recipient_mode: string;
  student_ids: string[];
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  result_summary: { ok?: number; fail?: number; skipped?: number } | null;
  processed_at: string | null;
  custom_subject: string | null;
  created_at: string;
}

function defaultLocalDateTime(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000); // +1h default
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleSender({
  selectedStudentIds,
  templateName,
  templateData,
  customSubject,
  customMessage,
  recipientMode,
  disabled,
}: ScheduleSenderProps) {
  const { isRTL } = useLanguage();
  const [scheduledAt, setScheduledAt] = useState(defaultLocalDateTime());
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState<ScheduledRow[]>([]);
  const [listLoading, setListLoading] = useState(true);

  const loadList = async () => {
    setListLoading(true);
    const { data, error } = await supabase
      .from('scheduled_bulk_reminders')
      .select('*')
      .order('scheduled_at', { ascending: false })
      .limit(20);
    if (!error) setList((data ?? []) as ScheduledRow[]);
    setListLoading(false);
  };

  useEffect(() => {
    void loadList();
  }, []);

  const handleSchedule = async () => {
    if (selectedStudentIds.length === 0) {
      toast({
        title: isRTL ? 'اختر طالب على الأقل' : 'Select at least one student',
        variant: 'destructive',
      });
      return;
    }
    if (!templateName) {
      toast({
        title: isRTL ? 'اختر قالب' : 'Select a template',
        variant: 'destructive',
      });
      return;
    }
    const when = new Date(scheduledAt);
    if (isNaN(when.getTime()) || when.getTime() <= Date.now() + 30 * 1000) {
      toast({
        title: isRTL ? 'الوقت لازم يكون في المستقبل' : 'Time must be in the future',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setSaving(false);
      toast({ title: isRTL ? 'غير مسجل' : 'Not signed in', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('scheduled_bulk_reminders').insert({
      scheduled_at: when.toISOString(),
      template_name: templateName,
      recipient_mode: recipientMode,
      student_ids: selectedStudentIds,
      template_data: templateData ?? {},
      custom_subject: customSubject || null,
      custom_message: customMessage || null,
      status: 'pending',
      created_by: uid,
    });

    setSaving(false);
    if (error) {
      toast({
        title: isRTL ? 'فشل الجدولة' : 'Schedule failed',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: isRTL ? 'تمت الجدولة' : 'Scheduled',
      description: isRTL
        ? `هيتبعت لـ ${selectedStudentIds.length} طالب في ${when.toLocaleString('ar-EG')}`
        : `Will send to ${selectedStudentIds.length} students at ${when.toLocaleString()}`,
    });
    void loadList();
  };

  const handleCancel = async (id: string) => {
    const { error } = await supabase
      .from('scheduled_bulk_reminders')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('status', 'pending');
    if (error) {
      toast({ title: isRTL ? 'فشل الإلغاء' : 'Cancel failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: isRTL ? 'تم الإلغاء' : 'Cancelled' });
    void loadList();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" />
          {isRTL ? 'الجدولة (اختياري)' : 'Schedule (optional)'}
        </CardTitle>
        <CardDescription>
          {isRTL
            ? 'بدل الإرسال الفوري، حدد وقت لاحق لإرسال الإيميلات تلقائياً (يتم الفحص كل 5 دقائق)'
            : 'Instead of sending now, pick a future time to dispatch automatically (checked every 5 min)'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <Label htmlFor="schedule-at" className="text-sm">
              {isRTL ? 'موعد الإرسال' : 'Send at'}
            </Label>
            <Input
              id="schedule-at"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              disabled={disabled || saving}
              className="mt-1"
            />
          </div>
          <Button
            onClick={handleSchedule}
            disabled={disabled || saving || selectedStudentIds.length === 0 || !templateName}
            className="gap-2"
            variant="secondary"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
            {isRTL
              ? `جدولة (${selectedStudentIds.length} طالب)`
              : `Schedule (${selectedStudentIds.length} students)`}
          </Button>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium">
              {isRTL ? 'الجدولات الأخيرة' : 'Recent schedules'}
            </h4>
            <Button variant="ghost" size="sm" onClick={() => void loadList()} disabled={listLoading}>
              {isRTL ? 'تحديث' : 'Refresh'}
            </Button>
          </div>
          {listLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {isRTL ? 'جارٍ التحميل...' : 'Loading...'}
            </p>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {isRTL ? 'لا توجد جدولات بعد' : 'No schedules yet'}
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'الموعد' : 'Scheduled'}</TableHead>
                    <TableHead>{isRTL ? 'القالب' : 'Template'}</TableHead>
                    <TableHead>{isRTL ? 'الطلاب' : 'Students'}</TableHead>
                    <TableHead>{isRTL ? 'الوضع' : 'Mode'}</TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead>{isRTL ? 'النتيجة' : 'Result'}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((row) => {
                    const when = new Date(row.scheduled_at);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs">
                          {isRTL ? when.toLocaleString('ar-EG') : when.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{row.template_name}</TableCell>
                        <TableCell className="text-xs">{row.student_ids?.length ?? 0}</TableCell>
                        <TableCell className="text-xs">{row.recipient_mode}</TableCell>
                        <TableCell>
                          {row.status === 'pending' && (
                            <Badge variant="secondary" className="text-xs">
                              {isRTL ? 'في الانتظار' : 'Pending'}
                            </Badge>
                          )}
                          {row.status === 'processing' && (
                            <Badge variant="default" className="text-xs gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              {isRTL ? 'قيد التنفيذ' : 'Processing'}
                            </Badge>
                          )}
                          {row.status === 'sent' && (
                            <Badge variant="default" className="text-xs">
                              {isRTL ? 'تم الإرسال' : 'Sent'}
                            </Badge>
                          )}
                          {row.status === 'failed' && (
                            <Badge variant="destructive" className="text-xs">
                              {isRTL ? 'فشل' : 'Failed'}
                            </Badge>
                          )}
                          {row.status === 'cancelled' && (
                            <Badge variant="outline" className="text-xs">
                              {isRTL ? 'ملغى' : 'Cancelled'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.result_summary
                            ? `✓${row.result_summary.ok ?? 0} ✗${row.result_summary.fail ?? 0} ⊘${row.result_summary.skipped ?? 0}`
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {row.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => void handleCancel(row.id)}
                              title={isRTL ? 'إلغاء' : 'Cancel'}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
