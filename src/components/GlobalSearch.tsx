import { useState, useEffect, useCallback } from 'react';
import { Search, GraduationCap, Users, Calendar, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'student' | 'instructor' | 'group' | 'session';
  url: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const { isRTL } = useLanguage();
  const { role } = useAuth();
  const navigate = useNavigate();

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const searchResults: SearchResult[] = [];
      const searchTerm = `%${q}%`;

      // Search students (admin/reception)
      if (role === 'admin' || role === 'reception') {
        const { data: students } = await supabase
          .from('profiles')
          .select('user_id, full_name, full_name_ar, email')
          .or(`full_name.ilike.${searchTerm},full_name_ar.ilike.${searchTerm},email.ilike.${searchTerm}`)
          .limit(5);

        // Filter to students only
        if (students) {
          const { data: studentRoles } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'student')
            .in('user_id', students.map(s => s.user_id));

          const studentIds = new Set(studentRoles?.map(r => r.user_id) || []);
          students
            .filter(s => studentIds.has(s.user_id))
            .forEach(s => {
              searchResults.push({
                id: s.user_id,
                title: isRTL ? (s.full_name_ar || s.full_name) : s.full_name,
                subtitle: s.email,
                type: 'student',
                url: `/student/${s.user_id}`,
              });
            });
        }
      }

      // Search instructors (admin)
      if (role === 'admin') {
        const { data: instructors } = await supabase
          .from('profiles')
          .select('user_id, full_name, full_name_ar, email')
          .or(`full_name.ilike.${searchTerm},full_name_ar.ilike.${searchTerm},email.ilike.${searchTerm}`)
          .limit(5);

        if (instructors) {
          const { data: instructorRoles } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'instructor')
            .in('user_id', instructors.map(i => i.user_id));

          const instructorIds = new Set(instructorRoles?.map(r => r.user_id) || []);
          instructors
            .filter(i => instructorIds.has(i.user_id))
            .forEach(i => {
              searchResults.push({
                id: i.user_id,
                title: isRTL ? (i.full_name_ar || i.full_name) : i.full_name,
                subtitle: i.email,
                type: 'instructor',
                url: `/instructor/${i.user_id}`,
              });
            });
        }
      }

      // Search groups
      if (role === 'admin' || role === 'instructor' || role === 'reception') {
        const { data: groups } = await supabase
          .from('groups')
          .select('id, name, name_ar, schedule_day, schedule_time')
          .or(`name.ilike.${searchTerm},name_ar.ilike.${searchTerm}`)
          .eq('is_active', true)
          .limit(5);

        groups?.forEach(g => {
          searchResults.push({
            id: g.id,
            title: isRTL ? g.name_ar : g.name,
            subtitle: `${g.schedule_day} - ${g.schedule_time}`,
            type: 'group',
            url: `/group/${g.id}`,
          });
        });
      }

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [role, isRTL]);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleSelect = (url: string) => {
    setOpen(false);
    setQuery('');
    setResults([]);
    navigate(url);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'student': return GraduationCap;
      case 'instructor': return Users;
      case 'group': return Calendar;
      case 'session': return BookOpen;
      default: return Search;
    }
  };

  const getTypeLabel = (type: string) => {
    if (isRTL) {
      switch (type) { case 'student': return 'طالب'; case 'instructor': return 'مدرب'; case 'group': return 'مجموعة'; default: return ''; }
    }
    switch (type) { case 'student': return 'Student'; case 'instructor': return 'Instructor'; case 'group': return 'Group'; default: return ''; }
  };

  if (role === 'student') return null;

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-9 md:w-64 md:justify-start md:px-3 md:py-2"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 md:mr-2" />
        <span className="hidden md:inline-flex text-muted-foreground text-sm">
          {isRTL ? 'بحث...' : 'Search...'}
        </span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 md:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder={isRTL ? 'ابحث عن طلاب، مدربين، مجموعات...' : 'Search students, instructors, groups...'}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {loading
              ? (isRTL ? 'جاري البحث...' : 'Searching...')
              : (isRTL ? 'لا توجد نتائج' : 'No results found.')}
          </CommandEmpty>

          {['student', 'instructor', 'group'].map(type => {
            const typeResults = results.filter(r => r.type === type);
            if (typeResults.length === 0) return null;
            const Icon = getIcon(type);
            return (
              <CommandGroup key={type} heading={getTypeLabel(type)}>
                {typeResults.map(result => (
                  <CommandItem
                    key={result.id}
                    value={result.title}
                    onSelect={() => handleSelect(result.url)}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{result.title}</span>
                      {result.subtitle && (
                        <span className="text-xs text-muted-foreground">{result.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
