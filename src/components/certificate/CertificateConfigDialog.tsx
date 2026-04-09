import { useState, useEffect, useCallback, useRef } from 'react';
import { Award, Settings2, Loader2, Crosshair } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CertificateConfig {
  anchor_type: 'baseline' | 'bottom' | 'center';
  anchor_y_percent: number;
  font_size: number;
  font_color_hex: string;
  font_key: string;
  x_offset_px: number;
  max_name_width_percent: number;
}

const DEFAULT_CONFIG: CertificateConfig = {
  anchor_type: 'bottom',
  anchor_y_percent: 52,
  font_size: 42,
  font_color_hex: '#1B2A4A',
  font_key: 'playfair_italic',
  x_offset_px: 0,
  max_name_width_percent: 80,
};

const FONT_OPTIONS = [
  { key: 'poppins_semibold', label: 'Poppins SemiBold' },
  { key: 'playfair_italic', label: 'Playfair Display Italic' },
];

const ANCHOR_OPTIONS: { value: CertificateConfig['anchor_type']; label: string; labelAr: string }[] = [
  { value: 'bottom', label: 'Bottom of text', labelAr: 'أسفل النص' },
  { value: 'center', label: 'Center of text', labelAr: 'منتصف النص' },
  { value: 'baseline', label: 'Baseline (raw)', labelAr: 'خط الأساس' },
];

const PREVIEW_NAME = 'Mahmoud Hossam Mahmoud';

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/** Parse old or new config shape */
function parseConfig(raw: Record<string, unknown>): CertificateConfig {
  return {
    anchor_type: (raw.anchor_type as CertificateConfig['anchor_type']) ?? DEFAULT_CONFIG.anchor_type,
    anchor_y_percent: (raw.anchor_y_percent as number) ?? (raw.name_y_percent as number) ?? DEFAULT_CONFIG.anchor_y_percent,
    font_size: (raw.font_size as number) ?? DEFAULT_CONFIG.font_size,
    font_color_hex: (raw.font_color_hex as string) ?? DEFAULT_CONFIG.font_color_hex,
    font_key: (raw.font_key as string) ?? DEFAULT_CONFIG.font_key,
    x_offset_px: (raw.x_offset_px as number) ?? DEFAULT_CONFIG.x_offset_px,
    max_name_width_percent: (raw.max_name_width_percent as number) ?? DEFAULT_CONFIG.max_name_width_percent,
  };
}

