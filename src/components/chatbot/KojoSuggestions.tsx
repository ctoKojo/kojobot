import React from 'react';
import { Button } from '@/components/ui/button';
import { Lightbulb } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface KojoSuggestionsProps {
  onSend: (text: string) => void;
}

const suggestions = [
  { ar: 'اشرحلي المفهوم اللي في الدرس ده', en: 'Explain the concept in this lesson' },
  { ar: 'ايه الفرق بين المتغيرات والثوابت؟', en: 'What is the difference between variables and constants?' },
  { ar: 'ازاي اعمل loop بشكل صح؟', en: 'How do I write a loop correctly?' },
  { ar: 'لخصلي الجزء ده من المنهج', en: 'Summarize this part of the curriculum' },
];

export function KojoSuggestions({ onSend }: KojoSuggestionsProps) {
  const { isRTL } = useLanguage();

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {suggestions.map((s, i) => (
        <Button
          key={i}
          variant="outline"
          size="sm"
          className="text-xs gap-1.5 rounded-full"
          onClick={() => onSend(isRTL ? s.ar : s.en)}
        >
          <Lightbulb className="w-3 h-3" />
          {isRTL ? s.ar : s.en}
        </Button>
      ))}
    </div>
  );
}
