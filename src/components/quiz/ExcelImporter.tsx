import { useState, useRef } from 'react';
import { Download, Upload, FileSpreadsheet, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { generateExcelTemplate, parseExcelFile, parseCSVFile, QuestionRow } from '@/lib/quizExcelTemplate';
import { useToast } from '@/hooks/use-toast';

interface SimplifiedQuestion {
  question_text: string;
  question_text_ar: string;
  options: string[];
  correct_answer: string;
  points: number;
  order_index: number;
  image_url?: string;
}

interface ExcelImporterProps {
  onImport: (questions: SimplifiedQuestion[]) => void;
  existingQuestionsCount: number;
  isRTL: boolean;
}

export function ExcelImporter({ onImport, existingQuestionsCount, isRTL }: ExcelImporterProps) {
  const [parsedQuestions, setParsedQuestions] = useState<QuestionRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDownloadTemplate = async () => {
    await generateExcelTemplate();
    toast({
      title: isRTL ? 'تم التحميل' : 'Downloaded',
      description: isRTL ? 'تم تحميل قالب Excel' : 'Excel template downloaded',
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);

    try {
      let questions: QuestionRow[];
      
      if (file.name.endsWith('.csv')) {
        questions = await parseCSVFile(file);
      } else {
        questions = await parseExcelFile(file);
      }

      if (questions.length === 0) {
        toast({
          variant: 'destructive',
          title: isRTL ? 'خطأ' : 'Error',
          description: isRTL ? 'لم يتم العثور على أسئلة في الملف' : 'No questions found in file',
        });
        return;
      }

      setParsedQuestions(questions);
      setShowPreview(true);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في قراءة الملف' : 'Failed to read file',
      });
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmImport = () => {
    const convertedQuestions: SimplifiedQuestion[] = parsedQuestions.map((q, index) => ({
      question_text: q.question,
      question_text_ar: q.question, // Use same text for both since we're simplifying
      options: [q.option1, q.option2, q.option3, q.option4],
      correct_answer: String(q.correctAnswer - 1), // Convert to 0-indexed
      points: q.points,
      order_index: existingQuestionsCount + index,
    }));

    onImport(convertedQuestions);
    setShowPreview(false);
    setParsedQuestions([]);

    toast({
      title: isRTL ? 'تم الاستيراد' : 'Imported',
      description: isRTL 
        ? `تم استيراد ${convertedQuestions.length} سؤال بنجاح`
        : `Successfully imported ${convertedQuestions.length} questions`,
    });
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownloadTemplate}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          {isRTL ? 'تحميل قالب Excel' : 'Download Template'}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {isRTL ? 'استيراد من Excel' : 'Import from Excel'}
        </Button>
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              {isRTL ? 'معاينة الأسئلة المستوردة' : 'Preview Imported Questions'}
            </DialogTitle>
            <DialogDescription>
              {isRTL 
                ? `سيتم إضافة ${parsedQuestions.length} سؤال إلى الكويز`
                : `${parsedQuestions.length} questions will be added to the quiz`}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {parsedQuestions.map((q, index) => (
                <Card key={index}>
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm mb-2">
                          {index + 1}. {q.question}
                        </p>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          {[q.option1, q.option2, q.option3, q.option4].map((opt, i) => (
                            <div 
                              key={i} 
                              className={`flex items-center gap-1 p-1 rounded ${
                                i + 1 === q.correctAnswer 
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {i + 1 === q.correctAnswer ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <span className="w-3" />
                              )}
                              {opt}
                            </div>
                          ))}
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {q.points} {isRTL ? 'درجة' : 'pts'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              <X className="h-4 w-4 mr-2" />
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleConfirmImport} className="kojo-gradient">
              <Check className="h-4 w-4 mr-2" />
              {isRTL ? `استيراد ${parsedQuestions.length} سؤال` : `Import ${parsedQuestions.length} Questions`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
