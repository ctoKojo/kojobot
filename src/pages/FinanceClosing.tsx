import { lazy, Suspense } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Lock, Unlock, AlertTriangle, History, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSearchParams } from 'react-router-dom';

// Lazy-load the embedded sub-pages so we don't ship all of them at once
const FinancePeriods = lazy(() => import('./FinancePeriods'));
const FinanceReopenRequests = lazy(() => import('./FinanceReopenRequests'));
const FinanceDataQuality = lazy(() => import('./FinanceDataQuality'));
const FinanceAuditExplorer = lazy(() => import('./FinanceAuditExplorer'));

const PageLoader = () => (
  <div className="flex justify-center p-12">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

export default function FinanceClosing() {
  const { isRTL } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'periods';

  const setTab = (val: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', val);
      return next;
    });
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <PageHeader
          title={isRTL ? 'الإقفال والتدقيق' : 'Closing & Audit'}
          subtitle={
            isRTL
              ? 'مركز موحد لإدارة إقفال الشهور المالية ومراجعة سلامة البيانات قبل الإقفال'
              : 'Unified hub for closing monthly periods and reviewing data integrity before lock-in'
          }
          icon={Lock}
          gradient="from-amber-500 to-rose-500"
        />

        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground leading-relaxed">
          {isRTL ? (
            <ul className="space-y-1.5 list-disc pr-5">
              <li><strong className="text-foreground">الفترات:</strong> اقفل الشهر المالي بعد المراجعة لمنع أي تعديل لاحق على قيوده.</li>
              <li><strong className="text-foreground">طلبات الفتح:</strong> راجع طلبات الموظفين لإعادة فتح شهر مُقفل لتعديل بيانات استثنائية.</li>
              <li><strong className="text-foreground">جودة البيانات:</strong> تنبيهات للقيود غير المتوازنة أو الأرصدة الشاذة قبل ما تُقفل الشهر.</li>
              <li><strong className="text-foreground">سجل التدقيق:</strong> سجل غير قابل للتعديل لكل عملية مالية تمت في النظام.</li>
            </ul>
          ) : (
            <ul className="space-y-1.5 list-disc pl-5">
              <li><strong className="text-foreground">Periods:</strong> Lock a month after review so its entries can no longer be edited.</li>
              <li><strong className="text-foreground">Reopen Requests:</strong> Review staff requests to reopen a locked month for exceptional fixes.</li>
              <li><strong className="text-foreground">Data Quality:</strong> Alerts for unbalanced entries or suspicious balances before you close.</li>
              <li><strong className="text-foreground">Audit Log:</strong> Tamper-proof history of every financial operation in the system.</li>
            </ul>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setTab} className="space-y-4">
          <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="periods" className="gap-2">
              <Lock className="h-4 w-4" />
              {isRTL ? 'الفترات' : 'Periods'}
            </TabsTrigger>
            <TabsTrigger value="reopen" className="gap-2">
              <Unlock className="h-4 w-4" />
              {isRTL ? 'طلبات الفتح' : 'Reopen Requests'}
            </TabsTrigger>
            <TabsTrigger value="quality" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              {isRTL ? 'جودة البيانات' : 'Data Quality'}
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <History className="h-4 w-4" />
              {isRTL ? 'سجل التدقيق' : 'Audit Log'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="periods" className="m-0">
            <Suspense fallback={<PageLoader />}>
              <FinancePeriods embedded />
            </Suspense>
          </TabsContent>
          <TabsContent value="reopen" className="m-0">
            <Suspense fallback={<PageLoader />}>
              <FinanceReopenRequests embedded />
            </Suspense>
          </TabsContent>
          <TabsContent value="quality" className="m-0">
            <Suspense fallback={<PageLoader />}>
              <FinanceDataQuality embedded />
            </Suspense>
          </TabsContent>
          <TabsContent value="audit" className="m-0">
            <Suspense fallback={<PageLoader />}>
              <FinanceAuditExplorer embedded />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
