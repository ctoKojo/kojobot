import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRightLeft, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface TreasuryBalance {
  account_code: string;
  account_name: string;
  account_name_ar: string;
  balance: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balances: TreasuryBalance[];
}

const formatEGP = (n: number) =>
  new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 2,
  }).format(n);

const ACCOUNT_OPTIONS = [
  { code: '1110', name: 'Cash on Hand', nameAr: 'النقدية بالخزينة' },
  { code: '1120', name: 'Bank Account', nameAr: 'الحساب البنكي' },
  { code: '1130', name: 'InstaPay Wallet', nameAr: 'محفظة إنستا باي' },
  { code: '1140', name: 'E-Wallet', nameAr: 'المحفظة الإلكترونية' },
];

export function TreasuryTransferDialog({ open, onOpenChange, balances }: Props) {
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();

  const [fromCode, setFromCode] = useState<string>('');
  const [toCode, setToCode] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [transferDate, setTransferDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState<string>('');

  const balanceMap = useMemo(() => {
    const m = new Map<string, number>();
    balances.forEach((b) => m.set(b.account_code, Number(b.balance)));
    return m;
  }, [balances]);

  const fromBalance = fromCode ? balanceMap.get(fromCode) ?? 0 : 0;
  const numericAmount = parseFloat(amount);
  const isValidAmount =
    isFinite(numericAmount) && numericAmount > 0 && numericAmount <= fromBalance;
  const canSubmit =
    !!fromCode && !!toCode && fromCode !== toCode && isValidAmount;

  const reset = () => {
    setFromCode('');
    setToCode('');
    setAmount('');
    setTransferDate(new Date().toISOString().slice(0, 10));
    setNotes('');
  };

  const transferMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)('transfer_treasury_funds', {
        p_from_code: fromCode,
        p_to_code: toCode,
        p_amount: numericAmount,
        p_transfer_date: transferDate,
        p_notes: notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (result: any) => {
      toast.success(
        isRTL
          ? `تم التحويل بنجاح • سند: ${result.voucher_no}`
          : `Transfer posted • Voucher: ${result.voucher_no}`,
      );
      queryClient.invalidateQueries({ queryKey: ['treasury-balances'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-reconciliation'] });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast.error(e.message ?? (isRTL ? 'فشل التحويل' : 'Transfer failed'));
    },
  });

  const fromOption = ACCOUNT_OPTIONS.find((o) => o.code === fromCode);
  const toOption = ACCOUNT_OPTIONS.find((o) => o.code === toCode);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            {isRTL ? 'تحويل بين حسابات الخزينة' : 'Transfer Between Treasury Accounts'}
          </DialogTitle>
          <DialogDescription>
            {isRTL
              ? 'يولد قيد محاسبي مزدوج تلقائياً ويحدّث أرصدة الحسابين فوراً'
              : 'Generates a balanced journal entry and updates balances instantly'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* From */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {isRTL ? 'من حساب' : 'From account'}
            </Label>
            <Select value={fromCode} onValueChange={setFromCode}>
              <SelectTrigger>
                <SelectValue placeholder={isRTL ? 'اختر الحساب المصدر' : 'Select source'} />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_OPTIONS.map((opt) => {
                  const bal = balanceMap.get(opt.code) ?? 0;
                  return (
                    <SelectItem key={opt.code} value={opt.code} disabled={opt.code === toCode}>
                      <div className="flex items-center justify-between gap-3 w-full">
                        <span>{isRTL ? opt.nameAr : opt.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatEGP(bal)}
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {fromCode && (
              <p className="text-xs text-muted-foreground">
                {isRTL ? 'الرصيد المتاح:' : 'Available:'}{' '}
                <span className="font-semibold">{formatEGP(fromBalance)}</span>
              </p>
            )}
          </div>

          {/* To */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {isRTL ? 'إلى حساب' : 'To account'}
            </Label>
            <Select value={toCode} onValueChange={setToCode}>
              <SelectTrigger>
                <SelectValue placeholder={isRTL ? 'اختر الحساب المستلم' : 'Select destination'} />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.code}
                    value={opt.code}
                    disabled={opt.code === fromCode}
                  >
                    {isRTL ? opt.nameAr : opt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {isRTL ? 'المبلغ (جنيه)' : 'Amount (EGP)'}
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              max={fromBalance || undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
            {amount && !isValidAmount && fromCode && (
              <p className="text-xs text-destructive">
                {numericAmount > fromBalance
                  ? isRTL
                    ? 'المبلغ يتجاوز الرصيد المتاح'
                    : 'Amount exceeds available balance'
                  : isRTL
                  ? 'أدخل مبلغ صحيح'
                  : 'Enter a valid amount'}
              </p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {isRTL ? 'تاريخ التحويل' : 'Transfer date'}
            </Label>
            <Input
              type="date"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {isRTL ? 'ملاحظات (اختياري)' : 'Notes (optional)'}
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                isRTL ? 'مثال: إيداع كاش في البنك' : 'e.g. Cash deposit to bank'
              }
              rows={2}
              maxLength={200}
            />
          </div>

          {/* Preview */}
          {canSubmit && fromOption && toOption && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {isRTL ? 'سيتم خصم' : 'Debit out'}
                </span>
                <span className="font-semibold">
                  {formatEGP(numericAmount)} → {isRTL ? fromOption.nameAr : fromOption.name}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="text-muted-foreground">
                  {isRTL ? 'سيتم إضافة' : 'Credit in'}
                </span>
                <span className="font-semibold">
                  {formatEGP(numericAmount)} → {isRTL ? toOption.nameAr : toOption.name}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={transferMutation.isPending}
          >
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            onClick={() => transferMutation.mutate()}
            disabled={!canSubmit || transferMutation.isPending}
          >
            {transferMutation.isPending && (
              <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />
            )}
            {isRTL ? 'تنفيذ التحويل' : 'Execute Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
