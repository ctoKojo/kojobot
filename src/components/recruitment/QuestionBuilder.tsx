import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Plus, Lock, ChevronDown, ChevronUp, X } from "lucide-react";
import {
  JobFormField,
  RESERVED_FIELDS,
  QUESTION_LIBRARY,
  FIELD_TYPES,
  generateFieldKey,
} from "./QuestionLibrary";

interface QuestionBuilderProps {
  fields: JobFormField[];
  onChange: (fields: JobFormField[]) => void;
  contentLanguage: "en" | "ar" | "both";
}

export function QuestionBuilder({ fields, onChange, contentLanguage }: QuestionBuilderProps) {
  const { isRTL } = useLanguage();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [librarySelect, setLibrarySelect] = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Ensure reserved fields are always at the start
  const reservedKeys = RESERVED_FIELDS.map((f) => f.key);
  const reservedInList = fields.filter((f) => reservedKeys.includes(f.key));
  const customFields = fields.filter((f) => !reservedKeys.includes(f.key));

  // If any reserved missing, top up
  const missingReserved = RESERVED_FIELDS.filter((rf) => !reservedInList.find((f) => f.key === rf.key));
  const allReserved = [...reservedInList, ...missingReserved].sort(
    (a, b) => reservedKeys.indexOf(a.key) - reservedKeys.indexOf(b.key)
  );

  const updateField = (key: string, patch: Partial<JobFormField>) => {
    onChange(fields.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  };

  const removeField = (key: string) => {
    if (reservedKeys.includes(key)) return;
    onChange(fields.filter((f) => f.key !== key));
  };

  const addFromLibrary = (template: JobFormField) => {
    if (fields.find((f) => f.key === template.key)) {
      return; // already added
    }
    onChange([...allReserved, ...customFields, { ...template }]);
    setExpanded({ ...expanded, [template.key]: true });
  };

  const addBlank = () => {
    const key = generateFieldKey("question", fields.map((f) => f.key));
    const newField: JobFormField = {
      key,
      type: "short_text",
      label_en: "New Question",
      label_ar: "سؤال جديد",
    };
    onChange([...allReserved, ...customFields, newField]);
    setExpanded({ ...expanded, [key]: true });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = customFields.findIndex((f) => f.key === active.id);
    const newIdx = customFields.findIndex((f) => f.key === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(customFields, oldIdx, newIdx);
    onChange([...allReserved, ...reordered]);
  };

  const usedLibraryKeys = new Set(fields.map((f) => f.key));
  const availableLibrary = QUESTION_LIBRARY.filter((q) => !usedLibraryKeys.has(q.key));

  return (
    <div className="space-y-4">
      {/* Reserved fields */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Lock className="w-3 h-3" />
          {isRTL ? "حقول أساسية (دائماً موجودة)" : "Core Fields (always required)"}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {allReserved.map((f) => (
            <Card key={f.key} className="p-3 bg-muted/40 flex items-center justify-between">
              <div className="text-sm font-medium">{isRTL ? f.label_ar : f.label_en}</div>
              <Badge variant="secondary" className="text-xs">{f.type}</Badge>
            </Card>
          ))}
        </div>
      </div>

      {/* Add question controls */}
      <Card className="p-3 border-primary/20 bg-primary/5">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          {isRTL ? "إضافة سؤال جديد" : "Add a New Question"}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 items-stretch">
          <Select
            value={librarySelect}
            onValueChange={(v) => {
              setLibrarySelect(v);
              const tpl = QUESTION_LIBRARY.find((q) => q.key === v);
              if (tpl) {
                addFromLibrary(tpl);
                setLibrarySelect("");
              }
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={isRTL ? "اختر سؤال جاهز من المكتبة..." : "Pick a ready-made question..."} />
            </SelectTrigger>
            <SelectContent className="max-h-72 bg-popover z-50">
              {availableLibrary.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  {isRTL ? "كل أسئلة المكتبة مضافة بالفعل" : "All library questions are already added"}
                </div>
              ) : (
                availableLibrary.map((q) => (
                  <SelectItem key={q.key} value={q.key}>
                    <div className="flex items-center gap-2">
                      <span>{isRTL ? q.label_ar : q.label_en}</span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1">{q.type}</Badge>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <div className="hidden md:flex items-center text-xs text-muted-foreground px-2">
            {isRTL ? "أو" : "or"}
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addBlank} className="h-9">
            <Plus className="w-4 h-4 me-1" />
            {isRTL ? "سؤال مخصص" : "Custom Question"}
          </Button>
        </div>
      </Card>

      {/* Custom fields list */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {isRTL ? "أسئلة مخصصة" : "Custom Questions"}
          <span className="ms-2 text-foreground">({customFields.length})</span>
        </div>

        {customFields.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">
            {isRTL
              ? "لا توجد أسئلة إضافية. اضغط مكتبة الأسئلة أو سؤال مخصص للبدء."
              : "No custom questions yet. Click Question Library or Custom to start."}
          </Card>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={customFields.map((f) => f.key)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {customFields.map((f) => (
                  <SortableQuestionCard
                    key={f.key}
                    field={f}
                    expanded={!!expanded[f.key]}
                    onToggle={() => setExpanded({ ...expanded, [f.key]: !expanded[f.key] })}
                    onUpdate={(patch) => updateField(f.key, patch)}
                    onRemove={() => removeField(f.key)}
                    contentLanguage={contentLanguage}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

interface SortableQuestionCardProps {
  field: JobFormField;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<JobFormField>) => void;
  onRemove: () => void;
  contentLanguage: "en" | "ar" | "both";
}

function SortableQuestionCard({
  field,
  expanded,
  onToggle,
  onUpdate,
  onRemove,
  contentLanguage,
}: SortableQuestionCardProps) {
  const { isRTL } = useLanguage();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.key });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const showEn = contentLanguage === "en" || contentLanguage === "both";
  const showAr = contentLanguage === "ar" || contentLanguage === "both";
  const primaryLabel = contentLanguage === "ar" ? field.label_ar : field.label_en;

  const updateOption = (idx: number, patch: Partial<NonNullable<JobFormField["options"]>[number]>) => {
    const opts = [...(field.options || [])];
    opts[idx] = { ...opts[idx], ...patch };
    onUpdate({ options: opts });
  };
  const addOption = () => {
    const opts = [...(field.options || [])];
    opts.push({ value: `opt_${opts.length + 1}`, label_en: `Option ${opts.length + 1}`, label_ar: `خيار ${opts.length + 1}` });
    onUpdate({ options: opts });
  };
  const removeOption = (idx: number) => {
    const opts = [...(field.options || [])];
    opts.splice(idx, 1);
    onUpdate({ options: opts });
  };

  const needsOptions = field.type === "single_choice" || field.type === "multi_choice";

  return (
    <Card ref={setNodeRef} style={style} className="p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          aria-label="Drag"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{primaryLabel || field.key}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="text-[10px] h-4">{field.type}</Badge>
            {field.required && <Badge variant="secondary" className="text-[10px] h-4">{isRTL ? "إجباري" : "Required"}</Badge>}
          </div>
        </div>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onToggle}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onRemove}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{isRTL ? "النوع" : "Type"}</Label>
              <Select value={field.type} onValueChange={(v) => onUpdate({ type: v as JobFormField["type"] })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{isRTL ? t.label_ar : t.label_en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch checked={!!field.required} onCheckedChange={(v) => onUpdate({ required: v })} />
              <Label className="text-xs">{isRTL ? "إجباري" : "Required"}</Label>
            </div>
          </div>

          <div className={`grid gap-2 ${contentLanguage === "both" ? "grid-cols-2" : "grid-cols-1"}`}>
            {showEn && (
              <div>
                <Label className="text-xs">{isRTL ? "النص (إنجليزي)" : "Label (English)"}</Label>
                <Input
                  className="h-9"
                  value={field.label_en}
                  onChange={(e) => {
                    const v = e.target.value;
                    onUpdate(contentLanguage === "en" ? { label_en: v, label_ar: v } : { label_en: v });
                  }}
                />
              </div>
            )}
            {showAr && (
              <div>
                <Label className="text-xs">{isRTL ? "النص (عربي)" : "Label (Arabic)"}</Label>
                <Input
                  className="h-9"
                  dir="rtl"
                  value={field.label_ar}
                  onChange={(e) => {
                    const v = e.target.value;
                    onUpdate(contentLanguage === "ar" ? { label_ar: v, label_en: v } : { label_ar: v });
                  }}
                />
              </div>
            )}
          </div>

          {(field.type === "short_text" || field.type === "long_text" || field.type === "email" || field.type === "phone" || field.type === "number" || field.type === "url") && (
            <div className={`grid gap-2 ${contentLanguage === "both" ? "grid-cols-2" : "grid-cols-1"}`}>
              {showEn && (
                <div>
                  <Label className="text-xs">{isRTL ? "Placeholder (إنجليزي)" : "Placeholder (English)"}</Label>
                  <Input
                    className="h-9"
                    value={field.placeholder_en || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      onUpdate(contentLanguage === "en" ? { placeholder_en: v, placeholder_ar: v } : { placeholder_en: v });
                    }}
                  />
                </div>
              )}
              {showAr && (
                <div>
                  <Label className="text-xs">{isRTL ? "Placeholder (عربي)" : "Placeholder (Arabic)"}</Label>
                  <Input
                    className="h-9"
                    dir="rtl"
                    value={field.placeholder_ar || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      onUpdate(contentLanguage === "ar" ? { placeholder_ar: v, placeholder_en: v } : { placeholder_ar: v });
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {needsOptions && (
            <div>
              <Label className="text-xs mb-2 block">{isRTL ? "الخيارات" : "Options"}</Label>
              <div className="space-y-2">
                {(field.options || []).map((opt, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    {showEn && (
                      <Input
                        className="h-8 text-xs"
                        placeholder={isRTL ? "إنجليزي" : "English"}
                        value={opt.label_en}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateOption(idx, contentLanguage === "en" ? { label_en: v, label_ar: v } : { label_en: v });
                        }}
                      />
                    )}
                    {showAr && (
                      <Input
                        className="h-8 text-xs"
                        dir="rtl"
                        placeholder={isRTL ? "عربي" : "Arabic"}
                        value={opt.label_ar}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateOption(idx, contentLanguage === "ar" ? { label_ar: v, label_en: v } : { label_ar: v });
                        }}
                      />
                    )}
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeOption(idx)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" onClick={addOption}>
                  <Plus className="w-3 h-3 me-1" /> {isRTL ? "إضافة خيار" : "Add Option"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
