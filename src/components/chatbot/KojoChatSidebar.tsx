import React from 'react';
import { Plus, MessageCircle, Trash2, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Conversation {
  id: string;
  title: string;
  last_message_at: string;
  status: string;
}

interface KojoChatSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}

export function KojoChatSidebar({ conversations, activeId, onSelect, onNew, onDelete, loading }: KojoChatSidebarProps) {
  const { isRTL } = useLanguage();

  return (
    <div className="w-full h-full flex flex-col border-e bg-muted/30">
      <div className="p-3 border-b">
        <Button onClick={onNew} className="w-full gap-2" size="sm">
          <Plus className="w-4 h-4" />
          {isRTL ? 'اسأل Kojo' : 'Ask Kojo'}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              {isRTL ? 'جاري التحميل...' : 'Loading...'}
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              {isRTL ? 'لا توجد محادثات' : 'No conversations'}
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  'group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors text-sm',
                  activeId === conv.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-muted text-foreground/80'
                )}
                onClick={() => onSelect(conv.id)}
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="truncate" dir="rtl" style={{ unicodeBidi: 'plaintext' }}>
                    {conv.title || (isRTL ? 'محادثة جديدة' : 'New conversation')}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(conv.last_message_at), {
                      addSuffix: true,
                      locale: isRTL ? ar : undefined,
                    })}
                  </p>
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
