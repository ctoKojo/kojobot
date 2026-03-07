import { DashboardLayout } from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { Settings, Scale, LayoutGrid, Database, ClipboardList } from 'lucide-react';
import GeneralSettingsTab from '@/components/placement-settings/GeneralSettingsTab';
import PlacementRulesTab from '@/components/placement-settings/PlacementRulesTab';
import BlueprintTab from '@/components/placement-settings/BlueprintTab';
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
          <TabsTrigger value="rules" className="flex items-center gap-1.5">
            <Scale className="h-4 w-4" />
            {isRTL ? 'قواعد التسكين' : 'Rules'}
          </TabsTrigger>
          <TabsTrigger value="blueprint" className="flex items-center gap-1.5">
            <LayoutGrid className="h-4 w-4" />
            {isRTL ? 'مخطط المهارات' : 'Blueprint'}
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
        <TabsContent value="rules"><PlacementRulesTab /></TabsContent>
        <TabsContent value="blueprint"><BlueprintTab /></TabsContent>
        <TabsContent value="questions"><QuestionBankTab /></TabsContent>
        <TabsContent value="review"><ReviewQueueTab /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
