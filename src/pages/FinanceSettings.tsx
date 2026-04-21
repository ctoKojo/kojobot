import { lazy, Suspense } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// Card import removed — embedded children render their own cards
import { Settings, Tag, Percent, Inbox, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const PricingPlans = lazy(() => import('./PricingPlans'));
const DeductionRules = lazy(() => import('./DeductionRules'));
const SubscriptionRequests = lazy(() => import('./SubscriptionRequests'));

const PageLoader = () => (
  <div className="flex justify-center p-12">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

export default function FinanceSettings() {
  const { isRTL } = useLanguage();
  const { role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = role === 'admin';
  const activeTab = searchParams.get('tab') || 'pricing';

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
          title={isRTL ? 'الإعدادات المالية' : 'Finance Settings'}
          subtitle={
            isRTL
              ? 'باقات الأسعار، قواعد الخصومات وطلبات الاشتراك'
              : 'Pricing plans, deduction rules and subscription requests'
          }
          icon={Settings}
          gradient="from-violet-500 to-blue-500"
        />

        <Tabs value={activeTab} onValueChange={setTab} className="space-y-4">
          <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-3">
            <TabsTrigger value="pricing" className="gap-2">
              <Tag className="h-4 w-4" />
              {isRTL ? 'الباقات' : 'Pricing'}
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="deductions" className="gap-2">
                <Percent className="h-4 w-4" />
                {isRTL ? 'الخصومات' : 'Deductions'}
              </TabsTrigger>
            )}
            <TabsTrigger value="requests" className="gap-2">
              <Inbox className="h-4 w-4" />
              {isRTL ? 'طلبات الاشتراك' : 'Subscription Requests'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pricing" className="m-0">
            <Suspense fallback={<PageLoader />}>
              <PricingPlans embedded />
            </Suspense>
          </TabsContent>
          {isAdmin && (
            <TabsContent value="deductions" className="m-0">
              <Suspense fallback={<PageLoader />}>
                <DeductionRules embedded />
              </Suspense>
            </TabsContent>
          )}
          <TabsContent value="requests" className="m-0">
            <Suspense fallback={<PageLoader />}>
              <SubscriptionRequests embedded />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
