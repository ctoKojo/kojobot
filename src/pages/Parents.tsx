import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Search, Phone, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface LinkedParent {
  parent_id: string;
  full_name: string;
  full_name_ar: string | null;
  email: string;
  phone: string | null;
  children: { student_id: string; student_name: string; student_name_ar: string | null; relationship: string }[];
}

export default function Parents() {
  const { isRTL } = useLanguage();
  const [parents, setParents] = useState<LinkedParent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchLinkedParents = async () => {
      // Get all parent_students links
      const { data: links } = await supabase
        .from('parent_students')
        .select('parent_id, student_id, relationship');

      if (!links?.length) {
        setLoading(false);
        return;
      }

      const parentIds = [...new Set(links.map(l => l.parent_id))];
      const studentIds = [...new Set(links.map(l => l.student_id))];

      const [{ data: parentProfiles }, { data: studentProfiles }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, full_name_ar, email, phone').in('user_id', parentIds),
        supabase.from('profiles').select('user_id, full_name, full_name_ar').in('user_id', studentIds),
      ]);

      const grouped: Record<string, LinkedParent> = {};

      for (const link of links) {
        if (!grouped[link.parent_id]) {
          const profile = parentProfiles?.find(p => p.user_id === link.parent_id);
          grouped[link.parent_id] = {
            parent_id: link.parent_id,
            full_name: profile?.full_name || '',
            full_name_ar: profile?.full_name_ar || null,
            email: profile?.email || '',
            phone: profile?.phone || null,
            children: [],
          };
        }
        const student = studentProfiles?.find(p => p.user_id === link.student_id);
        grouped[link.parent_id].children.push({
          student_id: link.student_id,
          student_name: student?.full_name || '',
          student_name_ar: student?.full_name_ar || null,
          relationship: link.relationship,
        });
      }

      setParents(Object.values(grouped));
      setLoading(false);
    };

    fetchLinkedParents();
  }, []);

  const getRelLabel = (rel: string) => {
    if (isRTL) {
      switch (rel) { case 'father': return 'أب'; case 'mother': return 'أم'; case 'guardian': return 'وصي'; default: return 'ولي أمر'; }
    }
    switch (rel) { case 'father': return 'Father'; case 'mother': return 'Mother'; case 'guardian': return 'Guardian'; default: return 'Parent'; }
  };

  const filtered = parents.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.full_name.toLowerCase().includes(q) ||
      (p.full_name_ar?.toLowerCase().includes(q)) ||
      p.email.toLowerCase().includes(q) ||
      (p.phone?.includes(q)) ||
      p.children.some(c => c.student_name.toLowerCase().includes(q) || c.student_name_ar?.toLowerCase().includes(q))
    );
  });

  return (
    <DashboardLayout title={isRTL ? 'أولياء الأمور المرتبطون' : 'Linked Parents'}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={isRTL ? 'بحث بالاسم أو الهاتف أو اسم الطالب...' : 'Search by name, phone, or student name...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Badge variant="secondary" className="text-sm">
            {filtered.length} {isRTL ? 'ولي أمر' : 'parents'}
          </Badge>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {search
                  ? (isRTL ? 'لا توجد نتائج' : 'No results found')
                  : (isRTL ? 'لا يوجد أولياء أمور مرتبطون بعد' : 'No linked parents yet')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                  <TableHead>{isRTL ? 'التواصل' : 'Contact'}</TableHead>
                  <TableHead>{isRTL ? 'الأبناء المرتبطون' : 'Linked Children'}</TableHead>
                  <TableHead className="text-center">{isRTL ? 'العدد' : 'Count'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(parent => (
                  <TableRow key={parent.parent_id}>
                    <TableCell className="font-medium">
                      {isRTL ? parent.full_name_ar || parent.full_name : parent.full_name}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {parent.phone && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />{parent.phone}
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />{parent.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {parent.children.map(c => (
                          <Badge key={c.student_id} variant="outline" className="text-xs">
                            {isRTL ? c.student_name_ar || c.student_name : c.student_name}
                            <span className="text-muted-foreground mx-1">·</span>
                            {getRelLabel(c.relationship)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge>{parent.children.length}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
