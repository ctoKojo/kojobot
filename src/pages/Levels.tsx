import { useState, useEffect } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Level {
  id: string;
  name: string;
  name_ar: string;
  level_order: number;
  track: string | null;
  parent_level_id: string | null;
  is_active: boolean;
}

export default function LevelsPage() {
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<Level | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    level_order: 0,
    track: '',
    parent_level_id: '',
  });

  useEffect(() => {
    fetchLevels();
  }, []);

  const fetchLevels = async () => {
    try {
      const { data, error } = await supabase
        .from('levels')
        .select('*')
        .order('level_order', { ascending: true });

      if (error) throw error;
      setLevels(data || []);
    } catch (error) {
      console.error('Error fetching levels:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في تحميل المستويات' : 'Failed to load levels',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        name: formData.name,
        name_ar: formData.name,
        level_order: formData.level_order,
        track: formData.track || null,
        parent_level_id: formData.parent_level_id || null,
      };

      if (editingLevel) {
        const { error } = await supabase
          .from('levels')
          .update(payload)
          .eq('id', editingLevel.id);

        if (error) throw error;
        toast({
          title: t.common.success,
          description: isRTL ? 'تم تحديث المستوى' : 'Level updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('levels')
          .insert([payload]);

        if (error) throw error;
        toast({
          title: t.common.success,
          description: isRTL ? 'تم إضافة المستوى' : 'Level added successfully',
        });
      }

      setIsDialogOpen(false);
      setEditingLevel(null);
      setFormData({ name: '', level_order: 0, track: '', parent_level_id: '' });
      fetchLevels();
    } catch (error) {
      console.error('Error saving level:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في حفظ المستوى' : 'Failed to save level',
      });
    }
  };

  const handleEdit = (level: Level) => {
    setEditingLevel(level);
    setFormData({
      name: level.name,
      level_order: level.level_order,
      track: level.track || '',
      parent_level_id: level.parent_level_id || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('levels')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({
        title: t.common.success,
        description: isRTL ? 'تم حذف المستوى' : 'Level deleted successfully',
      });
      fetchLevels();
    } catch (error) {
      console.error('Error deleting level:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في حذف المستوى' : 'Failed to delete level',
      });
    }
  };

  const filteredLevels = levels.filter((level) =>
    level.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    level.name_ar.includes(searchQuery)
  );

  const getParentLevelName = (parentId: string | null) => {
    if (!parentId) return '-';
    const parent = levels.find((l) => l.id === parentId);
    return parent ? (language === 'ar' ? parent.name_ar : parent.name) : '-';
  };

  const getTrackBadge = (track: string | null) => {
    if (!track) return null;
    const colors: Record<string, string> = {
      software: 'bg-blue-100 text-blue-800',
      hardware: 'bg-orange-100 text-orange-800',
    };
    return (
      <Badge className={colors[track] || 'bg-gray-100 text-gray-800'}>
        {track === 'software' ? t.levels.software : t.levels.hardware}
      </Badge>
    );
  };

  return (
    <DashboardLayout title={t.levels.title}>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.common.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="kojo-gradient" onClick={() => {
                setEditingLevel(null);
                setFormData({ name: '', level_order: levels.length, track: '', parent_level_id: '' });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                {t.levels.addLevel}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingLevel ? t.levels.editLevel : t.levels.addLevel}
                </DialogTitle>
                <DialogDescription>
                  {isRTL ? 'أدخل بيانات المستوى التعليمي' : 'Enter level details'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">{isRTL ? 'الاسم' : 'Name'}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={isRTL ? 'مثال: المستوى 2 سوفتوير' : 'e.g., Level 2 Software'}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="level_order">{isRTL ? 'ترتيب المستوى' : 'Level Order'}</Label>
                  <Input
                    id="level_order"
                    type="number"
                    value={formData.level_order}
                    onChange={(e) => setFormData({ ...formData, level_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="track">{t.levels.track}</Label>
                  <Select
                    value={formData.track}
                    onValueChange={(value) => setFormData({ ...formData, track: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isRTL ? 'اختر المسار' : 'Select track'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{isRTL ? 'بدون مسار' : 'No track'}</SelectItem>
                      <SelectItem value="software">{t.levels.software}</SelectItem>
                      <SelectItem value="hardware">{t.levels.hardware}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="parent">{t.levels.parentLevel}</Label>
                  <Select
                    value={formData.parent_level_id}
                    onValueChange={(value) => setFormData({ ...formData, parent_level_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isRTL ? 'اختر المستوى الأب' : 'Select parent level'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{isRTL ? 'بدون مستوى أب' : 'No parent'}</SelectItem>
                      {levels.filter(l => l.id !== editingLevel?.id).map((level) => (
                        <SelectItem key={level.id} value={level.id}>
                          {language === 'ar' ? level.name_ar : level.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t.common.cancel}
                </Button>
                <Button className="kojo-gradient" onClick={handleSubmit}>
                  {t.common.save}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? 'الترتيب' : 'Order'}</TableHead>
                  <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                  <TableHead>{t.levels.track}</TableHead>
                  <TableHead>{t.levels.parentLevel}</TableHead>
                  <TableHead className="w-[100px]">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      {t.common.loading}
                    </TableCell>
                  </TableRow>
                ) : filteredLevels.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {isRTL ? 'لا توجد مستويات' : 'No levels found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLevels.map((level) => (
                    <TableRow key={level.id}>
                      <TableCell>{level.level_order}</TableCell>
                      <TableCell className="font-medium">
                        {language === 'ar' ? level.name_ar : level.name}
                      </TableCell>
                      <TableCell>{getTrackBadge(level.track)}</TableCell>
                      <TableCell>{getParentLevelName(level.parent_level_id)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                            <DropdownMenuItem onClick={() => handleEdit(level)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              {t.common.edit}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(level.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t.common.delete}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
