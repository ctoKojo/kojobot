import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, CalendarIcon, DollarSign, Clock, CheckCircle2, XCircle, Loader2, Search, Users } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { sendEmail } from '@/lib/emailService';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type ReminderType = 'payment-due' | 'session-reminder';

interface ParentInfo {
  parent_id: string;
  full_name: string;
  email: string | null;
}

interface StudentRow {
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  group_name?: string | null;
  parents: ParentInfo[];
}

interface SendResult {
  studentId: string;
  studentName: string;
  recipientType: 'parent' | 'student' | 'none';
  recipientName: string;
  email: string;
  status: 'success' | 'failed' | 'skipped';
  message?: string;
}

export default function BulkReminders() {
  const { isRTL } = useLanguage();
  const [reminderType, setReminderType] = useState<ReminderType>('payment-due');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date());

  // Payment-specific
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('ج.م');

  // Session-specific
  const [sessionTitle, setSessionTitle] = useState<string>('');
  const [sessionTime, setSessionTime] = useState<string>('');
  const [groupName, setGroupName] = useState<string>('');

  // Sending state
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<SendResult[]>([]);

  useEffect(() => {
    void loadStudents();
  }, []);

  const loadStudents = async () => {
    setLoading(true);
    try {
      // Get all students with profile + active group
      const { data: roleRows, error: roleErr } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');
      if (roleErr) throw roleErr;

      const ids = (roleRows ?? []).map((r) => r.user_id);
      if (ids.length === 0) {
        setStudents([]);
        return;
      }

      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, phone')
        .in('user_id', ids);
      if (profErr) throw profErr;

      // Pull active group names
      const { data: groupLinks } = await supabase
        .from('group_students')
        .select('student_id, groups(name, name_ar)')
        .in('student_id', ids)
        .eq('is_active', true);

      const groupMap = new Map<string, string>();
      (groupLinks ?? []).forEach((l: any) => {
        const g = l.groups;
        if (g) groupMap.set(l.student_id, isRTL ? (g.name_ar || g.name) : (g.name || g.name_ar));
      });

      // Pull linked parents for each student
      const { data: parentLinks } = await supabase
        .from('parent_students')
        .select('student_id, parent_id')
        .in('student_id', ids);

      const parentIds = Array.from(new Set((parentLinks ?? []).map((l) => l.parent_id)));
      const parentProfilesMap = new Map<string, { full_name: string; email: string | null }>();
      if (parentIds.length > 0) {
        const { data: parentProfiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', parentIds);
        (parentProfiles ?? []).forEach((p) => {
          parentProfilesMap.set(p.user_id, { full_name: p.full_name || '—', email: p.email });
        });
      }

      const parentsByStudent = new Map<string, ParentInfo[]>();
      (parentLinks ?? []).forEach((l) => {
        const info = parentProfilesMap.get(l.parent_id);
        if (!info) return;
        const list = parentsByStudent.get(l.student_id) ?? [];
        list.push({ parent_id: l.parent_id, full_name: info.full_name, email: info.email });
        parentsByStudent.set(l.student_id, list);
      });

      const rows: StudentRow[] = (profiles ?? []).map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name || '—',
        email: p.email,
        phone: p.phone,
        group_name: groupMap.get(p.user_id) ?? null,
        parents: parentsByStudent.get(p.user_id) ?? [],
      }));

      // Sort by name
      rows.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
      setStudents(rows);
    } catch (e: any) {
      toast({ title: isRTL ? 'فشل تحميل الطلاب' : 'Failed to load students', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q) ||
        (s.group_name || '').toLowerCase().includes(q) ||
        s.parents.some(
          (p) => p.full_name.toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q),
        ),
    );
  }, [students, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selectedIds.has(s.user_id));
  const someFilteredSelected = filtered.some((s) => selectedIds.has(s.user_id));

  const toggleAllFiltered = (checked: boolean) => {
    const next = new Set(selectedIds);
    filtered.forEach((s) => {
      if (checked) next.add(s.user_id);
      else next.delete(s.user_id);
    });
    setSelectedIds(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const validate = (): string | null => {
    if (selectedIds.size === 0) return isRTL ? 'اختر طالب واحد على الأقل' : 'Select at least one student';
    if (!dueDate) return isRTL ? 'اختر تاريخ الاستحقاق' : 'Pick a date';
    if (reminderType === 'payment-due') {
      if (!amount || Number(amount) <= 0) return isRTL ? 'أدخل قيمة القسط' : 'Enter a valid amount';
    } else {
      if (!sessionTitle.trim()) return isRTL ? 'أدخل عنوان الحصة' : 'Enter session title';
      if (!sessionTime.trim()) return isRTL ? 'أدخل موعد الحصة' : 'Enter session time';
    }
    return null;
  };

  const handleSend = async () => {
    const err = validate();
    if (err) {
      toast({ title: isRTL ? 'بيانات ناقصة' : 'Missing data', description: err, variant: 'destructive' });
      return;
    }

    const targets = students.filter((s) => selectedIds.has(s.user_id));

    // Build recipient list: every linked parent of every selected student
    type Recipient = { student: StudentRow; parent: ParentInfo | null };
    const recipients: Recipient[] = [];
    for (const s of targets) {
      if (s.parents.length === 0) {
        recipients.push({ student: s, parent: null });
      } else {
        for (const p of s.parents) recipients.push({ student: s, parent: p });
      }
    }

    setSending(true);
    setResults([]);
    setProgress({ done: 0, total: recipients.length });

    const dueDateStr = format(dueDate!, 'yyyy-MM-dd');
    const dueDateLabel = format(dueDate!, 'PPP', { locale: isRTL ? ar : undefined });
    const out: SendResult[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const { student: s, parent } = recipients[i];

      if (!parent) {
        out.push({
          studentId: s.user_id,
          studentName: s.full_name,
          recipientType: 'none',
          recipientName: '—',
          email: '—',
          status: 'skipped',
          message: isRTL ? 'لا يوجد ولي أمر مرتبط بالطالب' : 'No linked parent for this student',
        });
        setResults([...out]);
        setProgress({ done: i + 1, total: recipients.length });
        continue;
      }

      if (!parent.email) {
        out.push({
          studentId: s.user_id,
          studentName: s.full_name,
          recipientType: 'parent',
          recipientName: parent.full_name,
          email: '—',
          status: 'skipped',
          message: isRTL
            ? `بريد ولي الأمر "${parent.full_name}" غير مسجّل`
            : `Parent "${parent.full_name}" has no email on file`,
        });
        setResults([...out]);
        setProgress({ done: i + 1, total: recipients.length });
        continue;
      }

      const baseKey = reminderType === 'payment-due'
        ? `bulk-payment-due-parent-${parent.parent_id}-${s.user_id}-${dueDateStr}`
        : `bulk-session-reminder-parent-${parent.parent_id}-${s.user_id}-${dueDateStr}-${sessionTime}`;

      const templateData: Record<string, any> =
        reminderType === 'payment-due'
          ? {
              recipientName: parent.full_name,
              studentName: s.full_name,
              amount: Number(amount),
              currency,
              dueDate: dueDateLabel,
              recipientType: 'parent',
            }
          : {
              recipientName: parent.full_name,
              studentName: s.full_name,
              sessionTitle,
              sessionDate: dueDateLabel,
              sessionTime,
              groupName: groupName || s.group_name || '',
              recipientType: 'parent',
            };

      const r = await sendEmail({
        to: parent.email,
        templateName: reminderType,
        idempotencyKey: baseKey,
        templateData,
      });

      out.push({
        studentId: s.user_id,
        studentName: s.full_name,
        parentName: parent.full_name,
        email: parent.email,
        status: r.success ? (r.skipped ? 'skipped' : 'success') : 'failed',
        message: r.skipped || r.error,
      });
      setResults([...out]);
      setProgress({ done: i + 1, total: recipients.length });
    }

    setSending(false);
    const succeeded = out.filter((r) => r.status === 'success').length;
    const failed = out.filter((r) => r.status === 'failed').length;
    const skipped = out.filter((r) => r.status === 'skipped').length;
    toast({
      title: isRTL ? 'اكتمل الإرسال' : 'Sending complete',
      description: isRTL
        ? `نجح: ${succeeded} | فشل: ${failed} | تم تخطي: ${skipped}`
        : `Sent: ${succeeded} | Failed: ${failed} | Skipped: ${skipped}`,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title={isRTL ? 'تذكيرات جماعية' : 'Bulk Reminders'}
          subtitle={isRTL
            ? 'إرسال تذكيرات الدفع أو الحصص لأولياء أمور الطلاب المختارين دفعة واحدة'
            : 'Send payment or session reminders to the parents of selected students'}
          icon={Send}
        />

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {reminderType === 'payment-due' ? <DollarSign className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
              {isRTL ? 'إعدادات التذكير' : 'Reminder settings'}
            </CardTitle>
            <CardDescription>{isRTL ? 'حدد نوع التذكير والبيانات المشتركة لكل المستلمين' : 'Choose reminder type and shared data for all recipients'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{isRTL ? 'نوع التذكير' : 'Reminder type'}</Label>
                <Select value={reminderType} onValueChange={(v) => setReminderType(v as ReminderType)} disabled={sending}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payment-due">{isRTL ? 'تذكير بقسط مستحق' : 'Payment due'}</SelectItem>
                    <SelectItem value="session-reminder">{isRTL ? 'تذكير بحصة' : 'Session reminder'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{reminderType === 'payment-due' ? (isRTL ? 'تاريخ الاستحقاق' : 'Due date') : (isRTL ? 'تاريخ الحصة' : 'Session date')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !dueDate && 'text-muted-foreground')} disabled={sending}>
                      <CalendarIcon className="me-2 h-4 w-4" />
                      {dueDate ? format(dueDate, 'PPP', { locale: isRTL ? ar : undefined }) : (isRTL ? 'اختر تاريخ' : 'Pick a date')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className={cn('p-3 pointer-events-auto')} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {reminderType === 'payment-due' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{isRTL ? 'قيمة القسط' : 'Amount'}</Label>
                  <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={sending} placeholder="500" />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? 'العملة' : 'Currency'}</Label>
                  <Input value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={sending} />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>{isRTL ? 'عنوان الحصة' : 'Session title'}</Label>
                  <Input value={sessionTitle} onChange={(e) => setSessionTitle(e.target.value)} disabled={sending} placeholder={isRTL ? 'مثال: Python أساسيات' : 'e.g. Python basics'} />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? 'موعد الحصة' : 'Session time'}</Label>
                  <Input value={sessionTime} onChange={(e) => setSessionTime(e.target.value)} disabled={sending} placeholder={isRTL ? 'مثال: 6:00 مساءً' : 'e.g. 6:00 PM'} />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? 'اسم المجموعة (اختياري)' : 'Group name (optional)'}</Label>
                  <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} disabled={sending} placeholder={isRTL ? 'افتراضي: مجموعة الطالب' : 'Default: student group'} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Students */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  {isRTL ? 'اختيار الطلاب' : 'Select students'}
                </CardTitle>
                <CardDescription>
                  {isRTL ? `تم اختيار ${selectedIds.size} من ${students.length}` : `${selectedIds.size} of ${students.length} selected`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute top-2.5 h-4 w-4 text-muted-foreground start-2.5" />
                  <Input
                    placeholder={isRTL ? 'بحث بالاسم أو البريد...' : 'Search by name or email...'}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="ps-8 w-64"
                  />
                </div>
                <Button
                  size="lg"
                  onClick={handleSend}
                  disabled={sending || selectedIds.size === 0}
                  className="gap-2"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {sending
                    ? (isRTL ? `جارٍ الإرسال ${progress.done}/${progress.total}` : `Sending ${progress.done}/${progress.total}`)
                    : (isRTL ? `إرسال (${selectedIds.size})` : `Send (${selectedIds.size})`)}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <TableSkeleton columns={5} rows={6} />
            ) : (
              <ScrollArea className="h-[420px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allFilteredSelected ? true : someFilteredSelected ? 'indeterminate' : false}
                          onCheckedChange={(c) => toggleAllFiltered(Boolean(c))}
                          disabled={sending || filtered.length === 0}
                        />
                      </TableHead>
                      <TableHead>{isRTL ? 'اسم الطالب' : 'Student'}</TableHead>
                      <TableHead>{isRTL ? 'أولياء الأمور' : 'Parents'}</TableHead>
                      <TableHead>{isRTL ? 'المجموعة' : 'Group'}</TableHead>
                      <TableHead>{isRTL ? 'الهاتف' : 'Phone'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          {isRTL ? 'لا يوجد طلاب' : 'No students'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((s) => {
                        const parentsWithEmail = s.parents.filter((p) => p.email);
                        const noParents = s.parents.length === 0;
                        const noEmails = !noParents && parentsWithEmail.length === 0;
                        return (
                          <TableRow key={s.user_id} className={noParents || noEmails ? 'opacity-60' : ''}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(s.user_id)}
                                onCheckedChange={() => toggleOne(s.user_id)}
                                disabled={sending}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{s.full_name}</TableCell>
                            <TableCell>
                              {noParents ? (
                                <span className="text-destructive text-xs">
                                  {isRTL ? 'لا يوجد ولي أمر مرتبط' : 'No linked parent'}
                                </span>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  {s.parents.map((p) => (
                                    <div key={p.parent_id} className="text-xs">
                                      <span className="font-medium">{p.full_name}</span>
                                      {p.email ? (
                                        <span className="text-muted-foreground ms-1">— {p.email}</span>
                                      ) : (
                                        <span className="text-destructive ms-1">
                                          ({isRTL ? 'بدون بريد' : 'no email'})
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>{s.group_name || '—'}</TableCell>
                            <TableCell>{s.phone || '—'}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{isRTL ? 'نتائج الإرسال' : 'Send results'}</CardTitle>
              <CardDescription>
                {(() => {
                  const ok = results.filter((r) => r.status === 'success').length;
                  const fail = results.filter((r) => r.status === 'failed').length;
                  const skip = results.filter((r) => r.status === 'skipped').length;
                  return (
                    <span className="flex gap-3">
                      <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {ok}</Badge>
                      <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {fail}</Badge>
                      <Badge variant="secondary" className="gap-1">{isRTL ? 'تم تخطيه' : 'Skipped'}: {skip}</Badge>
                    </span>
                  );
                })()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                      <TableHead>{isRTL ? 'ولي الأمر' : 'Parent'}</TableHead>
                      <TableHead>{isRTL ? 'البريد' : 'Email'}</TableHead>
                      <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead>{isRTL ? 'ملاحظة' : 'Note'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r, idx) => (
                      <TableRow key={`${r.studentId}-${r.email}-${idx}`}>
                        <TableCell className="font-medium">{r.studentName}</TableCell>
                        <TableCell>{r.parentName}</TableCell>
                        <TableCell className="text-xs">{r.email}</TableCell>
                        <TableCell>
                          {r.status === 'success' && (
                            <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {isRTL ? 'تم' : 'Sent'}</Badge>
                          )}
                          {r.status === 'failed' && (
                            <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {isRTL ? 'فشل' : 'Failed'}</Badge>
                          )}
                          {r.status === 'skipped' && (
                            <Badge variant="secondary">{isRTL ? 'تم تخطيه' : 'Skipped'}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-md truncate">{r.message || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
