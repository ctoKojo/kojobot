import { useState, useEffect } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Users } from 'lucide-react';
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

interface Group {
  id: string;
  name: string;
  name_ar: string;
  age_group_id: string | null;
  level_id: string | null;
  instructor_id: string;
  schedule_day: string;
  schedule_time: string;
  duration_minutes: number;
  is_active: boolean;
}

interface AgeGroup {
  id: string;
  name: string;
  name_ar: string;
}

interface Level {
  id: string;
  name: string;
  name_ar: string;
}

interface Instructor {
  user_id: string;
  full_name: string;
  full_name_ar: string | null;
}

export default function GroupsPage() {
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    name_ar: '',
    age_group_id: '',
    level_id: '',
    instructor_id: '',
    schedule_day: '',
    schedule_time: '',
    duration_minutes: 60,
  });

  const days = [
    { en: 'Sunday', ar: 'الأحد' },
    { en: 'Monday', ar: 'الاثنين' },
    { en: 'Tuesday', ar: 'الثلاثاء' },
    { en: 'Wednesday', ar: 'الأربعاء' },
    { en: 'Thursday', ar: 'الخميس' },
    { en: 'Friday', ar: 'الجمعة' },
    { en: 'Saturday', ar: 'السبت' },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [groupsRes, ageGroupsRes, levelsRes, instructorRolesRes] = await Promise.all([
        supabase.from('groups').select('*').order('name'),
        supabase.from('age_groups').select('id, name, name_ar').eq('is_active', true),
        supabase.from('levels').select('id, name, name_ar').eq('is_active', true),
        supabase.from('user_roles').select('user_id').eq('role', 'instructor'),
      ]);

      setGroups(groupsRes.data || []);
      setAgeGroups(ageGroupsRes.data || []);
      setLevels(levelsRes.data || []);

      // Fetch instructor profiles
      const instructorIds = instructorRolesRes.data?.map((r) => r.user_id) || [];
      if (instructorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, full_name_ar')
          .in('user_id', instructorIds);
        setInstructors(profilesData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        name: formData.name,
        name_ar: formData.name_ar,
        age_group_id: formData.age_group_id || null,
        level_id: formData.level_id || null,
        instructor_id: formData.instructor_id,
        schedule_day: formData.schedule_day,
        schedule_time: formData.schedule_time,
        duration_minutes: formData.duration_minutes,
      };

      if (editingGroup) {
        const { error } = await supabase
          .from('groups')
          .update(payload)
          .eq('id', editingGroup.id);

        if (error) throw error;
        toast({
          title: t.common.success,
          description: isRTL ? 'تم تحديث المجموعة' : 'Group updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('groups')
          .insert([payload]);

        if (error) throw error;
        toast({
          title: t.common.success,
          description: isRTL ? 'تم إضافة المجموعة' : 'Group added successfully',
        });
      }

      setIsDialogOpen(false);
      setEditingGroup(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving group:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في حفظ المجموعة' : 'Failed to save group',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      name_ar: '',
      age_group_id: '',
      level_id: '',
      instructor_id: '',
      schedule_day: '',
      schedule_time: '',
      duration_minutes: 60,
    });
  };

  const handleEdit = (group: Group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      name_ar: group.name_ar,
      age_group_id: group.age_group_id || '',
      level_id: group.level_id || '',
      instructor_id: group.instructor_id,
      schedule_day: group.schedule_day,
      schedule_time: group.schedule_time,
      duration_minutes: group.duration_minutes,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('groups').delete().eq('id', id);
      if (error) throw error;
      toast({
        title: t.common.success,
        description: isRTL ? 'تم حذف المجموعة' : 'Group deleted successfully',
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في حذف المجموعة' : 'Failed to delete group',
      });
    }
  };

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.name_ar.includes(searchQuery)
  );

  const getInstructorName = (id: string) => {
    const instructor = instructors.find((i) => i.user_id === id);
    if (!instructor) return '-';
    return language === 'ar' && instructor.full_name_ar 
      ? instructor.full_name_ar 
      : instructor.full_name;
  };

  const getAgeGroupName = (id: string | null) => {
    if (!id) return '-';
    const group = ageGroups.find((g) => g.id === id);
    return group ? (language === 'ar' ? group.name_ar : group.name) : '-';
  };

  const getLevelName = (id: string | null) => {
    if (!id) return '-';
    const level = levels.find((l) => l.id === id);
    return level ? (language === 'ar' ? level.name_ar : level.name) : '-';
  };

  const getDayName = (day: string) => {
    const found = days.find((d) => d.en === day);
    return found ? (language === 'ar' ? found.ar : found.en) : day;
  };

  return (
    <DashboardLayout title={t.groups.title}>
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

          <Button className="kojo-gradient" onClick={() => {
            setEditingGroup(null);
            resetForm();
            setIsDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            {t.groups.addGroup}
          </Button>
        </div>

        {/* Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingGroup ? t.groups.editGroup : t.groups.addGroup}
              </DialogTitle>
              <DialogDescription>
                {isRTL ? 'أدخل بيانات المجموعة' : 'Enter group details'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid gap-2">
                <Label>{t.groups.groupName} (English)</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Monday Juniors"
                />
              </div>
              <div className="grid gap-2">
                <Label>{t.groups.groupName} (عربي)</Label>
                <Input
                  value={formData.name_ar}
                  onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                  placeholder="مثال: مجموعة الاثنين"
                  dir="rtl"
                />
              </div>
              <div className="grid gap-2">
                <Label>{t.groups.instructor}</Label>
                <Select
                  value={formData.instructor_id}
                  onValueChange={(value) => setFormData({ ...formData, instructor_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? 'اختر المدرب' : 'Select instructor'} />
                  </SelectTrigger>
                  <SelectContent>
                    {instructors.map((instructor) => (
                      <SelectItem key={instructor.user_id} value={instructor.user_id}>
                        {language === 'ar' && instructor.full_name_ar 
                          ? instructor.full_name_ar 
                          : instructor.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{t.students.ageGroup}</Label>
                  <Select
                    value={formData.age_group_id}
                    onValueChange={(value) => setFormData({ ...formData, age_group_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isRTL ? 'اختر' : 'Select'} />
                    </SelectTrigger>
                    <SelectContent>
                      {ageGroups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {language === 'ar' ? group.name_ar : group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{t.students.level}</Label>
                  <Select
                    value={formData.level_id}
                    onValueChange={(value) => setFormData({ ...formData, level_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isRTL ? 'اختر' : 'Select'} />
                    </SelectTrigger>
                    <SelectContent>
                      {levels.map((level) => (
                        <SelectItem key={level.id} value={level.id}>
                          {language === 'ar' ? level.name_ar : level.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{t.groups.schedule}</Label>
                  <Select
                    value={formData.schedule_day}
                    onValueChange={(value) => setFormData({ ...formData, schedule_day: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isRTL ? 'اليوم' : 'Day'} />
                    </SelectTrigger>
                    <SelectContent>
                      {days.map((day) => (
                        <SelectItem key={day.en} value={day.en}>
                          {language === 'ar' ? day.ar : day.en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{isRTL ? 'الوقت' : 'Time'}</Label>
                  <Input
                    type="time"
                    value={formData.schedule_time}
                    onChange={(e) => setFormData({ ...formData, schedule_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>{t.groups.duration} ({isRTL ? 'دقيقة' : 'minutes'})</Label>
                <Input
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 60 })}
                />
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

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.groups.groupName}</TableHead>
                  <TableHead>{t.groups.instructor}</TableHead>
                  <TableHead>{t.groups.schedule}</TableHead>
                  <TableHead>{t.students.level}</TableHead>
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
                ) : filteredGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {isRTL ? 'لا توجد مجموعات' : 'No groups found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGroups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell className="font-medium">
                        {language === 'ar' ? group.name_ar : group.name}
                      </TableCell>
                      <TableCell>{getInstructorName(group.instructor_id)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getDayName(group.schedule_day)} - {group.schedule_time}
                        </Badge>
                      </TableCell>
                      <TableCell>{getLevelName(group.level_id)}</TableCell>
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
