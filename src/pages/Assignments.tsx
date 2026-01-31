import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, ClipboardList, Upload, Eye } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Assignment {
  id: string;
  title: string;
  title_ar: string;
  description: string | null;
  description_ar: string | null;
  group_id: string | null;
  student_id: string | null;
  assigned_by: string;
  due_date: string;
  max_score: number | null;
  attachment_url: string | null;
  attachment_type: string | null;
  is_active: boolean | null;
  created_at: string;
}

interface Group {
  id: string;
  name: string;
  name_ar: string;
}

export default function AssignmentsPage() {
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    title_ar: '',
    description: '',
    description_ar: '',
    group_id: '',
    due_date: '',
    max_score: 100,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [assignmentsRes, groupsRes] = await Promise.all([
        supabase.from('assignments').select('*').order('created_at', { ascending: false }),
        supabase.from('groups').select('id, name, name_ar').eq('is_active', true),
      ]);

      setAssignments(assignmentsRes.data || []);
      setGroups(groupsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    try {
      const payload = {
        title: formData.title,
        title_ar: formData.title_ar,
        description: formData.description || null,
        description_ar: formData.description_ar || null,
        group_id: formData.group_id || null,
        due_date: formData.due_date,
        max_score: formData.max_score,
        assigned_by: user.id,
      };

      if (editingAssignment) {
        const { error } = await supabase
          .from('assignments')
          .update(payload)
          .eq('id', editingAssignment.id);

        if (error) throw error;
        toast({
          title: t.common.success,
          description: isRTL ? 'تم تحديث الاساينمنت' : 'Assignment updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('assignments')
          .insert([payload]);

        if (error) throw error;
        toast({
          title: t.common.success,
          description: isRTL ? 'تم إضافة الاساينمنت' : 'Assignment added successfully',
        });
      }

      setIsDialogOpen(false);
      setEditingAssignment(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving assignment:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في حفظ الاساينمنت' : 'Failed to save assignment',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      title_ar: '',
      description: '',
      description_ar: '',
      group_id: '',
      due_date: '',
      max_score: 100,
    });
  };

  const handleEdit = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setFormData({
      title: assignment.title,
      title_ar: assignment.title_ar,
      description: assignment.description || '',
      description_ar: assignment.description_ar || '',
      group_id: assignment.group_id || '',
      due_date: assignment.due_date ? new Date(assignment.due_date).toISOString().slice(0, 16) : '',
      max_score: assignment.max_score || 100,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('assignments').delete().eq('id', id);
      if (error) throw error;
      toast({
        title: t.common.success,
        description: isRTL ? 'تم حذف الاساينمنت' : 'Assignment deleted successfully',
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في حذف الاساينمنت' : 'Failed to delete assignment',
      });
    }
  };

  const filteredAssignments = assignments.filter((assignment) =>
    assignment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    assignment.title_ar.includes(searchQuery)
  );

  const getGroupName = (id: string | null) => {
    if (!id) return isRTL ? 'الكل' : 'All';
    const group = groups.find((g) => g.id === id);
    return group ? (language === 'ar' ? group.name_ar : group.name) : '-';
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  const canManage = role === 'admin' || role === 'instructor';

  return (
    <DashboardLayout title={t.assignments.title}>
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

          {canManage && (
            <Button className="kojo-gradient" onClick={() => {
              setEditingAssignment(null);
              resetForm();
              setIsDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              {t.assignments.addAssignment}
            </Button>
          )}
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingAssignment ? t.assignments.editAssignment : t.assignments.addAssignment}
              </DialogTitle>
              <DialogDescription>
                {isRTL ? 'أدخل بيانات الاساينمنت' : 'Enter assignment details'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid gap-2">
                <Label>{t.assignments.assignmentName} (English)</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Create a Scratch Game"
                />
              </div>
              <div className="grid gap-2">
                <Label>{t.assignments.assignmentName} (عربي)</Label>
                <Input
                  value={formData.title_ar}
                  onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                  placeholder="مثال: إنشاء لعبة سكراتش"
                  dir="rtl"
                />
              </div>
              <div className="grid gap-2">
                <Label>{t.assignments.description} (English)</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Assignment instructions..."
                />
              </div>
              <div className="grid gap-2">
                <Label>{t.assignments.description} (عربي)</Label>
                <Textarea
                  value={formData.description_ar}
                  onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                  placeholder="تعليمات الاساينمنت..."
                  dir="rtl"
                />
              </div>
              <div className="grid gap-2">
                <Label>{t.students.group}</Label>
                <Select
                  value={formData.group_id}
                  onValueChange={(value) => setFormData({ ...formData, group_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? 'اختر مجموعة' : 'Select group'} />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {language === 'ar' ? group.name_ar : group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{t.assignments.dueDate}</Label>
                  <Input
                    type="datetime-local"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{isRTL ? 'الدرجة القصوى' : 'Max Score'}</Label>
                  <Input
                    type="number"
                    value={formData.max_score}
                    onChange={(e) => setFormData({ ...formData, max_score: parseInt(e.target.value) || 100 })}
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

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.assignments.assignmentName}</TableHead>
                  <TableHead>{t.students.group}</TableHead>
                  <TableHead>{t.assignments.dueDate}</TableHead>
                  <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
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
                ) : filteredAssignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        {isRTL ? 'لا توجد اساينمنتات' : 'No assignments found'}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAssignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">
                        {language === 'ar' ? assignment.title_ar : assignment.title}
                      </TableCell>
                      <TableCell>{getGroupName(assignment.group_id)}</TableCell>
                      <TableCell>{formatDate(assignment.due_date)}</TableCell>
                      <TableCell>
                        {isOverdue(assignment.due_date) ? (
                          <Badge variant="destructive">
                            {isRTL ? 'منتهي' : 'Overdue'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-100 text-green-800">
                            {isRTL ? 'نشط' : 'Active'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                            <DropdownMenuItem onClick={() => navigate(`/assignment-submissions/${assignment.id}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              {isRTL ? 'عرض التسليمات' : 'View Submissions'}
                            </DropdownMenuItem>
                            {canManage && (
                              <>
                                <DropdownMenuItem onClick={() => handleEdit(assignment)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  {t.common.edit}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDelete(assignment.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {t.common.delete}
                                </DropdownMenuItem>
                              </>
                            )}
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