export function CertificateConfigDialog({ levelId, levelName }: { levelId: string; levelName: string }) {
  const { isRTL } = useLanguage();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<CertificateConfig>(DEFAULT_CONFIG);
  const [templatePath, setTemplatePath] = useState('');
  const [saving, setSaving] = useState(false);
  const [templateImg, setTemplateImg] = useState<HTMLImageElement | null>(null);
  const [templateAspect, setTemplateAspect] = useState(595 / 842); // default A4
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open) loadConfig();
  }, [open, levelId]);

  const loadConfig = async () => {
    const { data } = await supabase
      .from('levels')
      .select('certificate_config, certificate_template_path')
      .eq('id', levelId)
      .single();

    if (data) {
      const raw = (data as any).certificate_config || {};
      setConfig(parseConfig(raw));
      const path = (data as any).certificate_template_path || '';
      setTemplatePath(path);
      if (path) loadTemplatePreview(path);
    }
  };

  const loadTemplatePreview = async (path: string) => {
    try {
      const { data } = await supabase.storage.from('certificates').createSignedUrl(path, 300);
      if (!data?.signedUrl) return;

      // Use pdfjs to render first page as image
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

      const pdf = await pdfjsLib.getDocument(data.signedUrl).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });

      const offscreen = document.createElement('canvas');
      offscreen.width = viewport.width;
      offscreen.height = viewport.height;
      const offCtx = offscreen.getContext('2d')!;
      await page.render({ canvasContext: offCtx, viewport }).promise;

      const img = new Image();
      img.src = offscreen.toDataURL('image/png');
      img.onload = () => {
        setTemplateImg(img);
        setTemplateAspect(viewport.width / viewport.height);
      };
    } catch (err) {
      console.warn('Could not render template preview:', err);
    }
  };

  // Draw preview on canvas
  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Size canvas to match template aspect ratio
    const W = canvas.width;
    const H = Math.round(W / templateAspect);
    canvas.height = H;

    ctx.clearRect(0, 0, W, H);

    // Draw template image or placeholder
    if (templateImg) {
      ctx.drawImage(templateImg, 0, 0, W, H);
    } else {
      ctx.fillStyle = '#f5f0e8';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#c4a86d';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, W - 20, H - 20);
      ctx.fillStyle = '#999';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('[ Certificate Template ]', W / 2, 40);
    }

    // Draw reference line at anchor_y
    const anchorYPx = H - (H * config.anchor_y_percent / 100);
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, anchorYPx);
    ctx.lineTo(W - 20, anchorYPx);
    ctx.stroke();
    ctx.setLineDash([]);

    // Compute font size scaled to preview
    const scaleFactor = W / 595;
    const fontSize = config.font_size * scaleFactor;

    const ascent = fontSize * 0.85;
    const descent = fontSize * 0.22;

    let drawY: number;
    switch (config.anchor_type) {
      case 'bottom':
        drawY = anchorYPx - descent;
        break;
      case 'center': {
        const textH = ascent + descent;
        drawY = anchorYPx + textH / 2 - descent;
        break;
      }
      case 'baseline':
      default:
        drawY = anchorYPx;
    }

    ctx.fillStyle = config.font_color_hex;
    ctx.font = `italic ${fontSize}px serif`;
    ctx.textAlign = 'center';
    const xPos = W / 2 + config.x_offset_px * scaleFactor;
    ctx.fillText(PREVIEW_NAME, xPos, drawY);

    ctx.fillStyle = '#e74c3c';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`anchor ${config.anchor_y_percent}%`, 22, anchorYPx - 4);
  }, [config, templateImg, templateAspect]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  const handleSnapCenter = () => {
    setConfig(c => ({ ...c, x_offset_px: 0 }));
  };

  const validate = (): string | null => {
    if (config.font_size < 16 || config.font_size > 120) return isRTL ? 'حجم الخط لازم يكون بين 16 و 120' : 'Font size must be 16-120';
    if (config.anchor_y_percent < 0 || config.anchor_y_percent > 100) return isRTL ? 'موضع Y لازم يكون بين 0 و 100' : 'Y position must be 0-100';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }

    setSaving(true);
    const { error } = await supabase
      .from('levels')
      .update({
        certificate_config: config as any,
        certificate_template_path: templatePath || null,
      })
      .eq('id', levelId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isRTL ? 'تم حفظ الإعدادات' : 'Settings saved');
      setOpen(false);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Award className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{isRTL ? 'إعدادات الشهادة' : 'Certificate'}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            {isRTL ? `إعدادات شهادة ${levelName}` : `${levelName} Certificate Settings`}
          </DialogTitle>
          <DialogDescription>
            {isRTL
              ? 'ظبط مكان وشكل اسم الطالب على الشهادة — التغييرات تظهر في البريفيو فورا'
              : 'Configure student name placement — changes preview live'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Live Preview */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">{isRTL ? 'معاينة حية' : 'Live Preview'}</Label>
            <canvas
              ref={canvasRef}
              width={400}
              height={280}
              className="w-full rounded-lg border bg-muted/20"
              style={{ imageRendering: 'auto' }}
            />
            <p className="text-[10px] text-muted-foreground">
              {isRTL ? 'الخط الأحمر = موضع الـ anchor' : 'Red line = anchor position'}
            </p>
          </div>

          {/* Template path */}
          <div className="space-y-1">
            <Label className="text-xs">{isRTL ? 'مسار التيمبلت' : 'Template Path'}</Label>
            <Input
              value={templatePath}
              onChange={(e) => setTemplatePath(e.target.value)}
              placeholder="templates/LEVEL1.pdf"
              dir="ltr"
              className="h-8 text-xs"
            />
          </div>

          {/* Font + Anchor Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{isRTL ? 'الخط' : 'Font'}</Label>
              <Select value={config.font_key} onValueChange={v => setConfig(c => ({ ...c, font_key: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{isRTL ? 'نوع المرساة' : 'Anchor Type'}</Label>
              <Select value={config.anchor_type} onValueChange={v => setConfig(c => ({ ...c, anchor_type: v as CertificateConfig['anchor_type'] }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANCHOR_OPTIONS.map(a => <SelectItem key={a.value} value={a.value}>{isRTL ? a.labelAr : a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Y Position */}
          <div className="space-y-1">
            <Label className="text-xs">{isRTL ? 'موضع Y (% من الأسفل)' : 'Y Position (% from bottom)'}</Label>
            <div className="flex items-center gap-2">
              <Slider
                value={[config.anchor_y_percent]}
                onValueChange={([v]) => setConfig(c => ({ ...c, anchor_y_percent: v }))}
                min={0}
                max={100}
                step={0.1}
                className="flex-1"
              />
              <Input
                type="number"
                value={config.anchor_y_percent}
                onChange={(e) => setConfig(c => ({ ...c, anchor_y_percent: clamp(parseFloat(e.target.value) || 0, 0, 100) }))}
                className="w-20 h-7 text-xs font-mono text-center"
                step={0.1}
                min={0}
                max={100}
              />
            </div>
          </div>

          {/* Font size */}
          <div className="space-y-1">
            <Label className="text-xs">{isRTL ? 'حجم الخط' : 'Font Size'}</Label>
            <div className="flex items-center gap-2">
              <Slider
                value={[config.font_size]}
                onValueChange={([v]) => setConfig(c => ({ ...c, font_size: clamp(v, 8, 120) }))}
                min={8}
                max={120}
                step={1}
                className="flex-1"
              />
              <Input
                type="number"
                value={config.font_size}
                onChange={(e) => setConfig(c => ({ ...c, font_size: clamp(parseInt(e.target.value) || 16, 8, 120) }))}
                className="w-20 h-7 text-xs font-mono text-center"
                step={1}
                min={8}
                max={120}
              />
            </div>
          </div>

          {/* X Offset */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{isRTL ? 'إزاحة X (بكسل)' : 'X Offset (px)'}</Label>
              <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px]" onClick={handleSnapCenter}>
                <Crosshair className="h-3 w-3 mr-0.5" />
                {isRTL ? 'توسيط' : 'Center'}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Slider
                value={[config.x_offset_px]}
                onValueChange={([v]) => setConfig(c => ({ ...c, x_offset_px: v }))}
                min={-200}
                max={200}
                step={1}
                className="flex-1"
              />
              <Input
                type="number"
                value={config.x_offset_px}
                onChange={(e) => setConfig(c => ({ ...c, x_offset_px: clamp(parseInt(e.target.value) || 0, -200, 200) }))}
                className="w-20 h-7 text-xs font-mono text-center"
                step={1}
                min={-200}
                max={200}
              />
            </div>
          </div>

          {/* Color */}
          <div className="space-y-1">
            <Label className="text-xs">{isRTL ? 'لون الخط' : 'Font Color'}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.font_color_hex}
                onChange={(e) => setConfig(c => ({ ...c, font_color_hex: e.target.value }))}
                className="h-8 w-12 rounded border cursor-pointer"
              />
              <Input
                value={config.font_color_hex}
                onChange={(e) => setConfig(c => ({ ...c, font_color_hex: e.target.value }))}
                className="flex-1 font-mono h-8 text-xs"
                dir="ltr"
                maxLength={7}
              />
            </div>
          </div>

          {/* Max width */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{isRTL ? 'أقصى عرض للاسم %' : 'Max Name Width %'}</Label>
              <span className="text-xs font-mono text-muted-foreground">{config.max_name_width_percent}%</span>
            </div>
            <Slider
              value={[config.max_name_width_percent]}
              onValueChange={([v]) => setConfig(c => ({ ...c, max_name_width_percent: clamp(v, 30, 100) }))}
              min={30}
              max={100}
              step={1}
            />
            <p className="text-[10px] text-muted-foreground">
              {isRTL ? 'لو الاسم أعرض من كده الخط يصغر تلقائي' : 'Name auto-scales down if wider than this'}
            </p>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium">{isRTL ? 'ملاحظة:' : 'Note:'}</p>
            <p>{isRTL
              ? 'بعد التعديل، اعمل "إعادة توليد" للشهادات الموجودة من بروفايل الطالب'
              : 'After changes, use "Regenerate" on existing certificates from student profile'}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isRTL ? 'حفظ' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
