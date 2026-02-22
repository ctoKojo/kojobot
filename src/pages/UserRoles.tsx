import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Shield, Plus, Trash2, Search, Users, GraduationCap, Briefcase, UserCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const ROLE_COLORS: Record<AppRole, string> = {
  admin: 'bg-destructive/10 text-destructive border-destructive/20',
  instructor: 'bg-primary/10 text-primary border-primary/20',
  student: 'bg-success/10 text-success border-success/20',
  reception: 'bg-warning/10 text-warning border-warning/20',
};

const ROLE_ICONS: Record<AppRole, React.ComponentType<{ className?: string }>> = {
  admin: Shield,
  instructor: Briefcase,
  student: GraduationCap,
  reception: UserCheck,
};

interface UserWithRoles {
  user_id: string;
  full_name: string;
  full_name_ar: string | null;
  email: string;
  roles: AppRole[];
}

export default function UserRoles() {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [filterRole, setFilterRole] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [roleToAdd, setRoleToAdd] = useState<AppRole | ''>('');
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [roleToRemove, setRoleToRemove] = useState<{ user: UserWithRoles; role: AppRole } | null>(null);

  // Fetch all profiles
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['all-profiles-for-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, full_name_ar, email')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch all user roles
  const { data: userRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ['all-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (error) throw error;
      return data;
    },
  });

  // Combine profiles with roles
  const usersWithRoles: UserWithRoles[] = (profiles || []).map((p) => ({
    user_id: p.user_id,
    full_name: p.full_name,
    full_name_ar: p.full_name_ar,
    email: p.email,
    roles: (userRoles || [])
      .filter((r) => r.user_id === p.user_id)
      .map((r) => r.role),
  }));

  // Filter
  const filtered = usersWithRoles.filter((u) => {
    const matchesRole = filterRole === 'all' || u.roles.includes(filterRole as AppRole);
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      u.full_name.toLowerCase().includes(query) ||
      (u.full_name_ar && u.full_name_ar.includes(query)) ||
      u.email.toLowerCase().includes(query);
    return matchesRole && matchesSearch;
  });

  // Add role mutation
  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-user-roles'] });
      toast.success(isRTL ? 'تمت إضافة الدور بنجاح' : 'Role added successfully');
      setAddDialogOpen(false);
      setSelectedUser(null);
      setRoleToAdd('');
    },
    onError: (err: any) => {
      if (err.message?.includes('duplicate')) {
        toast.error(isRTL ? 'هذا الدور موجود بالفعل لهذا المستخدم' : 'This user already has this role');
      } else {
        toast.error(isRTL ? 'حدث خطأ أثناء إضافة الدور' : 'Error adding role');
      }
    },
  });

  // Remove role mutation
  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-user-roles'] });
      toast.success(isRTL ? 'تم حذف الدور بنجاح' : 'Role removed successfully');
      setRemoveDialogOpen(false);
      setRoleToRemove(null);
    },
    onError: () => {
      toast.error(isRTL ? 'حدث خطأ أثناء حذف الدور' : 'Error removing role');
    },
  });

  const availableRolesForUser = (user: UserWithRoles): AppRole[] => {
    const allRoles: AppRole[] = ['admin', 'instructor', 'student', 'reception'];
    return allRoles.filter((r) => !user.roles.includes(r));
  };

  const isLoading = profilesLoading || rolesLoading;

  // Stats
  const stats = {
    total: usersWithRoles.length,
    admins: usersWithRoles.filter((u) => u.roles.includes('admin')).length,
    instructors: usersWithRoles.filter((u) => u.roles.includes('instructor')).length,
    students: usersWithRoles.filter((u) => u.roles.includes('student')).length,
    reception: usersWithRoles.filter((u) => u.roles.includes('reception')).length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isRTL ? 'إدارة الأدوار' : 'User Roles'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isRTL ? 'إدارة أدوار وصلاحيات المستخدمين' : 'Manage user roles and permissions'}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: isRTL ? 'الكل' : 'Total', value: stats.total, icon: Users, color: 'text-foreground' },
            { label: isRTL ? 'مدراء' : 'Admins', value: stats.admins, icon: Shield, color: 'text-destructive' },
            { label: isRTL ? 'مدربين' : 'Instructors', value: stats.instructors, icon: Briefcase, color: 'text-primary' },
            { label: isRTL ? 'طلاب' : 'Students', value: stats.students, icon: GraduationCap, color: 'text-success' },
            { label: isRTL ? 'استقبال' : 'Reception', value: stats.reception, icon: UserCheck, color: 'text-warning' },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <div>
                  <p className="text-2xl font-bold">{isLoading ? '-' : stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ltr:left-3 rtl:right-3" />
                <Input
                  placeholder={isRTL ? 'بحث بالاسم أو البريد...' : 'Search by name or email...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ltr:pl-9 rtl:pr-9"
                />
              </div>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? 'كل الأدوار' : 'All Roles'}</SelectItem>
                  <SelectItem value="admin">{isRTL ? 'مدير' : 'Admin'}</SelectItem>
                  <SelectItem value="instructor">{isRTL ? 'مدرب' : 'Instructor'}</SelectItem>
                  <SelectItem value="student">{isRTL ? 'طالب' : 'Student'}</SelectItem>
                  <SelectItem value="reception">{isRTL ? 'استقبال' : 'Reception'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {isRTL ? `المستخدمون (${filtered.length})` : `Users (${filtered.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                      <TableHead>{isRTL ? 'البريد' : 'Email'}</TableHead>
                      <TableHead>{isRTL ? 'الأدوار' : 'Roles'}</TableHead>
                      <TableHead className="w-[100px]">{isRTL ? 'إجراءات' : 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          {isRTL ? 'لا توجد نتائج' : 'No results found'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((user) => (
                        <TableRow key={user.user_id}>
                          <TableCell className="font-medium">
                            {isRTL ? (user.full_name_ar || user.full_name) : user.full_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              {user.roles.map((role) => {
                                const Icon = ROLE_ICONS[role];
                                return (
                                  <Badge
                                    key={role}
                                    variant="outline"
                                    className={`${ROLE_COLORS[role]} gap-1 text-xs`}
                                  >
                                    <Icon className="h-3 w-3" />
                                    {isRTL
                                      ? { admin: 'مدير', instructor: 'مدرب', student: 'طالب', reception: 'استقبال' }[role]
                                      : role.charAt(0).toUpperCase() + role.slice(1)}
                                  </Badge>
                                );
                              })}
                              {user.roles.length === 0 && (
                                <span className="text-xs text-muted-foreground italic">
                                  {isRTL ? 'بدون دور' : 'No roles'}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setRoleToAdd('');
                                  setAddDialogOpen(true);
                                }}
                                disabled={availableRolesForUser(user).length === 0}
                                title={isRTL ? 'إضافة دور' : 'Add role'}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Role Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? 'إضافة دور' : 'Add Role'}</DialogTitle>
            <DialogDescription>
              {selectedUser && (
                isRTL
                  ? `إضافة دور جديد لـ ${selectedUser.full_name_ar || selectedUser.full_name}`
                  : `Add a new role to ${selectedUser.full_name}`
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'الأدوار الحالية:' : 'Current roles:'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedUser.roles.map((role) => {
                    const Icon = ROLE_ICONS[role];
                    return (
                      <Badge key={role} variant="outline" className={`${ROLE_COLORS[role]} gap-1`}>
                        <Icon className="h-3 w-3" />
                        {role}
                        <button
                          onClick={() => {
                            setRoleToRemove({ user: selectedUser, role });
                            setRemoveDialogOpen(true);
                          }}
                          className="ml-1 hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <Select value={roleToAdd} onValueChange={(v) => setRoleToAdd(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue placeholder={isRTL ? 'اختر دور...' : 'Select role...'} />
                </SelectTrigger>
                <SelectContent>
                  {availableRolesForUser(selectedUser).map((role) => (
                    <SelectItem key={role} value={role}>
                      {isRTL
                        ? { admin: 'مدير', instructor: 'مدرب', student: 'طالب', reception: 'استقبال' }[role]
                        : role.charAt(0).toUpperCase() + role.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={() => {
                if (selectedUser && roleToAdd) {
                  addRoleMutation.mutate({ userId: selectedUser.user_id, role: roleToAdd as AppRole });
                }
              }}
              disabled={!roleToAdd || addRoleMutation.isPending}
            >
              {addRoleMutation.isPending
                ? (isRTL ? 'جاري الإضافة...' : 'Adding...')
                : (isRTL ? 'إضافة' : 'Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Role Confirmation */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? 'حذف دور' : 'Remove Role'}</DialogTitle>
            <DialogDescription>
              {roleToRemove && (
                isRTL
                  ? `هل أنت متأكد من حذف دور "${roleToRemove.role}" من ${roleToRemove.user.full_name_ar || roleToRemove.user.full_name}؟`
                  : `Are you sure you want to remove the "${roleToRemove.role}" role from ${roleToRemove.user.full_name}?`
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialogOpen(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (roleToRemove) {
                  removeRoleMutation.mutate({
                    userId: roleToRemove.user.user_id,
                    role: roleToRemove.role,
                  });
                }
              }}
              disabled={removeRoleMutation.isPending}
            >
              {removeRoleMutation.isPending
                ? (isRTL ? 'جاري الحذف...' : 'Removing...')
                : (isRTL ? 'حذف' : 'Remove')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
