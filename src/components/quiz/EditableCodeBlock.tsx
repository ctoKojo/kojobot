import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface EditableCodeBlockProps {
  code: string | undefined;
  onChange: (code: string | undefined) => void;
  isRTL: boolean;
}

export function EditableCodeBlock({ code, onChange, isRTL }: EditableCodeBlockProps) {
  if (!code && code !== '') return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{isRTL ? 'كود برمجي' : 'Code Snippet'}</Label>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-destructive hover:text-destructive"
          onClick={() => onChange(undefined)}
        >
          <X className="w-3 h-3 mr-1" />
          {isRTL ? 'مسح' : 'Clear'}
        </Button>
      </div>
      <Textarea
        dir="ltr"
        value={code}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="font-mono text-sm bg-zinc-900 text-zinc-100 border-zinc-700 min-h-[80px]"
        placeholder="x = 5&#10;print(x)"
      />
    </div>
  );
}
