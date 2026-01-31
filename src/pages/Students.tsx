import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

type SubscriptionType = 'kojo_squad' | 'kojo_core' | 'kojo_x';

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
  subscription_type: SubscriptionType | null;
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
  const navigate = useNavigate();
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
    subscription_type: '' as SubscriptionType | '',
  });

  const subscriptionTypes: { value: SubscriptionType; label: string; labelAr: string }[] = [
    { value: 'kojo_squad', label: 'Kojo Squad', labelAr: 'كوجو سكواد' },
    { value: 'kojo_core', label: 'Kojo Core', labelAr: 'كوجو كور' },
    { value: 'kojo_x', label: 'Kojo X', labelAr: 'كوجو اكس' },
  ];

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

  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
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
            subscription_type: formData.subscription_type || null,
          })
          .eq('id', editingStudent.id);

        if (error) throw error;
        toast({
          title: t.common.success,
          description: isRTL ? 'تم تحديث بيانات الطالب' : 'Student updated successfully',
        });
      } else {
        // Create new student via edge function
        if (!formData.email || !formData.password || !formData.full_name || !formData.subscription_type) {
          toast({
            variant: 'destructive',
            title: t.common.error,
            description: isRTL ? 'يرجى ملء جميع الحقول المطلوبة بما فيها نوع الاشتراك' : 'Please fill all required fields including subscription type',
          });
          setSaving(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            full_name_ar: formData.full_name_ar || undefined,
            phone: formData.phone || undefined,
            role: 'student',
            date_of_birth: formData.date_of_birth || undefined,
            age_group_id: formData.age_group_id || undefined,
            level_id: formData.level_id || undefined,
            subscription_type: formData.subscription_type || undefined,
          }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast({
          title: t.common.success,
          description: isRTL ? 'تم إنشاء الطالب بنجاح' : 'Student created successfully',
        });
      }

      setIsDialogOpen(false);
      setEditingStudent(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving student:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: error.message || (isRTL ? 'فشل في حفظ بيانات الطالب' : 'Failed to save student'),
      });
    } finally {
      setSaving(false);
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
      subscription_type: '',
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
      subscription_type: student.subscription_type || '',
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

  const getSubscriptionTypeName = (type: SubscriptionType | null) => {
    if (!type) return '-';
    const found = subscriptionTypes.find((t) => t.value === type);
    return found ? (language === 'ar' ? found.labelAr : found.label) : '-';
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
              <div className="grid gap-2">
                <Label>{isRTL ? 'نوع الاشتراك' : 'Subscription Type'} *</Label>
                <Select
                  value={formData.subscription_type}
                  onValueChange={(value) => setFormData({ ...formData, subscription_type: value as SubscriptionType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? 'اختر نوع الاشتراك' : 'Select subscription type'} />
                  </SelectTrigger>
                  <SelectContent>
                    {subscriptionTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {language === 'ar' ? type.labelAr : type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
                {t.common.cancel}
              </Button>
              <Button className="kojo-gradient" onClick={handleSubmit} disabled={saving}>
                {saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : t.common.save}
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
                  <TableHead>{isRTL ? 'الاشتراك' : 'Subscription'}</TableHead>
                  <TableHead className="w-[100px]">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      {t.common.loading}
                    </TableCell>
                  </TableRow>
                ) : filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                        <Badge variant="secondary">
                          {getSubscriptionTypeName(student.subscription_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                            <DropdownMenuItem onClick={() => navigate(`/student/${student.user_id}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              {isRTL ? 'عرض الملف' : 'View Profile'}
                            </DropdownMenuItem>
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
