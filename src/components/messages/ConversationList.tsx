import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquarePlus, Search, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NewConversationDialog } from './NewConversationDialog';

interface Participant {
  user_id: string;
  full_name: string;
  full_name_ar: string | null;
  avatar_url: string | null;
  last_read_at: string;
  role?: string;
}

export interface ConversationItem {
  id: string;
  last_message_at: string;
  participants: Participant[];
  last_message?: { content: string; sender_id: string; created_at: string };
  unread_count: number;
}

interface Props {
  conversations: ConversationItem[];
  selectedConversation: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
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

export function ConversationList({
  conversations, selectedConversation, onSelect, isLoading,
  searchQuery, onSearchChange, isRTL, userId
}: Props) {
  const [showNewDialog, setShowNewDialog] = React.useState(false);

  const getOtherParticipant = (conv: ConversationItem) =>
    conv.participants.find(p => p.user_id !== userId) || conv.participants[0];

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const other = getOtherParticipant(conv);
    return other.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (other.full_name_ar || '').includes(searchQuery);
  });

  return (
    <Card className={cn(
      'flex flex-col w-full md:w-80 shrink-0',
      selectedConversation && 'hidden md:flex'
    )}>
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{isRTL ? 'المحادثات' : 'Conversations'}</CardTitle>
          <Button size="icon" variant="ghost" onClick={() => setShowNewDialog(true)}>
            <MessageSquarePlus className="h-5 w-5" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={isRTL ? 'بحث...' : 'Search...'}
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="ps-9 h-9"
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8 px-4">
              <Users className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{isRTL ? 'لا توجد محادثات بعد' : 'No conversations yet'}</p>
              <Button variant="link" size="sm" onClick={() => setShowNewDialog(true)}>
                {isRTL ? 'ابدأ محادثة جديدة' : 'Start a new conversation'}
              </Button>
            </div>
          ) : (
            <div className="space-y-0.5 px-2 pb-2">
              {filteredConversations.map(conv => {
                const other = getOtherParticipant(conv);
                const isSelected = selectedConversation === conv.id;
                return (
                  <button
                    key={conv.id}
                    className={cn(
                      'flex items-center gap-3 w-full p-3 rounded-lg transition-colors text-start',
                      isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                    )}
                    onClick={() => onSelect(conv.id)}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={other.avatar_url || ''} />
                      <AvatarFallback className="text-xs">{getInitials(other.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {isRTL ? (other.full_name_ar || other.full_name) : other.full_name}
                          </p>
                          {getRoleBadge(other.role, isRTL)}
                        </div>
                        {conv.unread_count > 0 && (
                          <Badge variant="default" className="text-xs h-5 w-5 p-0 flex items-center justify-center rounded-full shrink-0">
                            {conv.unread_count}
                          </Badge>
                        )}
                      </div>
                      {conv.last_message && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {conv.last_message.content}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      <NewConversationDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onSelect={onSelect}
        isRTL={isRTL}
        userId={userId}
      />
    </Card>
  );
}
