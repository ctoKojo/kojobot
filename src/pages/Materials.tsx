import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Search, ChevronDown, ChevronRight, FileText, Video, Image, Link2,
  File, Trash2, Edit, Upload, ExternalLink, FolderOpen
} from 'lucide-react';

interface Material {
  id: string;
  title: string;
  title_ar: string;
  description: string | null;
  description_ar: string | null;
  material_type: string;
  file_url: string;
  file_type: string;
  original_filename: string | null;
  age_group_id: string | null;
  level_id: string | null;
  subscription_type: string | null;
  attendance_mode: string | null;
  uploaded_by: string;
  is_active: boolean;
  created_at: string;
}

interface AgeGroup {
  id: string;
  name: string;
  name_ar: string;
  min_age: number;
  max_age: number;
}

interface Level {
  id: string;
  name: string;
  name_ar: string;
  level_order: number;
}

const FILE_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  video: Video,
  image: Image,
  link: Link2,
  document: FileText,
  other: File,
};

function getFileType(file: File): string {
  const mime = file.type;
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.includes('word') || mime.includes('document')) return 'document';
  return 'other';
}

export default function Materials() {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubscription, setFilterSubscription] = useState<string>('all');
  const [filterMode, setFilterMode] = useState<string>('all');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formAgeGroupId, setFormAgeGroupId] = useState<string>('all');
  const [formLevelId, setFormLevelId] = useState<string>('all');
  const [formSubscription, setFormSubscription] = useState<string>('all');
  const [formMode, setFormMode] = useState<string>('all');
  const [formType, setFormType] = useState<'file' | 'link'>('file');
  const [formLink, setFormLink] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Fetch data
  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Material[];
    },
  });

  const { data: ageGroups = [] } = useQuery({
    queryKey: ['age_groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('age_groups')
        .select('*')
        .eq('is_active', true)
        .order('min_age');
      if (error) throw error;
      return data as AgeGroup[];
    },
  });

  const { data: levels = [] } = useQuery({
    queryKey: ['levels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('levels')
        .select('*')
        .eq('is_active', true)
        .order('level_order');
      if (error) throw error;
      return data as Level[];
    },
  });

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('materials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      toast({ title: isRTL ? 'تم الحذف بنجاح' : 'Deleted successfully' });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (editingMaterial) {
        const { error } = await supabase.from('materials').update(data as any).eq('id', editingMaterial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('materials').insert(data as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      toast({ title: isRTL ? 'تم الحفظ بنجاح' : 'Saved successfully' });
      resetForm();
      setDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: isRTL ? 'حدث خطأ' : 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // Filter materials
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!m.title.toLowerCase().includes(q) && !m.title_ar.toLowerCase().includes(q)) return false;
      }
      if (filterSubscription !== 'all' && m.subscription_type !== null && m.subscription_type !== filterSubscription) return false;
      if (filterMode !== 'all' && m.attendance_mode !== null && m.attendance_mode !== filterMode) return false;
      return true;
    });
  }, [materials, searchQuery, filterSubscription, filterMode]);

  // Group materials hierarchically
  const grouped = useMemo(() => {
    const ageGroupMap = new Map<string, { ageGroup: AgeGroup | null; levels: Map<string, { level: Level | null; materials: Material[] }> }>();

    for (const m of filteredMaterials) {
      const agKey = m.age_group_id || '__all__';
      if (!ageGroupMap.has(agKey)) {
        const ag = ageGroups.find((a) => a.id === m.age_group_id) || null;
        ageGroupMap.set(agKey, { ageGroup: ag, levels: new Map() });
      }
      const agEntry = ageGroupMap.get(agKey)!;
      const lvKey = m.level_id || '__all__';
      if (!agEntry.levels.has(lvKey)) {
        const lv = levels.find((l) => l.id === m.level_id) || null;
        agEntry.levels.set(lvKey, { level: lv, materials: [] });
      }
      agEntry.levels.get(lvKey)!.materials.push(m);
    }

    // Sort age groups: specific ones by min_age, "__all__" at the end
    const sorted = Array.from(ageGroupMap.entries()).sort(([aKey, aVal], [bKey, bVal]) => {
      if (aKey === '__all__') return 1;
      if (bKey === '__all__') return -1;
      return (aVal.ageGroup?.min_age || 0) - (bVal.ageGroup?.min_age || 0);
    });

    return sorted.map(([key, val]) => ({
      key,
      ...val,
      levels: Array.from(val.levels.entries())
        .sort(([aK, aV], [bK, bV]) => {
          if (aK === '__all__') return 1;
          if (bK === '__all__') return -1;
          return (aV.level?.level_order || 0) - (bV.level?.level_order || 0);
        })
        .map(([lk, lv]) => ({ key: lk, ...lv })),
    }));
  }, [filteredMaterials, ageGroups, levels]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDesc('');
    setFormAgeGroupId('all');
    setFormLevelId('all');
    setFormSubscription('all');
    setFormMode('all');
    setFormType('file');
    setFormLink('');
    setFormFile(null);
    setEditingMaterial(null);
  };

  const openEditDialog = (m: Material) => {
    setEditingMaterial(m);
    setFormTitle(m.title);
    setFormDesc(m.description || '');
    setFormAgeGroupId(m.age_group_id || 'all');
    setFormLevelId(m.level_id || 'all');
    setFormSubscription(m.subscription_type || 'all');
    setFormMode(m.attendance_mode || 'all');
    setFormType(m.material_type as 'file' | 'link');
    setFormLink(m.material_type === 'link' ? m.file_url : '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      toast({ title: isRTL ? 'العنوان مطلوب' : 'Title is required', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      let fileUrl = editingMaterial?.file_url || '';
      let fileType = editingMaterial?.file_type || 'other';
      let originalFilename = editingMaterial?.original_filename || null;

      if (formType === 'link') {
        if (!formLink.trim()) {
          toast({ title: isRTL ? 'الرابط مطلوب' : 'Link is required', variant: 'destructive' });
          setUploading(false);
          return;
        }
        fileUrl = formLink;
        fileType = 'link';
        originalFilename = null;
      } else if (formFile) {
        const ext = formFile.name.split('.').pop() || 'bin';
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('materials').upload(path, formFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('materials').getPublicUrl(path);
        fileUrl = urlData.publicUrl;
        fileType = getFileType(formFile);
        originalFilename = formFile.name;
      } else if (!editingMaterial) {
        toast({ title: isRTL ? 'اختر ملف أو أدخل رابط' : 'Select a file or enter a link', variant: 'destructive' });
        setUploading(false);
        return;
      }

      const record: Record<string, unknown> = {
        title: formTitle,
        title_ar: formTitle,
        description: formDesc || null,
        description_ar: formDesc || null,
        material_type: formType,
        file_url: fileUrl,
        file_type: fileType,
        original_filename: originalFilename,
        age_group_id: formAgeGroupId === 'all' ? null : formAgeGroupId,
        level_id: formLevelId === 'all' ? null : formLevelId,
        subscription_type: formSubscription === 'all' ? null : formSubscription,
        attendance_mode: formMode === 'all' ? null : formMode,
        is_active: true,
      };

      if (!editingMaterial) {
        record.uploaded_by = user?.id;
      }

      saveMutation.mutate(record);
    } catch (err: unknown) {
      toast({ title: isRTL ? 'خطأ في الرفع' : 'Upload error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const getAgeGroupLabel = (ag: AgeGroup | null) => {
    if (!ag) return isRTL ? 'كل الفئات العمرية' : 'All Age Groups';
    return isRTL ? ag.name_ar : ag.name;
  };

  const getLevelLabel = (lv: Level | null) => {
    if (!lv) return isRTL ? 'كل المستويات' : 'All Levels';
    return isRTL ? lv.name_ar : lv.name;
  };

  const getFileTypeIcon = (type: string) => {
    const Icon = FILE_TYPE_ICONS[type] || File;
    return <Icon className="h-5 w-5" />;
  };

  const getSubscriptionBadge = (type: string | null) => {
    if (!type) return null;
    const labels: Record<string, string> = { kojo_squad: 'Squad', kojo_core: 'Core', kojo_x: 'X' };
    return <Badge variant="secondary" className="text-xs">{labels[type] || type}</Badge>;
  };

  const getModeBadge = (mode: string | null) => {
    if (!mode) return null;
    return <Badge variant="outline" className="text-xs">{mode === 'online' ? (isRTL ? 'أونلاين' : 'Online') : (isRTL ? 'أوفلاين' : 'Offline')}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{isRTL ? 'المواد التعليمية' : 'Materials'}</h1>
            <p className="text-muted-foreground text-sm">
              {isRTL ? 'إدارة المواد التعليمية المنظمة حسب الفئة والمستوى' : 'Manage materials organized by age group and level'}
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 me-2" />{isRTL ? 'إضافة مادة' : 'Add Material'}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingMaterial ? (isRTL ? 'تعديل مادة' : 'Edit Material') : (isRTL ? 'إضافة مادة جديدة' : 'Add New Material')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>{isRTL ? 'العنوان' : 'Title'}</Label>
                  <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
                </div>
                <div>
                  <Label>{isRTL ? 'الوصف' : 'Description'}</Label>
                  <Textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={2} />
                </div>

                {/* Targeting */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{isRTL ? 'الفئة العمرية' : 'Age Group'}</Label>
                    <Select value={formAgeGroupId} onValueChange={setFormAgeGroupId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                        {ageGroups.map((ag) => (
                          <SelectItem key={ag.id} value={ag.id}>{isRTL ? ag.name_ar : ag.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{isRTL ? 'المستوى' : 'Level'}</Label>
                    <Select value={formLevelId} onValueChange={setFormLevelId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                        {levels.map((lv) => (
                          <SelectItem key={lv.id} value={lv.id}>{isRTL ? lv.name_ar : lv.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{isRTL ? 'الباقة' : 'Package'}</Label>
                    <Select value={formSubscription} onValueChange={setFormSubscription}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                        <SelectItem value="kojo_squad">Kojo Squad</SelectItem>
                        <SelectItem value="kojo_core">Kojo Core</SelectItem>
                        <SelectItem value="kojo_x">Kojo X</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{isRTL ? 'الوضع' : 'Mode'}</Label>
                    <Select value={formMode} onValueChange={setFormMode}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                        <SelectItem value="online">{isRTL ? 'أونلاين' : 'Online'}</SelectItem>
                        <SelectItem value="offline">{isRTL ? 'أوفلاين' : 'Offline'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Material Type */}
                <div>
                  <Label>{isRTL ? 'نوع المادة' : 'Material Type'}</Label>
                  <Select value={formType} onValueChange={(v) => setFormType(v as 'file' | 'link')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="file">{isRTL ? 'ملف' : 'File'}</SelectItem>
                      <SelectItem value="link">{isRTL ? 'رابط' : 'Link'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formType === 'link' ? (
                  <div>
                    <Label>{isRTL ? 'الرابط' : 'URL'}</Label>
                    <Input value={formLink} onChange={(e) => setFormLink(e.target.value)} placeholder="https://..." dir="ltr" />
                  </div>
                ) : (
                  <div>
                    <Label>{isRTL ? 'الملف (حتى 50MB)' : 'File (up to 50MB)'}</Label>
                    <div
                      className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                        formFile ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/30'
                      }`}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add('border-primary', 'bg-primary/10'); }}
                      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('border-primary', 'bg-primary/10'); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.classList.remove('border-primary', 'bg-primary/10');
                        const file = e.dataTransfer.files?.[0];
                        if (file) setFormFile(file);
                      }}
                      onClick={() => document.getElementById('material-file-input')?.click()}
                    >
                      <input
                        id="material-file-input"
                        type="file"
                        className="hidden"
                        onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                      />
                      {formFile ? (
                        <div className="flex items-center justify-center gap-2">
                          <FileText className="h-5 w-5 text-primary" />
                          <span className="text-sm font-medium">{formFile.name}</span>
                          <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setFormFile(null); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            {isRTL ? 'اسحب الملف هنا أو اضغط للاختيار' : 'Drag & drop a file here, or click to browse'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">{isRTL ? 'حتى 50 ميجابايت' : 'Up to 50MB'}</p>
                        </div>
                      )}
                    </div>
                    {editingMaterial && !formFile && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {isRTL ? 'الملف الحالي: ' : 'Current file: '}{editingMaterial.original_filename || 'file'}
                      </p>
                    )}
                  </div>
                )}

                <Button onClick={handleSave} disabled={uploading || saveMutation.isPending} className="w-full">
                  {uploading ? (isRTL ? 'جاري الرفع...' : 'Uploading...') : (isRTL ? 'حفظ' : 'Save')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRTL ? 'بحث بالاسم...' : 'Search by name...'}
              className="ps-10"
            />
          </div>
          <Select value={filterSubscription} onValueChange={setFilterSubscription}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder={isRTL ? 'الباقة' : 'Package'} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'كل الباقات' : 'All Packages'}</SelectItem>
              <SelectItem value="kojo_squad">Squad</SelectItem>
              <SelectItem value="kojo_core">Core</SelectItem>
              <SelectItem value="kojo_x">X</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterMode} onValueChange={setFilterMode}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder={isRTL ? 'الوضع' : 'Mode'} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
              <SelectItem value="online">{isRTL ? 'أونلاين' : 'Online'}</SelectItem>
              <SelectItem value="offline">{isRTL ? 'أوفلاين' : 'Offline'}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Hierarchical View */}
        {isLoading ? (
          <p className="text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
        ) : grouped.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{isRTL ? 'لا توجد مواد تعليمية بعد' : 'No materials yet'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map((agGroup) => (
              <Collapsible
                key={agGroup.key}
                open={openSections.has(agGroup.key)}
                onOpenChange={() => toggleSection(agGroup.key)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full p-4 hover:bg-accent/50 transition-colors rounded-t-lg text-start">
                      <div className="flex items-center gap-2">
                        {openSections.has(agGroup.key) ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        <span className="font-semibold text-lg">{getAgeGroupLabel(agGroup.ageGroup)}</span>
                        {agGroup.ageGroup && (
                          <Badge variant="outline" className="text-xs">
                            {agGroup.ageGroup.min_age}-{agGroup.ageGroup.max_age}
                          </Badge>
                        )}
                      </div>
                      <Badge>{agGroup.levels.reduce((sum, l) => sum + l.materials.length, 0)}</Badge>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-4">
                      {agGroup.levels.map((lvGroup) => (
                        <div key={lvGroup.key} className="border rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="font-medium text-sm text-muted-foreground">{getLevelLabel(lvGroup.level)}</span>
                            {lvGroup.level && <Badge variant="secondary" className="text-xs">#{lvGroup.level.level_order}</Badge>}
                            <Badge variant="outline" className="text-xs">{lvGroup.materials.length}</Badge>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {lvGroup.materials.map((m) => (
                              <Card key={m.id} className="group">
                                <CardContent className="p-3 flex items-start gap-3">
                                  <div className="shrink-0 mt-0.5 text-muted-foreground">{getFileTypeIcon(m.file_type)}</div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{isRTL ? m.title_ar : m.title}</p>
                                    {m.original_filename && (
                                      <p className="text-xs text-muted-foreground truncate">{m.original_filename}</p>
                                    )}
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {getSubscriptionBadge(m.subscription_type)}
                                      {getModeBadge(m.attendance_mode)}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {new Date(m.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US')}
                                    </p>
                                  </div>
                                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(m.file_url, '_blank')}>
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditDialog(m)}>
                                      <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(m.id)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
