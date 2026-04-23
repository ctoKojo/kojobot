import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Search, Phone, Mail, CheckCircle, XCircle, Clock, ShieldCheck, UserPlus, Trash2, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { notifyEvent } from '@/lib/notifyEvent';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ParentInfo {
  parent_id: string;
  full_name: string;
  full_name_ar: string | null;
  email: string;
  phone: string | null;
  is_approved: boolean;
  children: { student_id: string; student_name: string; student_name_ar: string | null; relationship: string }[];
}

export default function Parents() {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [allParents, setAllParents] = useState<ParentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('pending');

  const fetchParents = async () => {
    setLoading(true);

    // 1. Get all parent role users
    const { data: parentRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'parent');

    if (!parentRoles?.length) {
      setAllParents([]);
      setLoading(false);
      return;
    }

    const allParentIds = parentRoles.map(r => r.user_id);

    // 2. Get links & profiles in parallel
    const [{ data: links }, { data: parentProfiles }] = await Promise.all([
      supabase.from('parent_students').select('parent_id, student_id, relationship'),
      supabase.from('profiles').select('user_id, full_name, full_name_ar, email, phone, is_approved').in('user_id', allParentIds),
    ]);

    // 3. Get student profiles for linked children
    const studentIds = [...new Set((links || []).map(l => l.student_id))];
    const { data: studentProfiles } = studentIds.length > 0
      ? await supabase.from('profiles').select('user_id, full_name, full_name_ar').in('user_id', studentIds)
      : { data: [] as any[] };

    // 4. For parents without profiles, fetch from edge function or use ID as fallback
    // We'll try to get names from auth metadata via a lightweight approach
    const profileMap = new Map((parentProfiles || []).map(p => [p.user_id, p]));

    const grouped: Record<string, ParentInfo> = {};

    for (const pid of allParentIds) {
      const profile = profileMap.get(pid);
      grouped[pid] = {
        parent_id: pid,
        full_name: profile?.full_name || '',
        full_name_ar: profile?.full_name_ar || null,
        email: profile?.email || '',
        phone: profile?.phone || null,
        is_approved: profile?.is_approved ?? false,
        children: [],
      };
    }

    // Add children
    for (const link of (links || [])) {
      const student = (studentProfiles || []).find(p => p.user_id === link.student_id);
      grouped[link.parent_id]?.children.push({
        student_id: link.student_id,
        student_name: student?.full_name || '',
        student_name_ar: student?.full_name_ar || null,
        relationship: link.relationship,
      });
    }

    // For parents missing profile data, fetch from auth metadata
    const missingProfileIds = allParentIds.filter(id => !profileMap.has(id));
    if (missingProfileIds.length > 0) {
      const { data: authInfo } = await supabase.rpc('get_parent_auth_info', { parent_ids: missingProfileIds }) as any;
      if (authInfo && Array.isArray(authInfo)) {
        for (const info of authInfo) {
          if (grouped[info.user_id]) {
            grouped[info.user_id].full_name = info.full_name || '';
            grouped[info.user_id].email = info.email || '';
          }
        }
      }
    }

    setAllParents(Object.values(grouped));
    setLoading(false);
  };

  useEffect(() => {
    fetchParents();

    // Auto-refresh when a new parent role is added or a profile approval flag changes
    const channel = supabase
      .channel('parents-page-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles', filter: 'role=eq.parent' }, () => {
        fetchParents();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload: any) => {
        // Only refetch if the changed profile belongs to a parent we already track
        const changedId = payload?.new?.user_id || payload?.old?.user_id;
        if (changedId && allParents.some(p => p.parent_id === changedId)) {
          fetchParents();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApprove = async (parentId: string) => {
    // Check if profile exists, if not create one
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', parentId)
      .maybeSingle();

    if (!existingProfile) {
      // Create profile with is_approved = true
      await supabase.from('profiles').insert({
        user_id: parentId,
        full_name: allParents.find(p => p.parent_id === parentId)?.full_name || 'Parent',
        email: allParents.find(p => p.parent_id === parentId)?.email || '',
        is_approved: true,
      });
    } else {
      await supabase.from('profiles').update({ is_approved: true }).eq('user_id', parentId);
    }

    // In-app notification (instant feedback inside the app)
    if (user) {
      await supabase.from('notifications').insert({
        user_id: parentId,
        title: 'Account Approved',
        title_ar: 'تم تفعيل حسابك',
        message: 'Your parent account has been approved. You can now access the platform.',
        message_ar: 'تم تفعيل حساب ولي الأمر الخاص بك. يمكنك الآن الوصول إلى المنصة.',
        type: 'system',
      });
    }

    // Email + Telegram via unified dispatcher
    const parent = allParents.find(p => p.parent_id === parentId);
    const parentName = parent?.full_name || parent?.full_name_ar || 'Parent';
    notifyEvent({
      eventKey: 'parent-account-approved',
      audience: 'parent',
      userId: parentId,
      templateData: {
        parentName,
        academyName: 'Kojobot Academy',
        loginUrl: `${window.location.origin}/auth`,
      },
      idempotencyKey: `parent-approved-${parentId}`,
    }).catch(err => console.error('parent-account-approved dispatch failed:', err));

    // Notify admins on Telegram
    const { notifyAdmins } = await import('@/lib/notifyAdmins');
    notifyAdmins({
      eventKey: 'admin-parent-approved',
      templateData: { parentName, approvedBy: user?.email || '—' },
      idempotencyKey: `parent-approved-admin-${parentId}`,
    }).catch(() => {});

    toast({ title: isRTL ? 'تمت الموافقة' : 'Approved', description: isRTL ? 'تم تفعيل حساب ولي الأمر' : 'Parent account has been activated' });
    setAllParents(prev => prev.map(p => p.parent_id === parentId ? { ...p, is_approved: true } : p));
  };

  const handleReject = async (parentId: string) => {
    await supabase.from('parent_students').delete().eq('parent_id', parentId);
    await supabase.from('user_roles').delete().eq('user_id', parentId).eq('role', 'parent');

    toast({ title: isRTL ? 'تم الرفض' : 'Rejected', description: isRTL ? 'تم رفض وحذف حساب ولي الأمر' : 'Parent account has been rejected and removed' });
    setAllParents(prev => prev.filter(p => p.parent_id !== parentId));
  };

  const handleDelete = async (parentId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-parent', {
        body: { parent_id: parentId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast({
        title: isRTL ? 'تم الحذف' : 'Deleted',
        description: isRTL ? 'تم حذف حساب ولي الأمر بالكامل' : 'Parent account fully deleted',
      });
      setAllParents(prev => prev.filter(p => p.parent_id !== parentId));
    } catch (err: any) {
      console.error('delete-parent failed:', err);
      toast({
        title: isRTL ? 'فشل الحذف' : 'Delete failed',
        description: err?.message || (isRTL ? 'حدث خطأ غير متوقع' : 'Unexpected error'),
        variant: 'destructive',
      });
    }
  };

  const getRelLabel = (rel: string) => {
    if (isRTL) {
      switch (rel) { case 'father': return 'أب'; case 'mother': return 'أم'; case 'guardian': return 'وصي'; default: return 'ولي أمر'; }
    }
    switch (rel) { case 'father': return 'Father'; case 'mother': return 'Mother'; case 'guardian': return 'Guardian'; default: return 'Parent'; }
  };

  const pendingParents = allParents.filter(p => !p.is_approved);
  const approvedParents = allParents.filter(p => p.is_approved);

  const filterList = (list: ParentInfo[]) => {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(p =>
      p.full_name.toLowerCase().includes(q) ||
      (p.full_name_ar?.toLowerCase().includes(q)) ||
      p.email.toLowerCase().includes(q) ||
      (p.phone?.includes(q)) ||
      p.children.some(c => c.student_name.toLowerCase().includes(q) || c.student_name_ar?.toLowerCase().includes(q))
    );
  };

  const renderParentTable = (list: ParentInfo[], showActions: boolean) => {
    if (list.length === 0) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {search
                ? (isRTL ? 'لا توجد نتائج' : 'No results found')
                : showActions
                  ? (isRTL ? 'لا توجد طلبات موافقة معلقة' : 'No pending approval requests')
                  : (isRTL ? 'لا يوجد أولياء أمور مرتبطون بعد' : 'No linked parents yet')}
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="rounded-md border" dir={isRTL ? 'rtl' : 'ltr'}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
              <TableHead>{isRTL ? 'التواصل' : 'Contact'}</TableHead>
              {!showActions && <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>}
              <TableHead>{isRTL ? 'الأبناء المرتبطون' : 'Linked Children'}</TableHead>
              <TableHead className="text-center">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map(parent => (
              <TableRow key={parent.parent_id}>
                <TableCell className="font-medium">
                  {isRTL ? parent.full_name_ar || parent.full_name : parent.full_name}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {parent.phone && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />{parent.phone}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Mail className="h-3 w-3" />{parent.email}
                    </div>
                  </div>
                </TableCell>
                {!showActions && (
                  <TableCell>
                    <Badge variant="default" className="gap-1">
                      <CheckCircle className="h-3 w-3" />
                      {isRTL ? 'معتمد' : 'Approved'}
                    </Badge>
                  </TableCell>
                )}
                <TableCell>
                  {parent.children.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {parent.children.map(c => (
                        <Badge key={c.student_id} variant="outline" className="text-xs">
                          {isRTL ? c.student_name_ar || c.student_name : c.student_name}
                          <span className="text-muted-foreground mx-1">·</span>
                          {getRelLabel(c.relationship)}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">{isRTL ? 'لم يتم الربط بعد' : 'Not linked yet'}</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    {showActions ? (
                      <>
                        <Button size="sm" onClick={() => handleApprove(parent.parent_id)} className="gap-1">
                          <CheckCircle className="h-3.5 w-3.5" />
                          {isRTL ? 'موافقة' : 'Approve'}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleReject(parent.parent_id)} className="gap-1">
                          <XCircle className="h-3.5 w-3.5" />
                          {isRTL ? 'رفض' : 'Reject'}
                        </Button>
                      </>
                    ) : (
                      <Badge variant="outline">{parent.children.length}</Badge>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" title={isRTL ? 'حذف نهائي' : 'Delete permanently'}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {isRTL ? 'حذف حساب ولي الأمر؟' : 'Delete parent account?'}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {isRTL
                              ? `سيتم حذف حساب "${parent.full_name_ar || parent.full_name || parent.email}" بالكامل من النظام، بما في ذلك الربط بالأبناء والإشعارات وبيانات تسجيل الدخول. هذا الإجراء لا يمكن التراجع عنه.`
                              : `Account "${parent.full_name || parent.email}" will be permanently deleted, including child links, notifications, and login credentials. This action cannot be undone.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(parent.parent_id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {isRTL ? 'حذف نهائي' : 'Delete permanently'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <DashboardLayout title={isRTL ? 'أولياء الأمور' : 'Parents'}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={isRTL ? 'بحث بالاسم أو الهاتف أو اسم الطالب...' : 'Search by name, phone, or student name...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <UserPlus className="h-4 w-4" />
              {isRTL ? 'طلبات الموافقة' : 'Approval Requests'}
              {pendingParents.length > 0 && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0 min-w-[20px]">
                  {pendingParents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              {isRTL ? 'أولياء الأمور المعتمدون' : 'Approved Parents'}
              <Badge variant="secondary" className="text-xs px-1.5 py-0 min-w-[20px]">
                {approvedParents.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : (
              renderParentTable(filterList(pendingParents), true)
            )}
          </TabsContent>

          <TabsContent value="approved" className="mt-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : (
              renderParentTable(filterList(approvedParents), false)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
