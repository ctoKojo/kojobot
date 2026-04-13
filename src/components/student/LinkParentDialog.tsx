import { useState, useEffect, useCallback } from 'react';
import { Search, UserPlus, Users, Phone, Baby } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

interface ParentResult {
  id: string;
  full_name: string;
  full_name_ar: string | null;
  phone: string | null;
  email: string;
  children_count: number;
}

interface Props {
  studentId: string;
  studentName: string;
  onLinked?: () => void;
}

export function LinkParentDialog({ studentId, studentName, onLinked }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ParentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const { toast } = useToast();
  const { isRTL } = useLanguage();

  const searchParents = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const { data, error } = await supabase.rpc('search_parents', { p_query: q });
    if (error) {
      console.error('search_parents error:', error);
      setResults([]);
    } else {
      setResults((data || []).map((d: any) => ({
        id: d.id,
        full_name: d.full_name,
        full_name_ar: d.full_name_ar,
        phone: d.phone,
        email: d.email,
        children_count: d.children_count,
      })));
    }
    setSearching(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchParents(query), 300);
    return () => clearTimeout(timer);
  }, [query, searchParents]);

  const handleLink = async (parentId: string) => {
    setLinking(parentId);

    // Check if already linked
    const { data: existing } = await supabase
      .from('parent_students')
      .select('id')
      .eq('parent_id', parentId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (existing) {
      toast({ variant: 'destructive', title: isRTL ? 'مرتبط بالفعل' : 'Already linked' });
      setLinking(null);
      return;
    }

    const { error } = await supabase
      .from('parent_students')
      .insert({ parent_id: parentId, student_id: studentId, relationship: 'parent' });

    if (error) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Error', description: error.message });
    } else {
      toast({ title: isRTL ? 'تم ربط ولي الأمر بنجاح' : 'Parent linked successfully' });
      setOpen(false);
      onLinked?.();
    }
    setLinking(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          {isRTL ? 'ربط بولي أمر' : 'Link Parent'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isRTL ? 'ربط ولي أمر' : 'Link Parent'}</DialogTitle>
          <DialogDescription>
            {isRTL ? `البحث عن ولي أمر لربطه بالطالب: ${studentName}` : `Search for a parent to link to: ${studentName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={isRTL ? 'ابحث بالاسم أو رقم الموبايل...' : 'Search by name or mobile...'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {searching && (
            <p className="text-sm text-muted-foreground text-center">{isRTL ? 'جاري البحث...' : 'Searching...'}</p>
          )}

          {!searching && query.length >= 2 && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center">
              {isRTL ? 'لا يوجد ولي أمر بهذا الاسم. تأكد أن ولي الأمر سجّل حسابه أولاً.' : 'No parent found. Make sure the parent has registered first.'}
            </p>
          )}

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {results.map((parent) => (
              <div
                key={parent.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="space-y-0.5 min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">
                    {isRTL ? parent.full_name_ar || parent.full_name : parent.full_name}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {parent.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />{parent.phone}
                      </span>
                    )}
                    {parent.children_count > 0 && (
                      <span className="flex items-center gap-1">
                        <Baby className="h-3 w-3" />{parent.children_count} {isRTL ? 'أطفال' : 'children'}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleLink(parent.id)}
                  disabled={linking === parent.id}
                >
                  {linking === parent.id
                    ? (isRTL ? 'جاري الربط...' : 'Linking...')
                    : (isRTL ? 'ربط' : 'Link')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
