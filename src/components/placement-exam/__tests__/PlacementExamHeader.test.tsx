import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlacementExamHeader, type SectionInfo } from '@/components/placement-exam/PlacementExamHeader';

const SECTIONS: SectionInfo[] = [
  { key: 'section_a', label: 'Section A — Level 0 Gate', labelAr: 'القسم A', startIndex: 0, endIndex: 20 },
  { key: 'section_b', label: 'Section B — Level 1 Gate', labelAr: 'القسم B', startIndex: 20, endIndex: 40 },
  { key: 'section_c', label: 'Section C — Track Inclination', labelAr: 'القسم C', startIndex: 40, endIndex: 50 },
];

describe('PlacementExamHeader', () => {
  it('shows current section indicator', () => {
    render(
      <PlacementExamHeader
        currentIndex={5}
        totalQuestions={50}
        answeredCount={3}
        sections={SECTIONS}
        isRTL={false}
      />
    );

    // Section A should be highlighted with question count
    expect(screen.getByText(/Section A.*6\/20/)).toBeInTheDocument();
    expect(screen.getByText('Question 6 of 50')).toBeInTheDocument();
    expect(screen.getByText('3/50 answered')).toBeInTheDocument();
  });

  it('shows Section B when in that range', () => {
    render(
      <PlacementExamHeader
        currentIndex={25}
        totalQuestions={50}
        answeredCount={20}
        sections={SECTIONS}
        isRTL={false}
      />
    );

    expect(screen.getByText(/Section B.*6\/20/)).toBeInTheDocument();
  });

  it('shows Section C when in that range', () => {
    render(
      <PlacementExamHeader
        currentIndex={45}
        totalQuestions={50}
        answeredCount={40}
        sections={SECTIONS}
        isRTL={false}
      />
    );

    expect(screen.getByText(/Section C.*6\/10/)).toBeInTheDocument();
  });

  it('renders RTL labels', () => {
    render(
      <PlacementExamHeader
        currentIndex={0}
        totalQuestions={50}
        answeredCount={0}
        sections={SECTIONS}
        isRTL={true}
      />
    );

    expect(screen.getByText(/القسم A/)).toBeInTheDocument();
    expect(screen.getByText(/سؤال 1 من 50/)).toBeInTheDocument();
  });
});
