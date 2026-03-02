import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Save, GripVertical, Eye, Pencil, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

const SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

export default function LandingCMS() {
  const { isRTL } = useLanguage();
  const t = (ar: string, en: string) => isRTL ? ar : en;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('إدارة صفحة الهبوط', 'Landing Page CMS')}</h1>
            <p className="text-muted-foreground text-sm">{t('تحكم في محتوى صفحة الهبوط', 'Manage landing page content')}</p>
          </div>
          <Button variant="outline" onClick={() => window.open('/', '_blank')} className="gap-2">
            <Eye className="h-4 w-4" />
            {t('معاينة', 'Preview')}
          </Button>
        </div>

        <Tabs defaultValue="hero" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="hero">{t('الهيرو والفوتر', 'Hero & Footer')}</TabsTrigger>
            <TabsTrigger value="features">{t('المميزات', 'Features')}</TabsTrigger>
            <TabsTrigger value="plans">{t('الباقات', 'Plans')}</TabsTrigger>
            <TabsTrigger value="tracks">{t('المسارات', 'Tracks')}</TabsTrigger>
          </TabsList>

          <TabsContent value="hero"><HeroFooterTab t={t} /></TabsContent>
          <TabsContent value="features"><FeaturesTab t={t} /></TabsContent>
          <TabsContent value="plans"><PlansTab t={t} /></TabsContent>
          <TabsContent value="tracks"><TracksTab t={t} /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

