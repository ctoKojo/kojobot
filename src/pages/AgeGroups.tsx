import { useState, useEffect } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Eye } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AgeGroup {
  id: string;
  name: string;
  name_ar: string;
  min_age: number;
  max_age: number;
  is_active: boolean;
}

export default function AgeGroupsPage() {
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AgeGroup | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    name_ar: '',
    min_age: 0,
    max_age: 0,
  });

  useEffect(() => {
    fetchAgeGroups();
  }, []);

  const fetchAgeGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('age_groups')
        .select('*')
        .order('min_age', { ascending: true });

      if (error) throw error;
      setAgeGroups(data || []);
    } catch (error) {
      console.error('Error fetching age groups:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في تحميل الفئات العمرية' : 'Failed to load age groups',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (editingGroup) {
        const { error } = await supabase
          .from('age_groups')
          .update(formData)
          .eq('id', editingGroup.id);

        if (error) throw error;
        toast({
          title: t.common.success,
          description: isRTL ? 'تم تحديث الفئة العمرية' : 'Age group updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('age_groups')
          .insert([formData]);

        if (error) throw error;
        toast({
          title: t.common.success,
          description: isRTL ? 'تم إضافة الفئة العمرية' : 'Age group added successfully',
        });
      }

      setIsDialogOpen(false);
      setEditingGroup(null);
      setFormData({ name: '', name_ar: '', min_age: 0, max_age: 0 });
      fetchAgeGroups();
    } catch (error) {
      console.error('Error saving age group:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في حفظ الفئة العمرية' : 'Failed to save age group',
      });
    }
  };

  const handleEdit = (group: AgeGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      name_ar: group.name_ar,
      min_age: group.min_age,
      max_age: group.max_age,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('age_groups')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({
        title: t.common.success,
        description: isRTL ? 'تم حذف الفئة العمرية' : 'Age group deleted successfully',
      });
      fetchAgeGroups();
    } catch (error) {
      console.error('Error deleting age group:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في حذف الفئة العمرية' : 'Failed to delete age group',
      });
    }
  };

  const filteredGroups = ageGroups.filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.name_ar.includes(searchQuery)
  );

  return (
    <DashboardLayout title={t.ageGroups.title}>
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
                setEditingGroup(null);
                setFormData({ name: '', name_ar: '', min_age: 0, max_age: 0 });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                {t.ageGroups.addAgeGroup}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingGroup ? t.ageGroups.editAgeGroup : t.ageGroups.addAgeGroup}
                </DialogTitle>
                <DialogDescription>
                  {isRTL ? 'أدخل بيانات الفئة العمرية' : 'Enter age group details'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name (English)</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., 6-9 Years"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name_ar">الاسم (عربي)</Label>
                  <Input
                    id="name_ar"
                    value={formData.name_ar}
                    onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                    placeholder="مثال: 6-9 سنوات"
                    dir="rtl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="min_age">{t.ageGroups.minAge}</Label>
                    <Input
                      id="min_age"
                      type="number"
                      value={formData.min_age}
                      onChange={(e) => setFormData({ ...formData, min_age: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="max_age">{t.ageGroups.maxAge}</Label>
                    <Input
                      id="max_age"
                      type="number"
                      value={formData.max_age}
                      onChange={(e) => setFormData({ ...formData, max_age: parseInt(e.target.value) || 0 })}
                    />
                  </div>
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
                  <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                  <TableHead>{t.ageGroups.minAge}</TableHead>
                  <TableHead>{t.ageGroups.maxAge}</TableHead>
                  <TableHead className="w-[100px]">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      {t.common.loading}
                    </TableCell>
                  </TableRow>
                ) : filteredGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {isRTL ? 'لا توجد فئات عمرية' : 'No age groups found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGroups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell className="font-medium">
                        {language === 'ar' ? group.name_ar : group.name}
                      </TableCell>
                      <TableCell>{group.min_age}</TableCell>
                      <TableCell>{group.max_age}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                            <DropdownMenuItem onClick={() => handleEdit(group)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              {t.common.edit}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(group.id)}
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
