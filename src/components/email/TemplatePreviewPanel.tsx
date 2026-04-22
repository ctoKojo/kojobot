import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Eye } from 'lucide-react';
import {
  buildPreviewData,
  renderTemplateWithMissingMarkers,
  type CatalogEvent,
} from '@/lib/templateValidation';

interface Props {
  isRTL: boolean;
  channel: 'email' | 'telegram';
  lang: 'en' | 'ar';
  subject: string;
  body: string;
  events: CatalogEvent[];
  selectedEventKey: string;
  onEventChange: (key: string) => void;
}

/**
 * Deterministic live preview panel.
 * - Uses preview_data from email_event_catalog (set by admins) — same render every time
 * - Shows missing variables with a red "[missing: X]" marker
 */
export function TemplatePreviewPanel({
  isRTL,
  channel,
  lang,
  subject,
  body,
  events,
  selectedEventKey,
  onEventChange,
}: Props) {
  const selectedEvent = useMemo(
    () => events.find((e) => e.event_key === selectedEventKey) ?? null,
    [events, selectedEventKey],
  );

  const data = useMemo(() => buildPreviewData(selectedEvent, lang === 'ar'), [selectedEvent, lang]);

  const renderedSubject = useMemo(
    () => renderTemplateWithMissingMarkers(subject, data),
    [subject, data],
  );
  const renderedBody = useMemo(
    () => renderTemplateWithMissingMarkers(body, data),
    [body, data],
  );

  // Telegram: convert basic markdown (bold, italic, code) to HTML for preview
  const telegramHtml = useMemo(() => {
    if (channel !== 'telegram') return '';
    let html = renderedBody
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:hsl(var(--muted));padding:2px 4px;border-radius:3px">$1</code>')
      .replace(/\n/g, '<br/>');
    return html;
  }, [channel, renderedBody]);

  return (
    <Card className="p-3 space-y-3 sticky top-2">
      <div className="flex items-center gap-2 text-xs font-medium">
        <Eye className="h-3.5 w-3.5" />
        <span>{isRTL ? 'معاينة مباشرة' : 'Live preview'}</span>
        <Badge variant="outline" className="text-[10px] py-0">
          {channel === 'email' ? (isRTL ? 'إيميل' : 'Email') : 'Telegram'}
        </Badge>
        <Badge variant="outline" className="text-[10px] py-0">
          {lang.toUpperCase()}
        </Badge>
      </div>

      <div>
        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">
          {isRTL ? 'حدث للمعاينة' : 'Preview event'}
        </Label>
        <Select value={selectedEventKey} onValueChange={onEventChange}>
          <SelectTrigger className="h-8 text-xs mt-1">
            <SelectValue placeholder={isRTL ? 'اختر حدث' : 'Pick event'} />
          </SelectTrigger>
          <SelectContent>
            {events.map((e) => (
              <SelectItem key={e.event_key} value={e.event_key}>
                {isRTL ? e.display_name_ar : e.display_name_en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {isRTL ? 'الموضوع' : 'Subject'}
          </Label>
          <div
            className="mt-1 px-2 py-1.5 rounded-md border bg-muted/30 text-sm font-medium"
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            dangerouslySetInnerHTML={{ __html: renderedSubject || `<span class="text-muted-foreground">— ${isRTL ? 'فاضي' : 'empty'} —</span>` }}
          />
        </div>

        <div>
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {isRTL ? 'المحتوى' : 'Body'}
          </Label>
          {channel === 'email' ? (
            <iframe
              title="email-preview"
              className="w-full min-h-[420px] mt-1 rounded-md border bg-background"
              srcDoc={`<html dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><body style="margin:0;font-family:Arial,sans-serif">${renderedBody}</body></html>`}
              sandbox="allow-same-origin"
            />
          ) : (
            <div
              className="mt-1 px-3 py-2 rounded-md border bg-[#0e1621] text-[#e8e8e8] text-sm min-h-[200px] whitespace-pre-wrap"
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
              dangerouslySetInnerHTML={{ __html: telegramHtml || `<span style="color:#666">— ${isRTL ? 'فاضي' : 'empty'} —</span>` }}
            />
          )}
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground">
        {isRTL
          ? 'البيانات ثابتة من الحدث المحدد — نفس النتيجة دايماً'
          : 'Deterministic data from selected event — same render every time'}
      </div>
    </Card>
  );
}
