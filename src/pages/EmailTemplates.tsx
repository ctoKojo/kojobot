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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, Plus, Pencil, Trash2, Search, Link2, FileCode, Download, Upload, LayoutGrid, List, Power, PowerOff, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TemplateEditorDialog, type EmailTemplateRow } from '@/components/email/TemplateEditorDialog';
import { EventMappingsTab } from '@/components/email/EventMappingsTab';
import { ChannelStatusIcon } from '@/components/email/ChannelStatusIcon';
import { TemplatesSidebar } from '@/components/email/TemplatesSidebar';
import { TemplateCard } from '@/components/email/TemplateCard';
import { TemplateImportDialog } from '@/components/email/TemplateImportDialog';
import { useTemplatePermissions } from '@/hooks/useTemplatePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { buildExport, downloadJson } from '@/lib/templateExport';
import { computeChannelStatus, validateTemplate, type CatalogEvent } from '@/lib/templateValidation';

type ViewMode = 'cards' | 'table';

export default function EmailTemplates() {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const { permissions } = useTemplatePermissions();
  const [tab, setTab] = useState<'templates' | 'mappings'>('templates');
  const [templates, setTemplates] = useState<EmailTemplateRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogEvent[]>([]);
  const [mappingCounts, setMappingCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [audienceFilter, setAudienceFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplateRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadTemplates = async () => {
    setLoading(true);
    const [tplRes, catRes, mapRes] = await Promise.all([
      supabase.from('email_templates').select('*').order('updated_at', { ascending: false }),
      supabase.from('email_event_catalog')
        .select('event_key, display_name_en, display_name_ar, available_variables, preview_data, supported_audiences, category')
        .eq('is_active', true),
      supabase.from('email_event_mappings').select('template_id'),
    ]);
    if (tplRes.error) {
      toast({ title: isRTL ? 'فشل تحميل القوالب' : 'Failed to load templates', description: tplRes.error.message, variant: 'destructive' });
    } else {
      setTemplates((tplRes.data ?? []) as EmailTemplateRow[]);
      setCatalog((catRes.data ?? []) as unknown as CatalogEvent[]);
      const counts: Record<string, number> = {};
      ((mapRes.data ?? []) as { template_id: string | null }[]).forEach((m) => {
        if (m.template_id) counts[m.template_id] = (counts[m.template_id] ?? 0) + 1;
      });
      setMappingCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  // Derive categories from template name prefix or description
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    const visible = templates.filter((t) =>
      audienceFilter === 'all' || ((t as any).audience ?? 'student') === audienceFilter,
    );
    visible.forEach((t) => {
      const cat = deriveCategory(t.name);
      map[cat] = (map[cat] ?? 0) + 1;
    });
    return map;
  }, [templates, audienceFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = templates;
    if (audienceFilter !== 'all') {
      list = list.filter((t) => ((t as any).audience ?? 'student') === audienceFilter);
    }
    if (categoryFilter) {
      list = list.filter((t) => deriveCategory(t.name) === categoryFilter);
    }
    if (!q) return list;
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        t.subject_en.toLowerCase().includes(q) ||
        t.subject_ar.toLowerCase().includes(q),
    );
  }, [templates, search, audienceFilter, categoryFilter]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((t) => selectedIds.has(t.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((t) => next.delete(t.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((t) => next.add(t.id));
        return next;
      });
    }
  };

  const toggleSelect = (id: string, next: boolean) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (next) s.add(id); else s.delete(id);
      return s;
    });
  };

  const selectedTemplates = useMemo(
    () => templates.filter((t) => selectedIds.has(t.id)),
    [templates, selectedIds],
  );

  const handleExport = (which: 'all' | 'selected' | 'filtered' = 'filtered') => {
    const list = which === 'all' ? templates : which === 'selected' ? selectedTemplates : filtered;
    if (list.length === 0) {
      toast({ title: isRTL ? 'لا توجد قوالب' : 'Nothing to export', variant: 'destructive' });
      return;
    }
    const payload = buildExport(list, user?.id);
    const ts = new Date().toISOString().split('T')[0];
    downloadJson(`email-templates-${ts}.json`, payload);
    toast({ title: isRTL ? 'تم التصدير' : 'Exported', description: `${list.length} ${isRTL ? 'قالب' : 'templates'}` });
  };

  const bulkSetActive = async (next: boolean) => {
    if (selectedTemplates.length === 0) return;
    const { error } = await supabase
      .from('email_templates')
      .update({ is_active: next })
      .in('id', selectedTemplates.map((t) => t.id));
    if (error) {
      toast({ title: isRTL ? 'فشل التحديث' : 'Update failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: next ? (isRTL ? 'تم التفعيل' : 'Activated') : (isRTL ? 'تم الإيقاف' : 'Deactivated') });
      setSelectedIds(new Set());
      await loadTemplates();
    }
  };

  const bulkDelete = async () => {
    if (selectedTemplates.length === 0) return;
    if (!confirm(isRTL
      ? `هل تريد حذف ${selectedTemplates.length} قالب؟`
      : `Delete ${selectedTemplates.length} templates?`)) return;
    const { error } = await supabase
      .from('email_templates')
      .delete()
      .in('id', selectedTemplates.map((t) => t.id));
    if (error) {
      toast({ title: isRTL ? 'فشل الحذف' : 'Delete failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: isRTL ? 'تم الحذف' : 'Deleted' });
      setSelectedIds(new Set());
      await loadTemplates();
    }
  };

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (t: EmailTemplateRow) => {
    setEditing(t);
    setEditorOpen(true);
  };

  const handleDuplicate = async (t: EmailTemplateRow) => {
    const newName = `${t.name} (copy)`;
    const { error } = await supabase.from('email_templates').insert({
      name: newName,
      description: t.description,
      audience: (t as any).audience ?? 'student',
      subject_en: t.subject_en,
      subject_ar: t.subject_ar,
      body_html_en: t.body_html_en,
      body_html_ar: t.body_html_ar,
      subject_telegram_en: t.subject_telegram_en,
      subject_telegram_ar: t.subject_telegram_ar,
      body_telegram_md_en: t.body_telegram_md_en,
      body_telegram_md_ar: t.body_telegram_md_ar,
      is_active: false,
    });
    if (error) {
      toast({ title: isRTL ? 'فشل النسخ' : 'Duplicate failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: isRTL ? 'تم النسخ' : 'Duplicated' });
      await loadTemplates();
    }
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
          title={isRTL ? 'قوالب الإيميل والإشعارات' : 'Templates'}
          subtitle={
            isRTL
              ? 'إنشاء وتعديل قوالب الإيميلات والتيليجرام وربطها بأحداث النظام'
              : 'Create and edit email/Telegram templates and map them to system events'
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
            <div className="flex flex-col md:flex-row gap-4">
              <TemplatesSidebar
                isRTL={isRTL}
                templates={templates}
                selectedAudience={audienceFilter}
                onSelectAudience={(a) => { setAudienceFilter(a); setCategoryFilter(null); }}
                selectedCategory={categoryFilter}
                onSelectCategory={setCategoryFilter}
                categoryCounts={categoryCounts}
              />

              <div className="flex-1 min-w-0 space-y-3">
                {/* Toolbar */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <CardTitle className="text-base">
                            {isRTL ? 'القوالب' : 'Templates'}
                            <span className="ms-2 text-sm font-normal text-muted-foreground">
                              ({filtered.length}{filtered.length !== templates.length ? ` / ${templates.length}` : ''})
                            </span>
                          </CardTitle>
                          {selectedIds.size > 0 && (
                            <CardDescription className="mt-0.5">
                              {isRTL ? `${selectedIds.size} محدّد` : `${selectedIds.size} selected`}
                            </CardDescription>
                          )}
                        </div>
                        <div className="flex gap-1.5 items-center flex-wrap">
                          {/* View toggle */}
                          <div className="flex border rounded-md p-0.5">
                            <Button
                              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => setViewMode('cards')}
                              title={isRTL ? 'كروت' : 'Cards'}
                            >
                              <LayoutGrid className="h-4 w-4" />
                            </Button>
                            <Button
                              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => setViewMode('table')}
                              title={isRTL ? 'جدول' : 'Table'}
                            >
                              <List className="h-4 w-4" />
                            </Button>
                          </div>

                          {permissions.canExport && (
                            <Button variant="outline" size="sm" onClick={() => handleExport('filtered')}>
                              <Download className="h-4 w-4 me-1.5" />
                              {isRTL ? 'تصدير' : 'Export'}
                            </Button>
                          )}
                          {permissions.canImport && (
                            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                              <Upload className="h-4 w-4 me-1.5" />
                              {isRTL ? 'استيراد' : 'Import'}
                            </Button>
                          )}
                          {permissions.canCreate && (
                            <Button size="sm" onClick={openCreate}>
                              <Plus className="h-4 w-4 me-1.5" />
                              {isRTL ? 'قالب جديد' : 'New'}
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative flex-1 min-w-[200px] max-w-md">
                          <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder={isRTL ? 'بحث في الاسم أو الموضوع...' : 'Search name or subject...'}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="ps-8 h-9"
                          />
                        </div>

                        {/* Bulk actions */}
                        {selectedIds.size > 0 && (
                          <div className="flex gap-1.5 items-center border-s ps-2 ms-1">
                            <Button variant="outline" size="sm" onClick={() => bulkSetActive(true)}>
                              <Power className="h-4 w-4 me-1.5" />
                              {isRTL ? 'تفعيل' : 'Activate'}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => bulkSetActive(false)}>
                              <PowerOff className="h-4 w-4 me-1.5" />
                              {isRTL ? 'إيقاف' : 'Deactivate'}
                            </Button>
                            {permissions.canExport && (
                              <Button variant="outline" size="sm" onClick={() => handleExport('selected')}>
                                <Download className="h-4 w-4 me-1.5" />
                                {isRTL ? 'تصدير المحدد' : 'Export selected'}
                              </Button>
                            )}
                            {permissions.canDelete && (
                              <Button variant="outline" size="sm" onClick={bulkDelete} className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4 me-1.5" />
                                {isRTL ? 'حذف' : 'Delete'}
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                              {isRTL ? 'إلغاء التحديد' : 'Clear'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Content */}
                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} className="h-40 w-full" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <Card>
                    <CardContent className="py-16 text-center text-muted-foreground">
                      <Mail className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      {isRTL ? 'لا توجد قوالب مطابقة' : 'No matching templates'}
                    </CardContent>
                  </Card>
                ) : viewMode === 'cards' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filtered.map((t) => (
                      <TemplateCard
                        key={t.id}
                        template={t}
                        isRTL={isRTL}
                        catalog={catalog}
                        linkedCount={mappingCounts[t.id] ?? 0}
                        selected={selectedIds.has(t.id)}
                        onSelect={(n) => toggleSelect(t.id, n)}
                        onEdit={() => openEdit(t)}
                        onDelete={() => handleDelete(t)}
                        onDuplicate={() => handleDuplicate(t)}
                        onToggleActive={(n) => toggleActive(t, n)}
                        canEdit={permissions.canEdit}
                        canDelete={permissions.canDelete}
                      />
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">
                                <Checkbox
                                  checked={allVisibleSelected}
                                  onCheckedChange={toggleSelectAll}
                                  aria-label="Select all"
                                />
                              </TableHead>
                              <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                              <TableHead>{isRTL ? 'القنوات' : 'Channels'}</TableHead>
                              <TableHead>{isRTL ? 'الجمهور' : 'Audience'}</TableHead>
                              <TableHead>{isRTL ? 'مربوط' : 'Linked'}</TableHead>
                              <TableHead>{isRTL ? 'مفعّل' : 'Active'}</TableHead>
                              <TableHead>{isRTL ? 'آخر تحديث' : 'Updated'}</TableHead>
                              <TableHead className="text-end">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filtered.map((t) => {
                              const v = validateTemplate(t, catalog);
                              const emailStatus = computeChannelStatus(
                                !!t.body_html_en?.trim() && !!t.body_html_ar?.trim(),
                                v, 'email', t.last_test_status ?? null,
                              );
                              const tgStatus = computeChannelStatus(
                                !!t.body_telegram_md_en?.trim() || !!t.body_telegram_md_ar?.trim(),
                                v, 'telegram', t.last_test_status ?? null,
                              );
                              return (
                                <TableRow key={t.id} className={selectedIds.has(t.id) ? 'bg-accent/30' : ''}>
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedIds.has(t.id)}
                                      onCheckedChange={(c) => toggleSelect(t.id, !!c)}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <button onClick={() => openEdit(t)} className="text-start hover:text-primary">
                                      <div className="font-medium">{t.name}</div>
                                      {t.description && (
                                        <div className="text-xs text-muted-foreground line-clamp-1">{t.description}</div>
                                      )}
                                    </button>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <ChannelStatusIcon channel="email" status={emailStatus} isRTL={isRTL} />
                                      <ChannelStatusIcon channel="telegram" status={tgStatus} isRTL={isRTL} />
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="secondary" className="text-xs">
                                      {((t as any).audience ?? 'student')}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {(mappingCounts[t.id] ?? 0) > 0 ? (
                                      <Badge variant="outline" className="text-xs gap-1">
                                        <Link2 className="h-3 w-3" />
                                        {mappingCounts[t.id]}
                                      </Badge>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
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
                                    {permissions.canEdit && (
                                      <Button variant="ghost" size="icon" onClick={() => handleDuplicate(t)} title={isRTL ? 'نسخ' : 'Duplicate'}>
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                    )}
                                    {permissions.canEdit && (
                                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                    )}
                                    {permissions.canDelete && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(t)}
                                        className="text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
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

        <TemplateImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          existing={templates}
          isRTL={isRTL}
          onImported={loadTemplates}
        />
      </div>
    </DashboardLayout>
  );
}

/**
 * Derive a category from template name. Templates are usually named like
 * "session_reminder_24h" or "payment_due" — we group by the first segment.
 */
function deriveCategory(name: string): string {
  const lower = name.toLowerCase();
  if (lower.startsWith('session') || lower.includes('attend')) return 'sessions';
  if (lower.startsWith('payment') || lower.includes('invoice') || lower.includes('finance')) return 'finance';
  if (lower.startsWith('quiz') || lower.startsWith('exam') || lower.startsWith('assignment') || lower.includes('grade')) return 'academic';
  if (lower.includes('warning') || lower.includes('discipline') || lower.includes('compliance')) return 'discipline';
  if (lower.includes('parent')) return 'parent';
  if (lower.startsWith('welcome') || lower.includes('reset') || lower.includes('verify') || lower.includes('auth')) return 'auth';
  if (lower.includes('system') || lower.includes('alert')) return 'system';
  return 'other';
}
