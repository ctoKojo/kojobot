import { DashboardLayout } from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { Settings, Database, ClipboardList } from 'lucide-react';
import GeneralSettingsTab from '@/components/placement-settings/GeneralSettingsTab';
import QuestionBankTab from '@/components/placement-settings/QuestionBankTab';
import ReviewQueueTab from '@/components/placement-settings/ReviewQueueTab';

export default function PlacementTestSettings() {
  const { isRTL } = useLanguage();

  return (
    <DashboardLayout title={isRTL ? 'إعدادات امتحان تحديد المستوى' : 'Placement Exam Settings'}>
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="general" className="flex items-center gap-1.5">
            <Settings className="h-4 w-4" />
            {isRTL ? 'الإعدادات العامة' : 'General'}
          </TabsTrigger>
          <TabsTrigger value="questions" className="flex items-center gap-1.5">
            <Database className="h-4 w-4" />
            {isRTL ? 'بنك الأسئلة' : 'Question Bank'}
          </TabsTrigger>
          <TabsTrigger value="review" className="flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4" />
            {isRTL ? 'قائمة المراجعة' : 'Review Queue'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general"><GeneralSettingsTab /></TabsContent>
        <TabsContent value="questions"><QuestionBankTab /></TabsContent>
        <TabsContent value="review"><ReviewQueueTab /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
