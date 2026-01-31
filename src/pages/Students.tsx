import { useState, useEffect } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Eye, UserPlus } from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Student {
  id: string;
  user_id: string;
  full_name: string;
  full_name_ar: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  age_group_id: string | null;
  level_id: string | null;
  date_of_birth: string | null;
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

export default function StudentsPage() {
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    full_name_ar: '',
    email: '',
    phone: '',
    date_of_birth: '',
    age_group_id: '',
    level_id: '',
    password: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch students with role 'student'
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');

      if (rolesError) throw rolesError;

      const studentUserIds = rolesData?.map((r) => r.user_id) || [];

      if (studentUserIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', studentUserIds);

        if (profilesError) throw profilesError;
        setStudents(profilesData || []);
      } else {
        setStudents([]);
      }

      // Fetch age groups
      const { data: ageGroupsData } = await supabase
        .from('age_groups')
        .select('id, name, name_ar')
        .eq('is_active', true);
      setAgeGroups(ageGroupsData || []);

      // Fetch levels
      const { data: levelsData } = await supabase
        .from('levels')
        .select('id, name, name_ar')
        .eq('is_active', true);
      setLevels(levelsData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في تحميل البيانات' : 'Failed to load data',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (editingStudent) {
        // Update existing student profile
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            full_name_ar: formData.full_name_ar || null,
            phone: formData.phone || null,
            date_of_birth: formData.date_of_birth || null,
            age_group_id: formData.age_group_id || null,
            level_id: formData.level_id || null,
          })
          .eq('id', editingStudent.id);

        if (error) throw error;
        toast({
          title: t.common.success,
          description: isRTL ? 'تم تحديث بيانات الطالب' : 'Student updated successfully',
        });
      } else {
        // Create new student - this requires admin API in production
        // For now, we'll show a message
        toast({
          title: t.common.info,
          description: isRTL 
            ? 'لإنشاء طالب جديد، استخدم Cloud Dashboard' 
            : 'To create a new student, use the Cloud Dashboard',
        });
        setIsDialogOpen(false);
        return;
      }

      setIsDialogOpen(false);
      setEditingStudent(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving student:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في حفظ بيانات الطالب' : 'Failed to save student',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      full_name_ar: '',
      email: '',
      phone: '',
      date_of_birth: '',
      age_group_id: '',
      level_id: '',
      password: '',
    });
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      full_name: student.full_name,
      full_name_ar: student.full_name_ar || '',
      email: student.email,
      phone: student.phone || '',
      date_of_birth: student.date_of_birth || '',
      age_group_id: student.age_group_id || '',
      level_id: student.level_id || '',
      password: '',
    });
    setIsDialogOpen(true);
  };

  const filteredStudents = students.filter((student) =>
    student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (student.full_name_ar && student.full_name_ar.includes(searchQuery)) ||
    student.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  return (
    <DashboardLayout title={t.students.title}>
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
            setEditingStudent(null);
            resetForm();
            setIsDialogOpen(true);
          }}>
            <UserPlus className="h-4 w-4 mr-2" />
            {t.students.addStudent}
          </Button>
        </div>

        {/* Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingStudent ? t.students.editStudent : t.students.addStudent}
              </DialogTitle>
              <DialogDescription>
                {isRTL ? 'أدخل بيانات الطالب' : 'Enter student details'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid gap-2">
                <Label htmlFor="full_name">{t.students.fullName} (English)</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="full_name_ar">{t.students.fullName} (عربي)</Label>
                <Input
                  id="full_name_ar"
                  value={formData.full_name_ar}
                  onChange={(e) => setFormData({ ...formData, full_name_ar: e.target.value })}
                  dir="rtl"
                />
              </div>
              {!editingStudent && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="email">{t.auth.email}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">{t.auth.password}</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                </>
              )}
              <div className="grid gap-2">
                <Label htmlFor="phone">{isRTL ? 'رقم الهاتف' : 'Phone'}</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dob">{isRTL ? 'تاريخ الميلاد' : 'Date of Birth'}</Label>
                <Input
                  id="dob"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t.students.ageGroup}</Label>
                <Select
                  value={formData.age_group_id}
                  onValueChange={(value) => setFormData({ ...formData, age_group_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? 'اختر الفئة العمرية' : 'Select age group'} />
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
                    <SelectValue placeholder={isRTL ? 'اختر المستوى' : 'Select level'} />
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
                  <TableHead>{t.students.fullName}</TableHead>
                  <TableHead>{t.auth.email}</TableHead>
                  <TableHead>{t.students.ageGroup}</TableHead>
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
                ) : filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {isRTL ? 'لا يوجد طلاب' : 'No students found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={student.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {student.full_name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {language === 'ar' && student.full_name_ar 
                              ? student.full_name_ar 
                              : student.full_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{student.email}</TableCell>
                      <TableCell>{getAgeGroupName(student.age_group_id)}</TableCell>
                      <TableCell>{getLevelName(student.level_id)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                            <DropdownMenuItem onClick={() => handleEdit(student)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              {t.common.edit}
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
