import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, ClipboardList, Upload, Eye, FileText, Image, Video, X, CheckCircle } from 'lucide-react';
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
  const [studentSubmissions, setStudentSubmissions] = useState<Map<string, { status: string; score: number | null }>>(new Map());
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
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // Fetch student submissions if role is student
      if (role === 'student' && user) {
        const { data: submissionsData } = await supabase
          .from('assignment_submissions')
          .select('assignment_id, status, score')
          .eq('student_id', user.id);

        if (submissionsData) {
          const submissionsMap = new Map<string, { status: string; score: number | null }>();
          submissionsData.forEach(sub => {
            submissionsMap.set(sub.assignment_id, { status: sub.status, score: sub.score });
          });
          setStudentSubmissions(submissionsMap);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSubmissionStatus = (assignmentId: string) => {
    return studentSubmissions.get(assignmentId);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 50 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: t.common.error,
          description: isRTL ? 'حجم الملف يجب أن يكون أقل من 50MB' : 'File size must be less than 50MB',
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const getFileIcon = (type: string | null) => {
    if (!type) return <FileText className="w-6 h-6" />;
    if (type.startsWith('image')) return <Image className="w-6 h-6" />;
    if (type.startsWith('video')) return <Video className="w-6 h-6" />;
    return <FileText className="w-6 h-6" />;
  };

  const handleSubmit = async () => {
    if (!user) return;
    setUploading(true);

    try {
      let attachmentUrl = editingAssignment?.attachment_url || null;
      let attachmentType = editingAssignment?.attachment_type || null;

      // Upload file if exists
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `instructor/${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('assignments')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('assignments')
          .getPublicUrl(fileName);

        attachmentUrl = urlData.publicUrl;
        attachmentType = file.type.split('/')[0];
      }

      const payload = {
        title: formData.title,
        title_ar: formData.title_ar,
        description: formData.description || null,
        description_ar: formData.description_ar || null,
        group_id: formData.group_id || null,
        due_date: formData.due_date,
        max_score: formData.max_score,
        assigned_by: user.id,
        attachment_url: attachmentUrl,
        attachment_type: attachmentType,
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
        
        // Send notification to group students
        if (formData.group_id) {
          const dueDate = new Date(formData.due_date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US');
          await supabase.functions.invoke('send-notification', {
            body: {
              group_id: formData.group_id,
              title: 'New Assignment',
              title_ar: 'واجب جديد',
              message: `You have a new assignment: "${formData.title}" - Due: ${dueDate}`,
              message_ar: `لديك واجب جديد: "${formData.title_ar}" - موعد التسليم: ${dueDate}`,
              type: 'info',
              category: 'assignment',
              action_url: '/assignments',
            },
          });
        }
        
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
    } finally {
      setUploading(false);
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
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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

              {/* File Upload Section */}
              <div className="grid gap-2">
                <Label>{isRTL ? 'رفع ملف (صورة، PDF، فيديو)' : 'Upload File (Image, PDF, Video)'}</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  accept="image/*,video/*,application/pdf,.doc,.docx,.ppt,.pptx"
                  className="hidden"
                />
                
                {file || editingAssignment?.attachment_url ? (
                  <div className="p-3 rounded-lg border bg-muted/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getFileIcon(file?.type || editingAssignment?.attachment_type || null)}
                      <div>
                        <p className="text-sm font-medium truncate max-w-[200px]">
                          {file?.name || (isRTL ? 'ملف مرفق' : 'Attached file')}
                        </p>
                        {file && <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-4 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 cursor-pointer transition-colors text-center"
                  >
                    <Upload className="w-6 h-6 mx-auto text-muted-foreground" />
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isRTL ? 'اضغط لرفع ملف' : 'Click to upload'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isRTL ? 'صور، فيديو، PDF (حد أقصى 50MB)' : 'Images, Video, PDF (Max 50MB)'}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button className="kojo-gradient" onClick={handleSubmit} disabled={uploading}>
                {uploading ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : t.common.save}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mobile Cards View */}
        <div className="block md:hidden space-y-3">
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {t.common.loading}
              </CardContent>
            </Card>
          ) : filteredAssignments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {isRTL ? 'لا توجد اساينمنتات' : 'No assignments found'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredAssignments.map((assignment) => (
              <Card 
                key={assignment.id} 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/assignment-submissions/${assignment.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {language === 'ar' ? assignment.title_ar : assignment.title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {getGroupName(assignment.group_id)}
                      </p>
                    </div>
                    {role === 'student' ? (
                      (() => {
                        const submissionStatus = getSubmissionStatus(assignment.id);
                        if (submissionStatus) {
                          return (
                            <Badge 
                              variant="outline" 
                              className={submissionStatus.status === 'graded' 
                                ? 'bg-green-100 text-green-800 flex-shrink-0' 
                                : 'bg-blue-100 text-blue-800 flex-shrink-0'
                              }
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {submissionStatus.status === 'graded' 
                                ? (isRTL ? `مقيّم: ${submissionStatus.score}` : `Graded: ${submissionStatus.score}`)
                                : (isRTL ? 'تم التسليم' : 'Submitted')
                              }
                            </Badge>
                          );
                        }
                        return (
                          <Button
                            size="sm"
                            className="kojo-gradient flex-shrink-0"
                            onClick={(e) => { e.stopPropagation(); navigate(`/assignment/${assignment.id}`); }}
                          >
                            {isRTL ? 'تسليم' : 'Submit'}
                          </Button>
                        );
                      })()
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="flex-shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/assignment-submissions/${assignment.id}`); }}>
                            <Eye className="h-4 w-4 mr-2" />
                            {isRTL ? 'عرض التسليمات' : 'View Submissions'}
                          </DropdownMenuItem>
                          {canManage && (
                            <>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(assignment); }}>
                                <Pencil className="h-4 w-4 mr-2" />
                                {t.common.edit}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); handleDelete(assignment.id); }}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t.common.delete}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-muted-foreground">{formatDate(assignment.due_date)}</p>
                    {isOverdue(assignment.due_date) ? (
                      <Badge variant="destructive" className="text-xs">
                        {isRTL ? 'منتهي' : 'Overdue'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-100 text-green-800 text-xs">
                        {isRTL ? 'نشط' : 'Active'}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <Card className="hidden md:block">
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
                        {role === 'student' ? (
                          (() => {
                            const submissionStatus = getSubmissionStatus(assignment.id);
                            if (submissionStatus) {
                              return (
                                <Badge 
                                  variant="outline" 
                                  className={submissionStatus.status === 'graded' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-blue-100 text-blue-800'
                                  }
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  {submissionStatus.status === 'graded' 
                                    ? (isRTL ? `مقيّم: ${submissionStatus.score}` : `Graded: ${submissionStatus.score}`)
                                    : (isRTL ? 'تم التسليم' : 'Submitted')
                                  }
                                </Badge>
                              );
                            }
                            return (
                              <Button
                                size="sm"
                                className="kojo-gradient"
                                onClick={() => navigate(`/assignment/${assignment.id}`)}
                              >
                                {isRTL ? 'تسليم' : 'Submit'}
                              </Button>
                            );
                          })()
                        ) : (
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
                        )}
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