/* ==================== Hero & Footer Tab ==================== */
function HeroFooterTab({ t }: { t: (ar: string, en: string) => string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['landing-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('landing_settings').select('*').eq('id', SETTINGS_ID).single();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<any>(null);
  const s = form ?? settings;

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      const { error } = await supabase.from('landing_settings').upsert({ ...values, id: SETTINGS_ID, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-settings'] });
      queryClient.invalidateQueries({ queryKey: ['landing-content'] });
      toast({ title: t('تم الحفظ', 'Saved') });
      setForm(null);
    },
    onError: () => toast({ title: t('خطأ في الحفظ', 'Save error'), variant: 'destructive' }),
  });

  if (isLoading || !s) return <div className="p-8 text-center text-muted-foreground">{t('جاري التحميل...', 'Loading...')}</div>;

  const update = (key: string, value: any) => setForm((prev: any) => ({ ...(prev ?? settings), [key]: value }));

  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardHeader><CardTitle>{t('قسم الهيرو', 'Hero Section')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label>{t('العنوان (عربي)', 'Title (AR)')}</Label><Input value={s.hero_title_ar || ''} onChange={e => update('hero_title_ar', e.target.value)} dir="rtl" /></div>
            <div><Label>{t('العنوان (إنجليزي)', 'Title (EN)')}</Label><Input value={s.hero_title_en || ''} onChange={e => update('hero_title_en', e.target.value)} /></div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label>{t('الوصف (عربي)', 'Subtitle (AR)')}</Label><Textarea value={s.hero_subtitle_ar || ''} onChange={e => update('hero_subtitle_ar', e.target.value)} dir="rtl" /></div>
            <div><Label>{t('الوصف (إنجليزي)', 'Subtitle (EN)')}</Label><Textarea value={s.hero_subtitle_en || ''} onChange={e => update('hero_subtitle_en', e.target.value)} /></div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div><Label>{t('نص الزرار (عربي)', 'CTA Text (AR)')}</Label><Input value={s.cta_text_ar || ''} onChange={e => update('cta_text_ar', e.target.value)} dir="rtl" /></div>
            <div><Label>{t('نص الزرار (إنجليزي)', 'CTA Text (EN)')}</Label><Input value={s.cta_text_en || ''} onChange={e => update('cta_text_en', e.target.value)} /></div>
            <div><Label>{t('رابط الزرار', 'CTA URL')}</Label><Input value={s.cta_url || ''} onChange={e => update('cta_url', e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('الفوتر والتواصل', 'Footer & Contact')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label>{t('نص الفوتر (عربي)', 'Footer (AR)')}</Label><Input value={s.footer_text_ar || ''} onChange={e => update('footer_text_ar', e.target.value)} dir="rtl" /></div>
            <div><Label>{t('نص الفوتر (إنجليزي)', 'Footer (EN)')}</Label><Input value={s.footer_text_en || ''} onChange={e => update('footer_text_en', e.target.value)} /></div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div><Label>{t('واتساب', 'WhatsApp')}</Label><Input value={s.whatsapp || ''} onChange={e => update('whatsapp', e.target.value)} placeholder="+201234567890" /></div>
            <div><Label>{t('الهاتف', 'Phone')}</Label><Input value={s.phone || ''} onChange={e => update('phone', e.target.value)} /></div>
            <div><Label>{t('البريد', 'Email')}</Label><Input type="email" value={s.email || ''} onChange={e => update('email', e.target.value)} /></div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label>{t('العنوان (عربي)', 'Address (AR)')}</Label><Input value={s.address_ar || ''} onChange={e => update('address_ar', e.target.value)} dir="rtl" /></div>
            <div><Label>{t('العنوان (إنجليزي)', 'Address (EN)')}</Label><Input value={s.address_en || ''} onChange={e => update('address_en', e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate(form ?? settings)} disabled={saveMutation.isPending || !form} className="kojo-gradient text-white gap-2">
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? t('جاري الحفظ...', 'Saving...') : t('حفظ التغييرات', 'Save Changes')}
        </Button>
      </div>
    </div>
  );
}

/* ==================== Features Tab ==================== */
function FeaturesTab({ t }: { t: (ar: string, en: string) => string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editItem, setEditItem] = useState<any>(null);

  const { data: features = [], isLoading } = useQuery({
    queryKey: ['landing-features'],
    queryFn: async () => {
      const { data, error } = await supabase.from('landing_features').select('*').order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('landing_features').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['landing-features'] }); queryClient.invalidateQueries({ queryKey: ['landing-content'] }); },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('landing_features').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['landing-features'] }); queryClient.invalidateQueries({ queryKey: ['landing-content'] }); },
  });

  const saveMutation = useMutation({
    mutationFn: async (item: any) => {
      if (item.id) {
        const { error } = await supabase.from('landing_features').update(item).eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('landing_features').insert(item);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-features'] });
      queryClient.invalidateQueries({ queryKey: ['landing-content'] });
      setEditItem(null);
      toast({ title: t('تم الحفظ', 'Saved') });
    },
  });

  return (
    <div className="mt-4 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">{t('المميزات', 'Features')}</h3>
        <Button size="sm" onClick={() => setEditItem({ sort_order: features.length, is_active: true, icon_name: 'Star', title_ar: '', title_en: '', desc_ar: '', desc_en: '' })} className="gap-2">
          <Plus className="h-4 w-4" /> {t('إضافة', 'Add')}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>{t('الأيقونة', 'Icon')}</TableHead>
            <TableHead>{t('العنوان', 'Title')}</TableHead>
            <TableHead>{t('مفعّل', 'Active')}</TableHead>
            <TableHead>{t('إجراءات', 'Actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {features.map((f: any) => (
            <TableRow key={f.id}>
              <TableCell>{f.sort_order}</TableCell>
              <TableCell><Badge variant="outline">{f.icon_name}</Badge></TableCell>
              <TableCell>{f.title_en} / {f.title_ar}</TableCell>
              <TableCell><Switch checked={f.is_active} onCheckedChange={v => toggleMutation.mutate({ id: f.id, is_active: v })} /></TableCell>
              <TableCell className="flex gap-2">
                <Button size="icon" variant="ghost" onClick={() => setEditItem(f)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editItem && (
        <Dialog open onOpenChange={() => setEditItem(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editItem.id ? t('تعديل ميزة', 'Edit Feature') : t('إضافة ميزة', 'Add Feature')}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Icon Name</Label><Input value={editItem.icon_name} onChange={e => setEditItem({ ...editItem, icon_name: e.target.value })} placeholder="Star, Monitor, Code..." /></div>
                <div><Label>Sort Order</Label><Input type="number" value={editItem.sort_order} onChange={e => setEditItem({ ...editItem, sort_order: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t('العنوان (عربي)', 'Title (AR)')}</Label><Input value={editItem.title_ar} onChange={e => setEditItem({ ...editItem, title_ar: e.target.value })} dir="rtl" /></div>
                <div><Label>{t('العنوان (إنجليزي)', 'Title (EN)')}</Label><Input value={editItem.title_en} onChange={e => setEditItem({ ...editItem, title_en: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t('الوصف (عربي)', 'Desc (AR)')}</Label><Textarea value={editItem.desc_ar} onChange={e => setEditItem({ ...editItem, desc_ar: e.target.value })} dir="rtl" /></div>
                <div><Label>{t('الوصف (إنجليزي)', 'Desc (EN)')}</Label><Textarea value={editItem.desc_en} onChange={e => setEditItem({ ...editItem, desc_en: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditItem(null)}>{t('إلغاء', 'Cancel')}</Button>
              <Button onClick={() => saveMutation.mutate(editItem)} disabled={saveMutation.isPending}>{t('حفظ', 'Save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ==================== Plans Tab ==================== */
function PlansTab({ t }: { t: (ar: string, en: string) => string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editItem, setEditItem] = useState<any>(null);

  const { data: plans = [] } = useQuery({
    queryKey: ['landing-plans-cms'],
    queryFn: async () => {
      const { data, error } = await supabase.from('landing_plans').select('*').order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('landing_plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['landing-plans-cms'] }); queryClient.invalidateQueries({ queryKey: ['landing-content'] }); },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('landing_plans').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['landing-plans-cms'] }); queryClient.invalidateQueries({ queryKey: ['landing-content'] }); },
  });

  const saveMutation = useMutation({
    mutationFn: async (item: any) => {
      const { id, ...rest } = item;
      if (id && !id.startsWith('new-')) {
        const { error } = await supabase.from('landing_plans').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('landing_plans').insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-plans-cms'] });
      queryClient.invalidateQueries({ queryKey: ['landing-content'] });
      setEditItem(null);
      toast({ title: t('تم الحفظ', 'Saved') });
    },
  });

  return (
    <div className="mt-4 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">{t('الباقات', 'Plans')}</h3>
        <Button size="sm" onClick={() => setEditItem({ id: 'new-' + Date.now(), sort_order: plans.length, is_active: true, mode: 'offline', name_ar: '', name_en: '', price_number: 0, price_currency: 'EGP', billing_period_ar: 'شهرياً', billing_period_en: 'Monthly', is_featured: false })} className="gap-2">
          <Plus className="h-4 w-4" /> {t('إضافة', 'Add')}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>{t('الاسم', 'Name')}</TableHead>
            <TableHead>{t('النوع', 'Mode')}</TableHead>
            <TableHead>{t('السعر', 'Price')}</TableHead>
            <TableHead>{t('مفعّل', 'Active')}</TableHead>
            <TableHead>{t('إجراءات', 'Actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((p: any) => (
            <TableRow key={p.id}>
              <TableCell>{p.sort_order}</TableCell>
              <TableCell>{p.name_en} {p.is_featured && <Badge className="ms-2">★</Badge>}</TableCell>
              <TableCell><Badge variant="outline">{p.mode}</Badge></TableCell>
              <TableCell>{p.price_number} {p.price_currency}</TableCell>
              <TableCell><Switch checked={p.is_active} onCheckedChange={v => toggleMutation.mutate({ id: p.id, is_active: v })} /></TableCell>
              <TableCell className="flex gap-2">
                <Button size="icon" variant="ghost" onClick={() => setEditItem(p)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editItem && (
        <Dialog open onOpenChange={() => setEditItem(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editItem.id?.startsWith('new-') ? t('إضافة باقة', 'Add Plan') : t('تعديل باقة', 'Edit Plan')}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t('الاسم (عربي)', 'Name (AR)')}</Label><Input value={editItem.name_ar} onChange={e => setEditItem({ ...editItem, name_ar: e.target.value })} dir="rtl" /></div>
                <div><Label>{t('الاسم (إنجليزي)', 'Name (EN)')}</Label><Input value={editItem.name_en} onChange={e => setEditItem({ ...editItem, name_en: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>{t('النوع', 'Mode')}</Label>
                  <Select value={editItem.mode} onValueChange={v => setEditItem({ ...editItem, mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="offline">Offline</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{t('السعر', 'Price')}</Label><Input type="number" value={editItem.price_number} onChange={e => setEditItem({ ...editItem, price_number: parseFloat(e.target.value) || 0 })} /></div>
                <div><Label>{t('الترتيب', 'Sort')}</Label><Input type="number" value={editItem.sort_order} onChange={e => setEditItem({ ...editItem, sort_order: parseInt(e.target.value) || 0 })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t('فترة الدفع (عربي)', 'Billing (AR)')}</Label><Input value={editItem.billing_period_ar} onChange={e => setEditItem({ ...editItem, billing_period_ar: e.target.value })} dir="rtl" /></div>
                <div><Label>{t('فترة الدفع (إنجليزي)', 'Billing (EN)')}</Label><Input value={editItem.billing_period_en} onChange={e => setEditItem({ ...editItem, billing_period_en: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>{t('حصص/شهر', 'Sessions/mo')}</Label><Input type="number" value={editItem.sessions_per_month || ''} onChange={e => setEditItem({ ...editItem, sessions_per_month: parseInt(e.target.value) || null })} /></div>
                <div><Label>{t('مدة الحصة', 'Duration')}</Label><Input type="number" value={editItem.session_duration_minutes || ''} onChange={e => setEditItem({ ...editItem, session_duration_minutes: parseInt(e.target.value) || null })} /></div>
                <div className="flex items-end gap-2 pb-1">
                  <Switch checked={editItem.is_featured} onCheckedChange={v => setEditItem({ ...editItem, is_featured: v })} />
                  <Label>{t('مميزة', 'Featured')}</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditItem(null)}>{t('إلغاء', 'Cancel')}</Button>
              <Button onClick={() => saveMutation.mutate(editItem)} disabled={saveMutation.isPending}>{t('حفظ', 'Save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ==================== Tracks Tab ==================== */
function TracksTab({ t }: { t: (ar: string, en: string) => string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editGroup, setEditGroup] = useState<any>(null);
  const [editStep, setEditStep] = useState<any>(null);

  const { data: groups = [] } = useQuery({
    queryKey: ['landing-track-groups-cms'],
    queryFn: async () => {
      const { data, error } = await supabase.from('landing_track_groups').select('*').order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const { data: steps = [] } = useQuery({
    queryKey: ['landing-track-steps-cms'],
    queryFn: async () => {
      const { data, error } = await supabase.from('landing_track_steps').select('*').order('step_number');
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['landing-track-groups-cms'] });
    queryClient.invalidateQueries({ queryKey: ['landing-track-steps-cms'] });
    queryClient.invalidateQueries({ queryKey: ['landing-content'] });
  };

  const saveGroupMutation = useMutation({
    mutationFn: async (item: any) => {
      const { id, ...rest } = item;
      if (id && !id.startsWith('new-')) {
        const { error } = await supabase.from('landing_track_groups').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('landing_track_groups').insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidate(); setEditGroup(null); toast({ title: t('تم الحفظ', 'Saved') }); },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('landing_track_groups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const saveStepMutation = useMutation({
    mutationFn: async (item: any) => {
      const { id, specializations, ...rest } = item;
      const payload = { ...rest, specializations: specializations && specializations.length > 0 ? specializations : null };
      if (id && !id.startsWith('new-')) {
        const { error } = await supabase.from('landing_track_steps').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('landing_track_steps').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidate(); setEditStep(null); toast({ title: t('تم الحفظ', 'Saved') }); },
  });

  const deleteStepMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('landing_track_steps').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return (
    <div className="mt-4 space-y-6">
      {/* Track Groups */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{t('الفئات العمرية', 'Age Groups')}</CardTitle>
          <Button size="sm" onClick={() => setEditGroup({ id: 'new-' + Date.now(), age_group: '6_9', title_ar: '', title_en: '', intro_ar: '', intro_en: '', sort_order: groups.length })} className="gap-2">
            <Plus className="h-4 w-4" /> {t('إضافة', 'Add')}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('الفئة', 'Age Group')}</TableHead>
                <TableHead>{t('العنوان', 'Title')}</TableHead>
                <TableHead>{t('الخطوات', 'Steps')}</TableHead>
                <TableHead>{t('إجراءات', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g: any) => (
                <TableRow key={g.id}>
                  <TableCell><Badge>{g.age_group.replace('_', '-')}</Badge></TableCell>
                  <TableCell>{g.title_en}</TableCell>
                  <TableCell>{steps.filter((s: any) => s.group_id === g.id).length}</TableCell>
                  <TableCell className="flex gap-2">
                    <Button size="icon" variant="ghost" onClick={() => setEditGroup(g)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteGroupMutation.mutate(g.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Track Steps */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{t('خطوات المسار', 'Track Steps')}</CardTitle>
          <Button size="sm" onClick={() => setEditStep({ id: 'new-' + Date.now(), group_id: groups[0]?.id || '', path_type: 'general', step_number: 1, title_ar: '', title_en: '', desc_ar: '', desc_en: '', specializations: [] })} className="gap-2" disabled={groups.length === 0}>
            <Plus className="h-4 w-4" /> {t('إضافة', 'Add')}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('الفئة', 'Group')}</TableHead>
                <TableHead>{t('النوع', 'Path')}</TableHead>
                <TableHead>#</TableHead>
                <TableHead>{t('العنوان', 'Title')}</TableHead>
                <TableHead>{t('إجراءات', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.map((s: any) => {
                const group = groups.find((g: any) => g.id === s.group_id);
                return (
                  <TableRow key={s.id}>
                    <TableCell><Badge variant="outline">{group?.age_group?.replace('_', '-') || '?'}</Badge></TableCell>
                    <TableCell><Badge variant={s.path_type === 'general' ? 'default' : 'secondary'}>{s.path_type}</Badge></TableCell>
                    <TableCell>{s.step_number}</TableCell>
                    <TableCell>{s.title_en}</TableCell>
                    <TableCell className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => setEditStep({ ...s, specializations: s.specializations || [] })}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteStepMutation.mutate(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Group Dialog */}
      {editGroup && (
        <Dialog open onOpenChange={() => setEditGroup(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editGroup.id?.startsWith('new-') ? t('إضافة فئة', 'Add Group') : t('تعديل فئة', 'Edit Group')}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t('الفئة العمرية', 'Age Group')}</Label>
                <Select value={editGroup.age_group} onValueChange={v => setEditGroup({ ...editGroup, age_group: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6_9">6-9</SelectItem>
                    <SelectItem value="10_13">10-13</SelectItem>
                    <SelectItem value="14_18">14-18</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t('العنوان (عربي)', 'Title (AR)')}</Label><Input value={editGroup.title_ar} onChange={e => setEditGroup({ ...editGroup, title_ar: e.target.value })} dir="rtl" /></div>
                <div><Label>{t('العنوان (إنجليزي)', 'Title (EN)')}</Label><Input value={editGroup.title_en} onChange={e => setEditGroup({ ...editGroup, title_en: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t('المقدمة (عربي)', 'Intro (AR)')}</Label><Textarea value={editGroup.intro_ar} onChange={e => setEditGroup({ ...editGroup, intro_ar: e.target.value })} dir="rtl" /></div>
                <div><Label>{t('المقدمة (إنجليزي)', 'Intro (EN)')}</Label><Textarea value={editGroup.intro_en} onChange={e => setEditGroup({ ...editGroup, intro_en: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditGroup(null)}>{t('إلغاء', 'Cancel')}</Button>
              <Button onClick={() => saveGroupMutation.mutate(editGroup)} disabled={saveGroupMutation.isPending}>{t('حفظ', 'Save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Step Dialog */}
      {editStep && (
        <Dialog open onOpenChange={() => setEditStep(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editStep.id?.startsWith('new-') ? t('إضافة خطوة', 'Add Step') : t('تعديل خطوة', 'Edit Step')}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>{t('الفئة', 'Group')}</Label>
                  <Select value={editStep.group_id} onValueChange={v => setEditStep({ ...editStep, group_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {groups.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.age_group.replace('_', '-')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('النوع', 'Path Type')}</Label>
                  <Select value={editStep.path_type} onValueChange={v => setEditStep({ ...editStep, path_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="software">Software</SelectItem>
                      <SelectItem value="hardware">Hardware</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{t('رقم الخطوة', 'Step #')}</Label><Input type="number" value={editStep.step_number} onChange={e => setEditStep({ ...editStep, step_number: parseInt(e.target.value) || 1 })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t('العنوان (عربي)', 'Title (AR)')}</Label><Input value={editStep.title_ar} onChange={e => setEditStep({ ...editStep, title_ar: e.target.value })} dir="rtl" /></div>
                <div><Label>{t('العنوان (إنجليزي)', 'Title (EN)')}</Label><Input value={editStep.title_en} onChange={e => setEditStep({ ...editStep, title_en: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t('الوصف (عربي)', 'Desc (AR)')}</Label><Textarea value={editStep.desc_ar} onChange={e => setEditStep({ ...editStep, desc_ar: e.target.value })} dir="rtl" /></div>
                <div><Label>{t('الوصف (إنجليزي)', 'Desc (EN)')}</Label><Textarea value={editStep.desc_en} onChange={e => setEditStep({ ...editStep, desc_en: e.target.value })} /></div>
              </div>
              <div>
                <Label>{t('التخصصات (مفصولة بفاصلة)', 'Specializations (comma-separated)')}</Label>
                <Input value={(editStep.specializations || []).join(', ')} onChange={e => setEditStep({ ...editStep, specializations: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })} placeholder="Web Development, AI, IoT..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditStep(null)}>{t('إلغاء', 'Cancel')}</Button>
              <Button onClick={() => saveStepMutation.mutate(editStep)} disabled={saveStepMutation.isPending}>{t('حفظ', 'Save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
