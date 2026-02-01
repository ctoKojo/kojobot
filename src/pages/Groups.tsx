import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Users, UserPlus, UserMinus, Eye, TrendingUp, CalendarIcon, Snowflake, Play, Pause } from 'lucide-react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatTime12Hour } from '@/lib/timeUtils';
import { notificationService } from '@/lib/notificationService';
import { logCreate, logUpdate, logDelete, logFreeze, logActivate } from '@/lib/activityLogger';

type GroupType = 'kojo_squad' | 'kojo_core' | 'kojo_x';
type AttendanceMode = 'online' | 'offline';
type GroupStatus = 'active' | 'pending' | 'frozen';

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
  group_type: GroupType;
  attendance_mode: AttendanceMode | null;
  session_link: string | null;
  status: GroupStatus;
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

interface Student {
  user_id: string;
  full_name: string;
  full_name_ar: string | null;
  subscription_type: GroupType | null;
  age_group_id: string | null;
  level_id: string | null;
  attendance_mode: AttendanceMode | null;
}

interface GroupStudent {
  id: string;
  student_id: string;
  group_id: string;
  is_active: boolean;
}

interface GroupStudentCount {
  [groupId: string]: number;
}

export default function GroupsPage() {
  const { t, isRTL, language } = useLanguage();
  const { toast } = useToast();
  const { role } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === 'admin';
  const [groups, setGroups] = useState<Group[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isStudentsDialogOpen, setIsStudentsDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupStudents, setGroupStudents] = useState<GroupStudent[]>([]);
  const [allGroupStudentsData, setAllGroupStudentsData] = useState<GroupStudent[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
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
    group_type: 'kojo_squad' as GroupType,
    attendance_mode: 'offline' as AttendanceMode,
    session_link: '',
    is_existing_group: false,
    next_session_number: 1,
    next_session_date: null as Date | null,
  });
  const [groupStudentCounts, setGroupStudentCounts] = useState<GroupStudentCount>({});

  const groupTypes: { value: GroupType; label: string; labelAr: string; maxStudents: number }[] = [
    { value: 'kojo_squad', label: 'Kojo Squad', labelAr: 'كوجو سكواد', maxStudents: 8 },
    { value: 'kojo_core', label: 'Kojo Core', labelAr: 'كوجو كور', maxStudents: 3 },
    { value: 'kojo_x', label: 'Kojo X', labelAr: 'كوجو اكس', maxStudents: 1 },
  ];

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
    
    // Subscribe to real-time changes on group_students
    const channel = supabase
      .channel('group-students-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_students',
        },
        () => {
          // Refresh student counts when group_students changes
          refreshStudentCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const refreshStudentCounts = async () => {
    const { data } = await supabase
      .from('group_students')
      .select('group_id')
      .eq('is_active', true);
    
    const counts: GroupStudentCount = {};
    (data || []).forEach((gs) => {
      counts[gs.group_id] = (counts[gs.group_id] || 0) + 1;
    });
    setGroupStudentCounts(counts);
  };

  // Group session progress state
  const [groupSessionProgress, setGroupSessionProgress] = useState<{ [groupId: string]: { completed: number; total: number } }>({});

  const fetchData = async () => {
    try {
      const [groupsRes, ageGroupsRes, levelsRes, instructorRolesRes, studentRolesRes, groupStudentsRes, sessionsRes] = await Promise.all([
        supabase.from('groups').select('*').order('name'),
        supabase.from('age_groups').select('id, name, name_ar').eq('is_active', true),
        supabase.from('levels').select('id, name, name_ar').eq('is_active', true),
        supabase.from('user_roles').select('user_id').eq('role', 'instructor'),
        supabase.from('user_roles').select('user_id').eq('role', 'student'),
        supabase.from('group_students').select('group_id').eq('is_active', true),
        supabase.from('sessions').select('group_id, session_number, status'),
      ]);

      setGroups((groupsRes.data || []) as Group[]);
      setAgeGroups(ageGroupsRes.data || []);
      setLevels(levelsRes.data || []);

      // Calculate student counts per group
      const counts: GroupStudentCount = {};
      (groupStudentsRes.data || []).forEach((gs) => {
        counts[gs.group_id] = (counts[gs.group_id] || 0) + 1;
      });
      setGroupStudentCounts(counts);

      // Calculate session progress per group
      const sessionProgress: { [groupId: string]: { completed: number; total: number } } = {};
      (sessionsRes.data || []).forEach((session: any) => {
        if (!sessionProgress[session.group_id]) {
          sessionProgress[session.group_id] = { completed: 0, total: 12 };
        }
        if (session.status === 'completed') {
          sessionProgress[session.group_id].completed++;
        }
      });
      setGroupSessionProgress(sessionProgress);

      // Fetch instructor profiles
      const instructorIds = instructorRolesRes.data?.map((r) => r.user_id) || [];
      if (instructorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, full_name_ar')
          .in('user_id', instructorIds);
        setInstructors(profilesData || []);
      }

      // Fetch student profiles with subscription_type, age_group_id and level_id
      const studentIds = studentRolesRes.data?.map((r) => r.user_id) || [];
      if (studentIds.length > 0) {
        const { data: studentProfilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, full_name_ar, subscription_type, age_group_id, level_id, attendance_mode')
          .in('user_id', studentIds);
        setAllStudents((studentProfilesData || []) as Student[]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupStudents = async (groupId: string) => {
    setStudentsLoading(true);
    try {
      // Fetch all group students to check for students in other groups
      const [currentGroupRes, allGroupsRes] = await Promise.all([
        supabase.from('group_students').select('*').eq('group_id', groupId),
        supabase.from('group_students').select('*').eq('is_active', true)
      ]);
      
      if (currentGroupRes.error) throw currentGroupRes.error;
      setGroupStudents(currentGroupRes.data || []);
      setAllGroupStudentsData(allGroupsRes.data || []);
      setSelectedStudentIds((currentGroupRes.data || []).filter(gs => gs.is_active).map(gs => gs.student_id));
    } catch (error) {
      console.error('Error fetching group students:', error);
    } finally {
      setStudentsLoading(false);
    }
  };

  const handleManageStudents = (group: Group) => {
    setSelectedGroup(group);
    fetchGroupStudents(group.id);
    setIsStudentsDialogOpen(true);
  };

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSaveStudents = async () => {
    if (!selectedGroup) return;
    
    try {
      // Get current active students in the group
      const currentActiveIds = groupStudents.filter(gs => gs.is_active).map(gs => gs.student_id);
      
      // Students to add (in selectedStudentIds but not in currentActiveIds)
      const toAdd = selectedStudentIds.filter(id => !currentActiveIds.includes(id));
      
      // Students to remove (in currentActiveIds but not in selectedStudentIds)
      const toRemove = currentActiveIds.filter(id => !selectedStudentIds.includes(id));

      // Add new students
      for (const studentId of toAdd) {
        const existing = groupStudents.find(gs => gs.student_id === studentId);
        if (existing) {
          // Reactivate existing record
          await supabase
            .from('group_students')
            .update({ is_active: true })
            .eq('id', existing.id);
        } else {
          // Create new record
          await supabase
            .from('group_students')
            .insert({ group_id: selectedGroup.id, student_id: studentId });
        }
      }

      // Deactivate removed students
      for (const studentId of toRemove) {
        const existing = groupStudents.find(gs => gs.student_id === studentId);
        if (existing) {
          await supabase
            .from('group_students')
            .update({ is_active: false })
            .eq('id', existing.id);
        }
      }

      toast({
        title: t.common.success,
        description: isRTL ? 'تم تحديث طلاب المجموعة' : 'Group students updated successfully',
      });
      
      setIsStudentsDialogOpen(false);
      setSelectedGroup(null);
    } catch (error) {
      console.error('Error saving group students:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في حفظ طلاب المجموعة' : 'Failed to save group students',
      });
    }
  };

  const getStudentName = (studentId: string) => {
    const student = allStudents.find(s => s.user_id === studentId);
    if (!student) return '-';
    return language === 'ar' && student.full_name_ar ? student.full_name_ar : student.full_name;
  };

  const handleSubmit = async () => {
    try {
      const payload: any = {
        name: formData.name,
        name_ar: formData.name_ar,
        age_group_id: formData.age_group_id || null,
        level_id: formData.level_id || null,
        instructor_id: formData.instructor_id,
        schedule_day: formData.schedule_day,
        schedule_time: formData.schedule_time,
        duration_minutes: formData.duration_minutes,
        group_type: formData.group_type,
        attendance_mode: formData.attendance_mode,
        session_link: formData.attendance_mode === 'online' ? formData.session_link || null : null,
      };

      // If creating new group and it's an existing group, set starting session number and date
      if (!editingGroup && formData.is_existing_group) {
        payload.starting_session_number = formData.next_session_number;
        payload.start_date = formData.next_session_date ? format(formData.next_session_date, 'yyyy-MM-dd') : null;
      }

      const previousInstructorId = editingGroup?.instructor_id;
      const isNewInstructor = !editingGroup || previousInstructorId !== formData.instructor_id;

      if (editingGroup) {
        const { error } = await supabase
          .from('groups')
          .update(payload)
          .eq('id', editingGroup.id);

        if (error) throw error;
        
        // Notify new instructor if changed
        if (isNewInstructor) {
          await notificationService.notifyGroupAssigned(
            formData.instructor_id,
            formData.name,
            formData.name_ar,
            formData.schedule_day,
            formData.schedule_time
          );
        }
        
        toast({
          title: t.common.success,
          description: isRTL ? 'تم تحديث المجموعة' : 'Group updated successfully',
        });
      } else {
        const { error } = await supabase
          .from('groups')
          .insert([payload]);

        if (error) throw error;
        
        // Notify instructor about new group assignment
        await notificationService.notifyGroupAssigned(
          formData.instructor_id,
          formData.name,
          formData.name_ar,
          formData.schedule_day,
          formData.schedule_time
        );
        
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
      group_type: 'kojo_squad',
      attendance_mode: 'offline',
      session_link: '',
      is_existing_group: false,
      next_session_number: 1,
      next_session_date: null,
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
      group_type: group.group_type || 'kojo_squad',
      attendance_mode: group.attendance_mode || 'offline',
      session_link: group.session_link || '',
      is_existing_group: false,
      next_session_number: 1,
      next_session_date: null,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const group = groups.find(g => g.id === id);
      const { error } = await supabase.from('groups').delete().eq('id', id);
      if (error) throw error;
      
      await logDelete('group', id, { name: group?.name });
      
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

  const handleChangeStatus = async (groupId: string, newStatus: GroupStatus) => {
    try {
      const group = groups.find(g => g.id === groupId);
      const { error } = await supabase
        .from('groups')
        .update({ status: newStatus })
        .eq('id', groupId);
      
      if (error) throw error;
      
      // Log the status change
      if (newStatus === 'frozen') {
        await logFreeze('group', groupId, { name: group?.name, status: newStatus });
      } else if (newStatus === 'active') {
        await logActivate('group', groupId, { name: group?.name, status: newStatus });
      } else {
        await logUpdate('group', groupId, { name: group?.name, status: newStatus });
      }
      
      const statusLabels: Record<GroupStatus, { en: string; ar: string }> = {
        active: { en: 'activated', ar: 'تم تفعيل' },
        pending: { en: 'set to pending', ar: 'تم تعليق' },
        frozen: { en: 'frozen', ar: 'تم تجميد' },
      };
      
      toast({
        title: t.common.success,
        description: isRTL 
          ? `${statusLabels[newStatus].ar} المجموعة بنجاح`
          : `Group ${statusLabels[newStatus].en} successfully`,
      });
      
      fetchData();
    } catch (error) {
      console.error('Error changing group status:', error);
      toast({
        variant: 'destructive',
        title: t.common.error,
        description: isRTL ? 'فشل في تغيير حالة المجموعة' : 'Failed to change group status',
      });
    }
  };

  const getStatusBadge = (status: GroupStatus) => {
    switch (status) {
      case 'active':
        return { className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: isRTL ? 'نشط' : 'Active' };
      case 'pending':
        return { className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', label: isRTL ? 'معلق' : 'Pending' };
      case 'frozen':
        return { className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400', label: isRTL ? 'مجمد' : 'Frozen' };
      default:
        return { className: '', label: status };
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

  const getGroupTypeInfo = (type: GroupType) => {
    return groupTypes.find(gt => gt.value === type) || groupTypes[0];
  };

  const getMaxStudents = (type: GroupType) => {
    return getGroupTypeInfo(type).maxStudents;
  };

  // Get all students that are already assigned to any group
  const getStudentsInOtherGroups = (currentGroupId: string): string[] => {
    // Get all active group_students for groups other than current
    // We need to track this from the groupStudents we fetched for all groups
    // For now, we'll check in real-time when opening the dialog
    return [];
  };

  const getEligibleStudents = (groupId: string, groupType: GroupType, groupAgeGroupId: string | null, groupLevelId: string | null, groupAttendanceMode: AttendanceMode | null, allGroupStudentsData: GroupStudent[]) => {
    // Get students already in other groups
    const studentsInOtherGroups = allGroupStudentsData
      .filter(gs => gs.group_id !== groupId && gs.is_active)
      .map(gs => gs.student_id);

    return allStudents.filter(student => {
      // Must match subscription type
      if (student.subscription_type !== groupType) return false;
      
      // If group has age_group_id, student must match it
      if (groupAgeGroupId && student.age_group_id !== groupAgeGroupId) return false;
      
      // If group has level_id, student must match it
      if (groupLevelId && student.level_id !== groupLevelId) return false;
      
      // Must match attendance mode (online/offline)
      const studentMode = student.attendance_mode || 'offline';
      const groupMode = groupAttendanceMode || 'offline';
      if (studentMode !== groupMode) return false;
      
      // Student must not be in another group (unless already in this group)
      const isInCurrentGroup = allGroupStudentsData.some(gs => gs.group_id === groupId && gs.student_id === student.user_id && gs.is_active);
      if (studentsInOtherGroups.includes(student.user_id) && !isInCurrentGroup) return false;
      
      return true;
    });
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

          {isAdmin && (
            <Button className="kojo-gradient" onClick={() => {
              setEditingGroup(null);
              resetForm();
              setIsDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              {t.groups.addGroup}
            </Button>
          )}
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
              {/* Group Status Section - Only show when creating new group */}
              {!editingGroup && (
                <div className="grid gap-4 pb-4 border-b">
                  <Label className="font-semibold">{isRTL ? 'حالة المجموعة' : 'Group Status'}</Label>
                  <RadioGroup
                    value={formData.is_existing_group ? 'existing' : 'new'}
                    onValueChange={(value) => setFormData({ 
                      ...formData, 
                      is_existing_group: value === 'existing',
                      next_session_number: value === 'new' ? 1 : formData.next_session_number,
                      next_session_date: value === 'new' ? null : formData.next_session_date
                    })}
                    className="flex flex-col gap-3"
                  >
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <RadioGroupItem value="new" id="new-group" />
                      <Label htmlFor="new-group" className="cursor-pointer font-normal">
                        {isRTL ? 'مجموعة جديدة - تبدأ من السيشن 1' : 'New Group - Starts from Session 1'}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <RadioGroupItem value="existing" id="existing-group" />
                      <Label htmlFor="existing-group" className="cursor-pointer font-normal">
                        {isRTL ? 'مجموعة قائمة - بدأت مسبقاً' : 'Existing Group - Already Started'}
                      </Label>
                    </div>
                  </RadioGroup>

                  {formData.is_existing_group && (
                    <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
                      <div className="grid gap-2">
                        <Label>{isRTL ? 'السيشن القادم سيكون رقم' : 'Next Session Number'}</Label>
                        <Select
                          value={formData.next_session_number.toString()}
                          onValueChange={(value) => setFormData({ ...formData, next_session_number: parseInt(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                              <SelectItem key={num} value={num.toString()}>
                                {isRTL ? `السيشن ${num}` : `Session ${num}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Progress Summary */}
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div className="p-2 rounded bg-background">
                          <div className="font-semibold text-muted-foreground">
                            {formData.next_session_number - 1}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isRTL ? 'سيشنات فاتت' : 'Passed'}
                          </div>
                        </div>
                        <div className="p-2 rounded bg-background">
                          <div className="font-semibold text-primary">
                            {12 - formData.next_session_number + 1}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isRTL ? 'سيشنات باقية' : 'Remaining'}
                          </div>
                        </div>
                        <div className="p-2 rounded bg-background">
                          <div className="font-semibold text-green-600">
                            {Math.round(((formData.next_session_number - 1) / 12) * 100)}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isRTL ? 'التقدم' : 'Progress'}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label>{isRTL ? 'تاريخ السيشن القادم' : 'Next Session Date'}</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !formData.next_session_date && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                              {formData.next_session_date ? (
                                format(formData.next_session_date, "PPP", { locale: isRTL ? ar : enUS })
                              ) : (
                                <span>{isRTL ? 'اختر التاريخ' : 'Select date'}</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={formData.next_session_date || undefined}
                              onSelect={(date) => setFormData({ ...formData, next_session_date: date || null })}
                              disabled={(date) => date < new Date()}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}
                </div>
              )}

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
              <div className="grid gap-2">
                <Label>{isRTL ? 'نوع المجموعة' : 'Group Type'}</Label>
                <Select
                  value={formData.group_type}
                  onValueChange={(value) => setFormData({ ...formData, group_type: value as GroupType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? 'اختر النوع' : 'Select type'} />
                  </SelectTrigger>
                  <SelectContent>
                    {groupTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {language === 'ar' ? type.labelAr : type.label} ({isRTL ? `حد أقصى ${type.maxStudents} طالب` : `max ${type.maxStudents} students`})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t.groups.attendanceMode}</Label>
                <Select
                  value={formData.attendance_mode}
                  onValueChange={(value) => setFormData({ ...formData, attendance_mode: value as AttendanceMode })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? 'اختر نوع الحضور' : 'Select attendance mode'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offline">{t.groups.offline}</SelectItem>
                    <SelectItem value="online">{t.groups.online}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.attendance_mode === 'online' && (
                <div className="grid gap-2">
                  <Label>{t.groups.sessionLink}</Label>
                  <Input
                    value={formData.session_link}
                    onChange={(e) => setFormData({ ...formData, session_link: e.target.value })}
                    placeholder="https://meet.google.com/..."
                    dir="ltr"
                  />
                </div>
              )}
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

        {/* Students Management Dialog */}
        <Dialog open={isStudentsDialogOpen} onOpenChange={setIsStudentsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {isRTL ? 'إدارة طلاب المجموعة' : 'Manage Group Students'}
              </DialogTitle>
              <DialogDescription>
                {selectedGroup && (
                  <div className="space-y-1">
                    <span className="font-medium block">
                      {language === 'ar' ? selectedGroup.name_ar : selectedGroup.name}
                    </span>
                    <span className="text-xs">
                      {(() => {
                        const typeInfo = getGroupTypeInfo(selectedGroup.group_type);
                        const currentCount = groupStudentCounts[selectedGroup.id] || 0;
                        return isRTL 
                          ? `${typeInfo.labelAr} - ${currentCount}/${typeInfo.maxStudents} طالب`
                          : `${typeInfo.label} - ${currentCount}/${typeInfo.maxStudents} students`;
                      })()}
                    </span>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {studentsLoading ? (
                <div className="text-center py-8">{t.common.loading}</div>
              ) : (() => {
                const eligibleStudents = selectedGroup 
                  ? getEligibleStudents(selectedGroup.id, selectedGroup.group_type, selectedGroup.age_group_id, selectedGroup.level_id, selectedGroup.attendance_mode, allGroupStudentsData) 
                  : [];
                const maxStudents = selectedGroup ? getMaxStudents(selectedGroup.group_type) : 0;
                const isAtLimit = selectedStudentIds.length >= maxStudents;

                if (eligibleStudents.length === 0) {
                  const groupTypeName = isRTL 
                    ? getGroupTypeInfo(selectedGroup?.group_type || 'kojo_squad').labelAr
                    : getGroupTypeInfo(selectedGroup?.group_type || 'kojo_squad').label;
                  const ageGroupName = selectedGroup?.age_group_id 
                    ? getAgeGroupName(selectedGroup.age_group_id)
                    : null;
                  const levelName = selectedGroup?.level_id
                    ? getLevelName(selectedGroup.level_id)
                    : null;
                  
                  return (
                    <div className="text-center py-8 text-muted-foreground space-y-2">
                      <p className="font-medium">
                        {isRTL ? 'لا يوجد طلاب مطابقين' : 'No matching students found'}
                      </p>
                      <p className="text-sm">
                        {isRTL 
                          ? `يجب أن يكون الطالب مشتركاً في باقة "${groupTypeName}"${ageGroupName ? ` وفي الفئة العمرية "${ageGroupName}"` : ''}${levelName ? ` وفي المستوى "${levelName}"` : ''} وغير مضاف في مجموعة أخرى`
                          : `Student must be subscribed to "${groupTypeName}"${ageGroupName ? ` and in age group "${ageGroupName}"` : ''}${levelName ? ` and in level "${levelName}"` : ''} and not in another group`}
                      </p>
                    </div>
                  );
                }

                return (
                  <>
                    <ScrollArea className="h-[300px] pr-4">
                      <div className="space-y-2">
                        {eligibleStudents.map((student) => {
                          const isSelected = selectedStudentIds.includes(student.user_id);
                          const isDisabled = !isSelected && isAtLimit;
                          
                          return (
                            <div
                              key={student.user_id}
                              className={`flex items-center space-x-3 rtl:space-x-reverse p-3 rounded-lg border ${
                                isDisabled 
                                  ? 'opacity-50 cursor-not-allowed' 
                                  : 'hover:bg-muted/50 cursor-pointer'
                              }`}
                              onClick={() => !isDisabled && handleStudentToggle(student.user_id)}
                            >
                              <Checkbox
                                checked={isSelected}
                                disabled={isDisabled}
                                onCheckedChange={() => !isDisabled && handleStudentToggle(student.user_id)}
                              />
                              <span className="flex-1">
                                {language === 'ar' && student.full_name_ar 
                                  ? student.full_name_ar 
                                  : student.full_name}
                              </span>
                              {isSelected && (
                                <Badge variant="secondary" className="text-xs">
                                  {isRTL ? 'مضاف' : 'Added'}
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                    {isAtLimit && (
                      <div className="mt-2 p-2 bg-destructive/10 text-destructive text-sm rounded">
                        {isRTL 
                          ? `تم الوصول للحد الأقصى (${maxStudents} طالب)`
                          : `Maximum limit reached (${maxStudents} students)`}
                      </div>
                    )}
                  </>
                );
              })()}
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  {isRTL 
                    ? `${selectedStudentIds.length} طالب محدد`
                    : `${selectedStudentIds.length} student(s) selected`}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsStudentsDialogOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button className="kojo-gradient" onClick={handleSaveStudents}>
                {t.common.save}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mobile Card View */}
        <div className="block lg:hidden space-y-3">
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center">
                {t.common.loading}
              </CardContent>
            </Card>
          ) : filteredGroups.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {isRTL ? 'لا توجد مجموعات' : 'No groups found'}
              </CardContent>
            </Card>
          ) : (
            filteredGroups.map((group) => {
              const typeInfo = getGroupTypeInfo(group.group_type);
              const currentCount = groupStudentCounts[group.id] || 0;
              const isAtLimit = currentCount >= typeInfo.maxStudents;
              const progress = groupSessionProgress[group.id] || { completed: 0, total: 12 };
              const progressPercent = Math.round((progress.completed / progress.total) * 100);
              
              return (
                <Card 
                  key={group.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/group/${group.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold truncate">
                            {language === 'ar' ? group.name_ar : group.name}
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            {language === 'ar' ? typeInfo.labelAr : typeInfo.label}
                          </Badge>
                          <Badge 
                            variant={group.attendance_mode === 'online' ? 'default' : 'outline'} 
                            className={`text-xs ${group.attendance_mode === 'online' ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
                          >
                            {group.attendance_mode === 'online' 
                              ? (isRTL ? 'أونلاين' : 'Online')
                              : (isRTL ? 'حضوري' : 'Offline')}
                          </Badge>
                          {/* Status Badge */}
                          {group.status && group.status !== 'active' && (
                            <Badge className={`text-xs ${getStatusBadge(group.status).className}`}>
                              {getStatusBadge(group.status).label}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                          <span>{getInstructorName(group.instructor_id)}</span>
                          <span>•</span>
                          <span>{getDayName(group.schedule_day)} {formatTime12Hour(group.schedule_time, isRTL)}</span>
                        </div>
                        
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <Badge variant={isAtLimit ? 'destructive' : 'outline'} className="text-xs">
                              {currentCount}/{typeInfo.maxStudents}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 flex-1 min-w-[80px] max-w-[120px]">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary transition-all" 
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                            <span className="text-xs">{progress.completed}/{progress.total}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div onClick={(e) => e.stopPropagation()}>
                        {isAdmin ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                              <DropdownMenuItem onClick={() => navigate(`/group/${group.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                {isRTL ? 'عرض التفاصيل' : 'View Details'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(group)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                {t.common.edit}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleManageStudents(group)}>
                                <Users className="h-4 w-4 mr-2" />
                                {isRTL ? 'إدارة الطلاب' : 'Manage Students'}
                              </DropdownMenuItem>
                              {/* Status Change Options */}
                              {group.status !== 'active' && (
                                <DropdownMenuItem onClick={() => handleChangeStatus(group.id, 'active')}>
                                  <Play className="h-4 w-4 mr-2 text-green-600" />
                                  {isRTL ? 'تفعيل' : 'Activate'}
                                </DropdownMenuItem>
                              )}
                              {group.status !== 'pending' && (
                                <DropdownMenuItem onClick={() => handleChangeStatus(group.id, 'pending')}>
                                  <Pause className="h-4 w-4 mr-2 text-yellow-600" />
                                  {isRTL ? 'تعليق' : 'Set Pending'}
                                </DropdownMenuItem>
                              )}
                              {group.status !== 'frozen' && (
                                <DropdownMenuItem onClick={() => handleChangeStatus(group.id, 'frozen')}>
                                  <Snowflake className="h-4 w-4 mr-2 text-sky-600" />
                                  {isRTL ? 'تجميد' : 'Freeze'}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => handleDelete(group.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t.common.delete}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => navigate(`/group/${group.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Desktop Table View */}
        <Card className="hidden lg:block">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.groups.groupName}</TableHead>
                  <TableHead>{isRTL ? 'النوع' : 'Type'}</TableHead>
                  <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead>{isRTL ? 'نوع الحضور' : 'Attendance'}</TableHead>
                  <TableHead>{t.students.ageGroup}</TableHead>
                  <TableHead>{t.students.level}</TableHead>
                  <TableHead>{isRTL ? 'التقدم' : 'Progress'}</TableHead>
                  <TableHead>{isRTL ? 'الطلاب' : 'Students'}</TableHead>
                  <TableHead>{t.groups.instructor}</TableHead>
                  <TableHead>{t.groups.schedule}</TableHead>
                  <TableHead className="w-[120px]">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      {t.common.loading}
                    </TableCell>
                  </TableRow>
                ) : filteredGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {isRTL ? 'لا توجد مجموعات' : 'No groups found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGroups.map((group) => {
                    const typeInfo = getGroupTypeInfo(group.group_type);
                    const currentCount = groupStudentCounts[group.id] || 0;
                    const isAtLimit = currentCount >= typeInfo.maxStudents;
                    const progress = groupSessionProgress[group.id] || { completed: 0, total: 12 };
                    const progressPercent = Math.round((progress.completed / progress.total) * 100);
                    
                    return (
                      <TableRow 
                        key={group.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/group/${group.id}`)}
                      >
                        <TableCell className="font-medium">
                          {language === 'ar' ? group.name_ar : group.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {language === 'ar' ? typeInfo.labelAr : typeInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadge(group.status || 'active').className}>
                            {getStatusBadge(group.status || 'active').label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={group.attendance_mode === 'online' ? 'default' : 'outline'}
                            className={group.attendance_mode === 'online' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                          >
                            {group.attendance_mode === 'online' 
                              ? (isRTL ? 'أونلاين' : 'Online')
                              : (isRTL ? 'حضوري' : 'Offline')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getAgeGroupName(group.age_group_id)}
                        </TableCell>
                        <TableCell>
                          {getLevelName(group.level_id)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary transition-all" 
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {progress.completed}/{progress.total}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={isAtLimit ? 'destructive' : 'outline'}>
                            {currentCount}/{typeInfo.maxStudents}
                          </Badge>
                        </TableCell>
                        <TableCell>{getInstructorName(group.instructor_id)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getDayName(group.schedule_day)} - {formatTime12Hour(group.schedule_time, isRTL)}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {isAdmin ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleManageStudents(group)}
                                title={isRTL ? 'إدارة الطلاب' : 'Manage Students'}
                              >
                                <Users className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                                  <DropdownMenuItem onClick={() => navigate(`/group/${group.id}`)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    {isRTL ? 'عرض التفاصيل' : 'View Details'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEdit(group)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    {t.common.edit}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleManageStudents(group)}>
                                    <Users className="h-4 w-4 mr-2" />
                                    {isRTL ? 'إدارة الطلاب' : 'Manage Students'}
                                  </DropdownMenuItem>
                                  {/* Status Change Options */}
                                  {group.status !== 'active' && (
                                    <DropdownMenuItem onClick={() => handleChangeStatus(group.id, 'active')}>
                                      <Play className="h-4 w-4 mr-2 text-green-600" />
                                      {isRTL ? 'تفعيل' : 'Activate'}
                                    </DropdownMenuItem>
                                  )}
                                  {group.status !== 'pending' && (
                                    <DropdownMenuItem onClick={() => handleChangeStatus(group.id, 'pending')}>
                                      <Pause className="h-4 w-4 mr-2 text-yellow-600" />
                                      {isRTL ? 'تعليق' : 'Set Pending'}
                                    </DropdownMenuItem>
                                  )}
                                  {group.status !== 'frozen' && (
                                    <DropdownMenuItem onClick={() => handleChangeStatus(group.id, 'frozen')}>
                                      <Snowflake className="h-4 w-4 mr-2 text-sky-600" />
                                      {isRTL ? 'تجميد' : 'Freeze'}
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem 
                                    onClick={() => handleDelete(group.id)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    {t.common.delete}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/group/${group.id}`)}
                              title={isRTL ? 'عرض التفاصيل' : 'View Details'}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
