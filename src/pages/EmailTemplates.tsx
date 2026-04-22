import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, Plus, Pencil, Trash2, Search, Link2, FileCode, Download, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TemplateEditorDialog, type EmailTemplateRow } from '@/components/email/TemplateEditorDialog';
import { EventMappingsTab } from '@/components/email/EventMappingsTab';
import { ChannelStatusIcon } from '@/components/email/ChannelStatusIcon';
import { useTemplatePermissions } from '@/hooks/useTemplatePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { buildExport, downloadJson, parseImport } from '@/lib/templateExport';
import { computeChannelStatus, validateTemplate, type CatalogEvent } from '@/lib/templateValidation';

export default function EmailTemplates() {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const { permissions } = useTemplatePermissions();
  const [tab, setTab] = useState<'templates' | 'mappings'>('templates');
  const [templates, setTemplates] = useState<EmailTemplateRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [audienceFilter, setAudienceFilter] = useState<string>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplateRow | null>(null);

  const AUDIENCE_OPTIONS = [
    { value: 'all',        en: 'All',         ar: 'الكل' },
    { value: 'student',    en: 'Students',    ar: 'الطلاب' },
    { value: 'parent',     en: 'Parents',     ar: 'أولياء الأمور' },
    { value: 'instructor', en: 'Instructors', ar: 'المدربين' },
    { value: 'admin',      en: 'Admins',      ar: 'الإدارة' },
    { value: 'reception',  en: 'Reception',   ar: 'الاستقبال' },
  ];

  const audienceLabel = (v: string | undefined) => {
    const opt = AUDIENCE_OPTIONS.find((o) => o.value === (v ?? 'student'));
    return opt ? (isRTL ? opt.ar : opt.en) : v ?? '-';
  };

  const loadTemplates = async () => {
    setLoading(true);
    const [tplRes, catRes] = await Promise.all([
      supabase.from('email_templates').select('*').order('updated_at', { ascending: false }),
      supabase.from('email_event_catalog')
        .select('event_key, display_name_en, display_name_ar, available_variables, preview_data, supported_audiences')
        .eq('is_active', true),
    ]);
    if (tplRes.error) {
      toast({ title: isRTL ? 'فشل تحميل القوالب' : 'Failed to load templates', description: tplRes.error.message, variant: 'destructive' });
    } else {
      setTemplates((tplRes.data ?? []) as EmailTemplateRow[]);
      setCatalog((catRes.data ?? []) as unknown as CatalogEvent[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  const handleExport = () => {
    const payload = buildExport(filtered, user?.id);
    const ts = new Date().toISOString().split('T')[0];
    downloadJson(`email-templates-${ts}.json`, payload);
    toast({ title: isRTL ? 'تم التصدير' : 'Exported', description: `${filtered.length} templates` });
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = parseImport(text);
        if (!confirm(isRTL
          ? `سيتم استيراد ${parsed.templates.length} قالب (وضع: استبدال). متابعة؟`
          : `Will import ${parsed.templates.length} templates (overwrite mode). Continue?`)) return;
        const { data, error } = await supabase.rpc('import_email_templates_batch', {
          p_payload: parsed as any,
          p_mode: 'overwrite',
        });
        if (error) throw error;
        const result = data as any;
        toast({
          title: isRTL ? 'تم الاستيراد' : 'Imported',
          description: `${result.created ?? 0} new, ${result.updated ?? 0} updated, ${result.skipped ?? 0} skipped`,
        });
        await loadTemplates();
      } catch (e: any) {
        toast({ title: isRTL ? 'فشل الاستيراد' : 'Import failed', description: e.message, variant: 'destructive' });
      }
    };
    input.click();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = templates;
    if (audienceFilter !== 'all') {
      list = list.filter((t) => ((t as any).audience ?? 'student') === audienceFilter);
    }
    if (!q) return list;
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        t.subject_en.toLowerCase().includes(q) ||
        t.subject_ar.toLowerCase().includes(q),
    );
  }, [templates, search, audienceFilter]);

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (t: EmailTemplateRow) => {
    setEditing(t);
    setEditorOpen(true);
  };

  const handleDelete = async (t: EmailTemplateRow) => {
    if (!confirm(isRTL ? `هل تريد حذف القالب "${t.name}"؟` : `Delete template "${t.name}"?`)) return;
    const { error } = await supabase.from('email_templates').delete().eq('id', t.id);
    if (error) {
      toast({ title: isRTL ? 'فشل الحذف' : 'Delete failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: isRTL ? 'تم الحذف' : 'Deleted' });
      await loadTemplates();
    }
  };

  const toggleActive = async (t: EmailTemplateRow, next: boolean) => {
    const { error } = await supabase
      .from('email_templates')
      .update({ is_active: next })
      .eq('id', t.id);
    if (error) {
      toast({ title: isRTL ? 'فشل التحديث' : 'Update failed', description: error.message, variant: 'destructive' });
    } else {
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_active: next } : x)));
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          icon={Mail}
          title={isRTL ? 'قوالب الإيميل' : 'Email Templates'}
          subtitle={
            isRTL
              ? 'إنشاء وتعديل قوالب الإيميلات وربطها بأحداث النظام'
              : 'Create and edit email templates and map them to system events'
          }
        />

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'templates' | 'mappings')}>
          <TabsList>
            <TabsTrigger value="templates">
              <FileCode className="h-4 w-4 me-2" />
              {isRTL ? 'القوالب' : 'Templates'}
            </TabsTrigger>
            <TabsTrigger value="mappings">
              <Link2 className="h-4 w-4 me-2" />
              {isRTL ? 'ربط الأحداث' : 'Event Mappings'}
            </TabsTrigger>
          </TabsList>

          {/* === Templates tab === */}
          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle>{isRTL ? 'كل القوالب' : 'All templates'}</CardTitle>
                    <CardDescription>
                      {isRTL
                        ? `إجمالي ${templates.length} قالب`
                        : `${templates.length} templates total`}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={isRTL ? 'بحث...' : 'Search...'}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="ps-8 w-64"
                      />
                    </div>
                    {permissions.canExport && (
                      <Button variant="outline" onClick={handleExport}>
                        <Download className="h-4 w-4 me-2" />
                        {isRTL ? 'تصدير' : 'Export'}
                      </Button>
                    )}
                    {permissions.canImport && (
                      <Button variant="outline" onClick={handleImport}>
                        <Upload className="h-4 w-4 me-2" />
                        {isRTL ? 'استيراد' : 'Import'}
                      </Button>
                    )}
                    {permissions.canCreate && (
                      <Button onClick={openCreate}>
                        <Plus className="h-4 w-4 me-2" />
                        {isRTL ? 'قالب جديد' : 'New template'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <div className="border rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                          <TableHead>{isRTL ? 'القنوات' : 'Channels'}</TableHead>
                          <TableHead>{isRTL ? 'موضوع (EN)' : 'Subject (EN)'}</TableHead>
                          <TableHead>{isRTL ? 'مفعّل' : 'Active'}</TableHead>
                          <TableHead>{isRTL ? 'آخر تحديث' : 'Updated'}</TableHead>
                          <TableHead className="text-end">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              {isRTL ? 'لا توجد قوالب' : 'No templates yet'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filtered.map((t) => (
                            <TableRow key={t.id}>
                              <TableCell>
                                <div className="font-medium">{t.name}</div>
                                {t.description && (
                                  <div className="text-xs text-muted-foreground">{t.description}</div>
                                )}
                              </TableCell>
                              <TableCell className="max-w-xs truncate">{t.subject_en}</TableCell>
                              <TableCell className="max-w-xs truncate" dir="rtl">
                                {t.subject_ar}
                              </TableCell>
                              <TableCell>
                                <Switch
                                  checked={t.is_active}
                                  onCheckedChange={(c) => toggleActive(t, c)}
                                />
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {new Date(t.updated_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-end">
                                <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(t)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === Event Mappings tab === */}
          <TabsContent value="mappings">
            <EventMappingsTab templates={templates} />
          </TabsContent>
        </Tabs>

        <TemplateEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          template={editing}
          onSaved={() => {
            setEditorOpen(false);
            void loadTemplates();
          }}
        />
      </div>
    </DashboardLayout>
  );
}
