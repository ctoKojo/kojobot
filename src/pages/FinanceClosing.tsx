import { lazy, Suspense } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
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

/**
 * Wrapper that strips the inner DashboardLayout/PageHeader from a lazy-loaded
 * page so we can embed it as a tab without doubling the chrome.
 */
function EmbeddedPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="[&_main]:p-0 [&_.container]:p-0 [&_.container]:max-w-none">
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </div>
  );
}

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
              ? 'إقفال الفترات الشهرية، طلبات إعادة الفتح، جودة البيانات وسجل المراجعة'
              : 'Monthly period closing, reopen requests, data quality and audit log'
          }
          icon={Lock}
          gradient="from-amber-500 to-rose-500"
        />

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

          <Card>
            <CardContent className="p-0">
              <TabsContent value="periods" className="m-0">
                <EmbeddedPage>
                  <FinancePeriods />
                </EmbeddedPage>
              </TabsContent>
              <TabsContent value="reopen" className="m-0">
                <EmbeddedPage>
                  <FinanceReopenRequests />
                </EmbeddedPage>
              </TabsContent>
              <TabsContent value="quality" className="m-0">
                <EmbeddedPage>
                  <FinanceDataQuality />
                </EmbeddedPage>
              </TabsContent>
              <TabsContent value="audit" className="m-0">
                <EmbeddedPage>
                  <FinanceAuditExplorer />
                </EmbeddedPage>
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
