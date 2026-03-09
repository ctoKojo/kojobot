import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlacementExamStatus } from '@/components/placement-exam/PlacementExamStatus';

vi.mock('@/components/KojobotLogo', () => ({
  KojobotLogo: () => <div data-testid="logo">Logo</div>,
}));

describe('PlacementExamStatus', () => {
  const defaultProps = {
    errorMsg: '',
    isRTL: false,
    onStart: vi.fn(),
    onBack: vi.fn(),
    onSignOut: vi.fn(),
  };

  it('shows submitted state without any results', () => {
    render(<PlacementExamStatus {...defaultProps} phase="submitted" />);

    expect(screen.getByText('Submitted Successfully!')).toBeInTheDocument();
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
    
    // Must NOT show any level/score info
    expect(screen.queryByText(/recommended/i)).toBeNull();
    expect(screen.queryByText(/level/i)).toBeNull();
    expect(screen.queryByText(/score/i)).toBeNull();
  });

  it('shows ready state with 3-section description', () => {
    render(<PlacementExamStatus {...defaultProps} phase="ready" />);

    expect(screen.getByText('Placement Exam')).toBeInTheDocument();
    expect(screen.getByText(/3 sections/i)).toBeInTheDocument();
    expect(screen.getByText(/Section A/)).toBeInTheDocument();
    expect(screen.getByText(/Section B/)).toBeInTheDocument();
    expect(screen.getByText(/Section C/)).toBeInTheDocument();
  });

  it('shows loading spinner', () => {
    const { container } = render(<PlacementExamStatus {...defaultProps} phase="loading" />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});
