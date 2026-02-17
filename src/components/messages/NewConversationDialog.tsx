import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (conversationId: string) => void;
  isRTL: boolean;
  userId: string | undefined;
}

const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const getRoleBadge = (role: string | undefined, isRTL: boolean) => {
  if (!role) return null;
  const labels: Record<string, { en: string; ar: string; color: string }> = {
    admin: { en: 'Admin', ar: 'مشرف', color: 'bg-destructive text-destructive-foreground' },
    instructor: { en: 'Instructor', ar: 'مدرب', color: 'bg-primary text-primary-foreground' },
    student: { en: 'Student', ar: 'طالب', color: 'bg-secondary text-secondary-foreground' },
    reception: { en: 'Reception', ar: 'استقبال', color: 'bg-accent text-accent-foreground' },
  };
  const info = labels[role];
  if (!info) return null;
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', info.color)}>
      {isRTL ? info.ar : info.en}
    </span>
  );
};

export function NewConversationDialog({ open, onOpenChange, onSelect, isRTL, userId }: Props) {
  const [userSearch, setUserSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: searchResults = [] } = useQuery({
    queryKey: ['user-search', userSearch],
    queryFn: async () => {
      if (!userSearch || userSearch.length < 2) return [];
      // Get profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, full_name_ar, avatar_url')
        .or(`full_name.ilike.%${userSearch}%,full_name_ar.ilike.%${userSearch}%`)
        .neq('user_id', userId || '')
        .limit(10);

      if (!profiles?.length) return [];

      // Get roles for these users
      const userIds = profiles.map(p => p.user_id);
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const roleMap = Object.fromEntries((roles || []).map(r => [r.user_id, r.role]));
      return profiles.map(p => ({ ...p, role: roleMap[p.user_id] }));
    },
    enabled: userSearch.length >= 2,
  });

  const startConversation = async (targetUserId: string) => {
    if (!userId) return;

    // Check if conversation already exists
    const { data: myConvs } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId);

    if (myConvs?.length) {
      const { data: theirConvs } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', targetUserId)
        .in('conversation_id', myConvs.map(c => c.conversation_id));

      if (theirConvs?.length) {
        for (const conv of theirConvs) {
          const { count } = await supabase
            .from('conversation_participants')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.conversation_id);
          if (count === 2) {
            onSelect(conv.conversation_id);
            onOpenChange(false);
            setUserSearch('');
            return;
          }
        }
      }
    }

    const convId = crypto.randomUUID();
    const { error: convError } = await supabase
      .from('conversations')
      .insert({ id: convId });

    if (convError) {
      toast.error(isRTL ? 'فشل إنشاء المحادثة' : 'Failed to create conversation');
      return;
    }

    const { error: partError } = await supabase.from('conversation_participants').insert([
      { conversation_id: convId, user_id: userId },
      { conversation_id: convId, user_id: targetUserId },
    ]);

    if (partError) {
      toast.error(isRTL ? 'فشل إضافة المشاركين' : 'Failed to add participants');
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    onSelect(convId);
    onOpenChange(false);
    setUserSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isRTL ? 'محادثة جديدة' : 'New Conversation'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={isRTL ? 'ابحث عن مستخدم...' : 'Search for a user...'}
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <ScrollArea className="h-64">
            <div className="space-y-1">
              {searchResults.map((u: any) => (
                <button
                  key={u.user_id}
                  className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-accent transition-colors text-start"
                  onClick={() => startConversation(u.user_id)}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={u.avatar_url || ''} />
                    <AvatarFallback className="text-xs">{getInitials(u.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{isRTL ? (u.full_name_ar || u.full_name) : u.full_name}</p>
                    {getRoleBadge(u.role, isRTL)}
                  </div>
                </button>
              ))}
              {userSearch.length >= 2 && searchResults.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {isRTL ? 'لا توجد نتائج' : 'No results found'}
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
