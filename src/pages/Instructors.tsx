import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, UserPlus, Eye } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Instructor {
  id: string;
  user_id: string;
  full_name: string;
  full_name_ar: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  specialization: string | null;
  specialization_ar: string | null;
}

export default function InstructorsPage() {
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    full_name_ar: '',
    email: '',
    phone: '',
    specialization: '',
    specialization_ar: '',
    password: '',
  });

  useEffect(() => {
    fetchInstructors();
  }, []);

  const fetchInstructors = async () => {
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'instructor');

      if (rolesError) throw rolesError;

      const instructorUserIds = rolesData?.map((r) => r.user_id) || [];

      if (instructorUserIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', instructorUserIds);

        if (profilesError) throw profilesError;
        setInstructors(profilesData || []);
      } else {
        setInstructors([]);
      }
    } catch (error) {
      console.error('Error fetching instructors:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في تحميل المدربين' : 'Failed to load instructors',
      });
    } finally {
      setLoading(false);
    }
  };

  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      if (editingInstructor) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            full_name_ar: formData.full_name_ar || null,
            phone: formData.phone || null,
            specialization: formData.specialization || null,
            specialization_ar: formData.specialization_ar || null,
          })
          .eq('id', editingInstructor.id);

        if (error) throw error;
        toast({
          title: t.common.success,
          description: isRTL ? 'تم تحديث بيانات المدرب' : 'Instructor updated successfully',
        });
      } else {
        // Create new instructor via edge function
        if (!formData.email || !formData.password || !formData.full_name) {
          toast({
            variant: 'destructive',
            title: t.common.error,
            description: isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields',
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
            role: 'instructor',
            specialization: formData.specialization || undefined,
            specialization_ar: formData.specialization_ar || undefined,
          }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast({
          title: t.common.success,
          description: isRTL ? 'تم إنشاء المدرب بنجاح' : 'Instructor created successfully',
        });
      }

      setIsDialogOpen(false);
      setEditingInstructor(null);
      resetForm();
      fetchInstructors();
    } catch (error: any) {
      console.error('Error saving instructor:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: error.message || (isRTL ? 'فشل في حفظ بيانات المدرب' : 'Failed to save instructor'),
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
      specialization: '',
      specialization_ar: '',
      password: '',
    });
  };

  const handleEdit = (instructor: Instructor) => {
    setEditingInstructor(instructor);
    setFormData({
      full_name: instructor.full_name,
      full_name_ar: instructor.full_name_ar || '',
      email: instructor.email,
      phone: instructor.phone || '',
      specialization: instructor.specialization || '',
      specialization_ar: instructor.specialization_ar || '',
      password: '',
    });
    setIsDialogOpen(true);
  };

  const filteredInstructors = instructors.filter((instructor) =>
    instructor.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (instructor.full_name_ar && instructor.full_name_ar.includes(searchQuery)) ||
    instructor.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout title={t.instructors.title}>
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
            setEditingInstructor(null);
            resetForm();
            setIsDialogOpen(true);
          }}>
            <UserPlus className="h-4 w-4 mr-2" />
            {t.instructors.addInstructor}
          </Button>
        </div>

        {/* Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingInstructor ? t.instructors.editInstructor : t.instructors.addInstructor}
              </DialogTitle>
              <DialogDescription>
                {isRTL ? 'أدخل بيانات المدرب' : 'Enter instructor details'}
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
              {!editingInstructor && (
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
                <Label htmlFor="specialization">{t.instructors.specializations} (English)</Label>
                <Input
                  id="specialization"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                  placeholder="e.g., Python, Scratch"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="specialization_ar">{t.instructors.specializations} (عربي)</Label>
                <Input
                  id="specialization_ar"
                  value={formData.specialization_ar}
                  onChange={(e) => setFormData({ ...formData, specialization_ar: e.target.value })}
                  placeholder="مثال: بايثون، سكراتش"
                  dir="rtl"
                />
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
                  <TableHead>{t.instructors.specializations}</TableHead>
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
                ) : filteredInstructors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {isRTL ? 'لا يوجد مدربين' : 'No instructors found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInstructors.map((instructor) => (
                    <TableRow key={instructor.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={instructor.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {instructor.full_name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {language === 'ar' && instructor.full_name_ar 
                              ? instructor.full_name_ar 
                              : instructor.full_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{instructor.email}</TableCell>
                      <TableCell>
                        {instructor.specialization ? (
                          <Badge variant="secondary">
                            {language === 'ar' && instructor.specialization_ar 
                              ? instructor.specialization_ar 
                              : instructor.specialization}
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                            <DropdownMenuItem onClick={() => navigate(`/instructor/${instructor.user_id}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              {isRTL ? 'عرض الملف' : 'View Profile'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(instructor)}>
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
