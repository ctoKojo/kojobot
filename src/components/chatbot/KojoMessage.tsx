import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KojoMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export function KojoMessage({ role, content, isStreaming }: KojoMessageProps) {
  const isKojo = role === 'assistant';

  return (
    <div className={cn('flex gap-3 mb-4', isKojo ? '' : 'flex-row-reverse')}>
      {/* Avatar */}
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
        isKojo ? 'bg-primary/10' : 'bg-muted'
      )}>
        {isKojo ? (
          <Bot className="w-4 h-4 text-primary" />
        ) : (
          <User className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {/* Message */}
      <div className={cn('max-w-[80%] flex flex-col gap-1', isKojo ? 'items-start' : 'items-end')}>
        {isKojo && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">
            Kojo
          </Badge>
        )}
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isKojo
              ? 'bg-muted text-foreground rounded-tl-sm'
              : 'bg-primary text-primary-foreground rounded-tr-sm'
          )}
          dir="rtl"
          style={{ unicodeBidi: 'plaintext' }}
        >
          {isKojo ? (
            <div className="prose prose-sm dark:prose-invert max-w-none [&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline [&_pre]:bg-background/50 [&_pre]:rounded-lg [&_pre]:p-3 [&_code]:text-xs">
              <ReactMarkdown
                components={{
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="nofollow noopener noreferrer">
                      {children}
                    </a>
                  ),
                  // Sanitize: strip raw HTML
                  // @ts-ignore
                  html: () => null,
                }}
              >
                {content}
              </ReactMarkdown>
              {isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-primary/50 animate-pulse ml-1" />
              )}
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{content}</p>
          )}
        </div>
      </div>
    </div>
  );
}
