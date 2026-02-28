import { cn } from '@/lib/utils';

interface CodeBlockProps {
  code: string;
  className?: string;
}

export function CodeBlock({ code, className }: CodeBlockProps) {
  if (!code) return null;

  return (
    <div
      dir="ltr"
      className={cn(
        'rounded-lg bg-zinc-900 text-zinc-100 p-4 font-mono text-sm leading-relaxed overflow-x-auto whitespace-pre',
        className
      )}
    >
      {code}
    </div>
  );
}
