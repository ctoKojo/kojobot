import { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export type PaymentMethod = 'cash' | 'transfer';
export type TransferType = 'bank' | 'instapay' | 'wallet';

export interface PaymentMethodValue {
  payment_method: PaymentMethod;
  transfer_type: TransferType | null;
  /** local file selected by user — uploaded later via uploadReceipt() */
  receipt_file: File | null;
}

export interface PaymentMethodFieldsHandle {
  /** Validates current state for submit. Returns false + shows toast if invalid. */
  validate(): boolean;
  /** Uploads receipt to: {folder}/{recordId}/{uuid}.{ext}. Returns the storage path. */
  uploadReceipt(folder: 'payments' | 'expenses' | 'salaries', recordId: string): Promise<string>;
  /** Whether a file is required and present. */
  hasFile(): boolean;
}

interface Props {
  value: PaymentMethodValue;
  onChange: (v: PaymentMethodValue) => void;
  disabled?: boolean;
  className?: string;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 5 * 1024 * 1024;

export const PaymentMethodFields = forwardRef<PaymentMethodFieldsHandle, Props>(
  ({ value, onChange, disabled, className }, ref) => {
    const { isRTL } = useLanguage();
    const { toast } = useToast();
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const isTransfer = value.payment_method === 'transfer';

    const handleFile = (f: File | null) => {
      if (!f) {
        onChange({ ...value, receipt_file: null });
        return;
      }
      if (!ACCEPTED.includes(f.type)) {
        toast({
          variant: 'destructive',
          title: isRTL ? 'نوع ملف غير مدعوم' : 'Unsupported file',
          description: isRTL ? 'JPG / PNG / WEBP / PDF فقط' : 'JPG / PNG / WEBP / PDF only',
        });
        return;
      }
      if (f.size > MAX_BYTES) {
        toast({
          variant: 'destructive',
          title: isRTL ? 'الملف كبير' : 'File too large',
          description: isRTL ? 'الحد الأقصى 5 ميجا' : 'Max 5MB',
        });
        return;
      }
      onChange({ ...value, receipt_file: f });
    };

    useImperativeHandle(ref, () => ({
      validate: () => {
        if (value.payment_method === 'cash') return true;
        if (!value.transfer_type) {
          toast({
            variant: 'destructive',
            title: isRTL ? 'بيانات ناقصة' : 'Missing info',
            description: isRTL ? 'حدد نوع التحويل' : 'Select transfer type',
          });
          return false;
        }
        if (!value.receipt_file) {
          toast({
            variant: 'destructive',
            title: isRTL ? 'إيصال مطلوب' : 'Receipt required',
            description: isRTL ? 'ارفق صورة أو PDF لإيصال التحويل' : 'Attach receipt image or PDF',
          });
          return false;
        }
        return true;
      },
      hasFile: () => !!value.receipt_file,
      uploadReceipt: async (folder, recordId) => {
        if (!value.receipt_file) throw new Error('No receipt file');
        setUploading(true);
        try {
          const ext = (value.receipt_file.name.split('.').pop() || 'bin').toLowerCase();
          const uuid = crypto.randomUUID();
          const path = `${folder}/${recordId}/${uuid}.${ext}`;
          const { error } = await supabase.storage
            .from('payment-receipts')
            .upload(path, value.receipt_file, {
              contentType: value.receipt_file.type,
              upsert: false,
            });
          if (error) throw error;
          return path;
        } finally {
          setUploading(false);
        }
      },
    }));

    return (
      <div className={cn('space-y-3', className)}>
        <div>
          <Label>{isRTL ? 'طريقة الدفع' : 'Payment Method'}</Label>
          <Select
            value={value.payment_method}
            onValueChange={(v: PaymentMethod) =>
              onChange({
                payment_method: v,
                transfer_type: v === 'cash' ? null : value.transfer_type,
                receipt_file: v === 'cash' ? null : value.receipt_file,
              })
            }
            disabled={disabled}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">{isRTL ? 'كاش' : 'Cash'}</SelectItem>
              <SelectItem value="transfer">{isRTL ? 'تحويل' : 'Transfer'}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isTransfer && (
          <>
            <div>
              <Label>{isRTL ? 'نوع التحويل' : 'Transfer Type'} *</Label>
              <Select
                value={value.transfer_type ?? ''}
                onValueChange={(v: TransferType) => onChange({ ...value, transfer_type: v })}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isRTL ? 'اختر النوع' : 'Select type'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">{isRTL ? 'تحويل بنكي' : 'Bank Transfer'}</SelectItem>
                  <SelectItem value="instapay">{isRTL ? 'إنستا باي' : 'InstaPay'}</SelectItem>
                  <SelectItem value="wallet">{isRTL ? 'محفظة إلكترونية' : 'E-Wallet'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{isRTL ? 'إيصال التحويل' : 'Transfer Receipt'} *</Label>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                disabled={disabled || uploading}
              />
              {value.receipt_file ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm truncate flex-1">{value.receipt_file.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {(value.receipt_file.size / 1024).toFixed(0)} KB
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => handleFile(null)}
                    disabled={disabled || uploading}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => inputRef.current?.click()}
                  disabled={disabled || uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {isRTL ? 'رفع إيصال (JPG/PNG/PDF — حد أقصى 5MB)' : 'Upload receipt (JPG/PNG/PDF — max 5MB)'}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    );
  }
);

PaymentMethodFields.displayName = 'PaymentMethodFields';

export const initialPaymentMethodValue: PaymentMethodValue = {
  payment_method: 'cash',
  transfer_type: null,
  receipt_file: null,
};
