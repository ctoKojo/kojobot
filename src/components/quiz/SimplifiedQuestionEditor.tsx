import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DraggableQuestionCard } from './DraggableQuestionCard';

interface SimplifiedQuestion {
  id?: string;
  question_text: string;
  question_text_ar: string;
  options: string[];
  correct_answer: string;
  points: number;
  order_index: number;
  image_url?: string;
  code_snippet?: string;
  question_type?: string;
  model_answer?: string;
  rubric?: { steps: string[]; points_per_step: number } | null;
}

interface SimplifiedQuestionEditorProps {
  questions: SimplifiedQuestion[];
  onChange: (questions: SimplifiedQuestion[]) => void;
  isRTL: boolean;
}

export function SimplifiedQuestionEditor({ questions, onChange, isRTL }: SimplifiedQuestionEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const addQuestion = (type: string = 'multiple_choice') => {
    const newQuestion: SimplifiedQuestion = {
      question_text: '',
      question_text_ar: '',
      options: type === 'open_ended' ? [] : ['', '', '', ''],
      correct_answer: type === 'open_ended' ? '' : '0',
      points: 1,
      order_index: questions.length,
      question_type: type,
      model_answer: type === 'open_ended' ? '' : undefined,
    };
    onChange([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, updates: Partial<SimplifiedQuestion>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    onChange(updated.map((q, i) => ({ ...q, order_index: i })));
  };

  const duplicateQuestion = (index: number) => {
    const questionToCopy = questions[index];
    const newQuestion: SimplifiedQuestion = {
      ...questionToCopy,
      id: undefined,
      order_index: questions.length,
    };
    onChange([...questions, newQuestion]);
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    const updated = [...questions];
    const options = [...updated[qIndex].options];
    options[optIndex] = value;
    updated[qIndex] = { ...updated[qIndex], options };
    onChange(updated);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = questions.findIndex(
        (q) => (q.id || `question-${questions.indexOf(q)}`) === active.id
      );
      const newIndex = questions.findIndex(
        (q) => (q.id || `question-${questions.indexOf(q)}`) === over.id
      );

      const reordered = arrayMove(questions, oldIndex, newIndex).map((q, i) => ({
        ...q,
        order_index: i,
      }));

      onChange(reordered);
    }
  };

  const getQuestionId = (question: SimplifiedQuestion, index: number) => {
    return question.id || `question-${index}`;
  };

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={questions.map((q, i) => getQuestionId(q, i))}
          strategy={verticalListSortingStrategy}
        >
          {questions.map((question, qIndex) => (
            <DraggableQuestionCard
              key={getQuestionId(question, qIndex)}
              question={question}
              index={qIndex}
              isRTL={isRTL}
              onUpdate={(updates) => updateQuestion(qIndex, updates)}
              onRemove={() => removeQuestion(qIndex)}
              onDuplicate={() => duplicateQuestion(qIndex)}
              onUpdateOption={(optIndex, value) => updateOption(qIndex, optIndex, value)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => addQuestion('multiple_choice')}
        >
          <Plus className="w-4 h-4 mr-2" />
          {isRTL ? 'إضافة سؤال MCQ' : 'Add MCQ'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => addQuestion('open_ended')}
        >
          <Plus className="w-4 h-4 mr-2" />
          {isRTL ? 'إضافة سؤال مفتوح' : 'Add Open-Ended'}
        </Button>
      </div>
    </div>
  );
}
