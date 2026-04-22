import { Pencil, Trash2, Copy, Link2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ChannelStatusIcon } from '@/components/email/ChannelStatusIcon';
import { computeChannelStatus, validateTemplate, type CatalogEvent } from '@/lib/templateValidation';
import type { EmailTemplateRow } from '@/components/email/TemplateEditorDialog';
import { cn } from '@/lib/utils';

interface Props {
  template: EmailTemplateRow;
  isRTL: boolean;
  catalog: CatalogEvent[];
  linkedCount: number;
  selected: boolean;
  onSelect: (next: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleActive: (next: boolean) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export function TemplateCard({
  template,
  isRTL,
  catalog,
  linkedCount,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleActive,
  canEdit,
  canDelete,
}: Props) {
  const validation = validateTemplate(template, catalog);
  const emailStatus = computeChannelStatus(
    !!template.body_html_en?.trim() && !!template.body_html_ar?.trim(),
    validation,
    'email',
    template.last_test_status ?? null,
  );
  const telegramStatus = computeChannelStatus(
    !!template.body_telegram_md_en?.trim() || !!template.body_telegram_md_ar?.trim(),
    validation,
    'telegram',
    template.last_test_status ?? null,
  );

  const audienceLabel = (() => {
    const a = (template as any).audience ?? 'student';
    const map: Record<string, [string, string]> = {
      student: ['Students', 'الطلاب'],
      parent: ['Parents', 'أولياء الأمور'],
      instructor: ['Instructors', 'المدربين'],
      admin: ['Admins', 'الإدارة'],
      reception: ['Reception', 'الاستقبال'],
    };
    const [en, ar] = map[a] ?? [a, a];
    return isRTL ? ar : en;
  })();

  return (
    <Card
      className={cn(
        'group relative transition-all hover:shadow-md hover:border-primary/40',
        selected && 'ring-2 ring-primary border-primary',
        !template.is_active && 'opacity-60',
      )}
    >
      <CardContent className="p-4 space-y-3">
        {/* Top row: checkbox + name + active switch */}
        <div className="flex items-start gap-2">
          <Checkbox
            checked={selected}
            onCheckedChange={(c) => onSelect(!!c)}
            className="mt-1"
            aria-label="Select"
          />
          <button
            onClick={onEdit}
            className="flex-1 min-w-0 text-start hover:text-primary transition-colors"
          >
            <div className="font-semibold truncate">{template.name}</div>
            {template.description && (
              <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {template.description}
              </div>
            )}
          </button>
          <Switch
            checked={template.is_active}
            onCheckedChange={onToggleActive}
            aria-label="Active"
          />
        </div>

        {/* Status row: channels + linked + audience */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <ChannelStatusIcon channel="email" status={emailStatus} isRTL={isRTL} />
          <ChannelStatusIcon channel="telegram" status={telegramStatus} isRTL={isRTL} />
          <Badge variant="secondary" className="text-xs h-5">
            {audienceLabel}
          </Badge>
          {linkedCount > 0 && (
            <Badge variant="outline" className="text-xs h-5 gap-1">
              <Link2 className="h-3 w-3" />
              {linkedCount}
            </Badge>
          )}
        </div>

        {/* Hover actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            {new Date(template.updated_at).toLocaleDateString()}
          </span>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {canEdit && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDuplicate} title={isRTL ? 'نسخ' : 'Duplicate'}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            )}
            {canEdit && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title={isRTL ? 'تعديل' : 'Edit'}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={onDelete}
                title={isRTL ? 'حذف' : 'Delete'}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
