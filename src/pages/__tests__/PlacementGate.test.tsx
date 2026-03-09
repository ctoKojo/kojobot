import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock modules
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockSignOut = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'student-1' }, signOut: mockSignOut }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ isRTL: false }),
}));

// Supabase mock
const mockMaybeSingle = vi.fn();
const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockOrder = vi.fn(() => ({ limit: mockLimit }));
const mockIn = vi.fn(() => ({ order: mockOrder }));
const mockEq = vi.fn(() => ({ in: mockIn }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('@/components/KojobotLogo', () => ({
  KojobotLogo: () => <div data-testid="logo">Logo</div>,
}));

import PlacementGate from '@/pages/PlacementGate';

function renderGate() {
  return render(
    <MemoryRouter>
      <PlacementGate />
    </MemoryRouter>
  );
}

describe('PlacementGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "No Exam Scheduled" when no schedule and no attempt', async () => {
    // First call: student_view → no attempt
    // Second call: schedules → no schedule
    let callCount = 0;
    mockMaybeSingle.mockImplementation(() => {
      callCount++;
      return Promise.resolve({ data: null, error: null });
    });

    renderGate();

    await waitFor(() => {
      expect(screen.getByText('No Exam Scheduled Yet')).toBeInTheDocument();
    });
  });

  it('shows "Submitted" when attempt status is submitted', async () => {
    // First call: student_view → submitted attempt
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'att-1', status: 'submitted' },
      error: null,
    });

    renderGate();

    await waitFor(() => {
      expect(screen.getByText('Placement Exam Submitted')).toBeInTheDocument();
      expect(screen.getByText('Pending Approval')).toBeInTheDocument();
    });

    // Ensure NO recommended_level_id or approved_level_id text
    expect(screen.queryByText(/recommended/i)).toBeNull();
    expect(screen.queryByText(/approved/i)).toBeNull();
  });

  it('shows "Expired" when schedule window has passed', async () => {
    // First call: student_view → no attempt
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    // Second call: schedules → expired schedule
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const pastClose = new Date(Date.now() - 3600000).toISOString();
    mockMaybeSingle.mockResolvedValueOnce({
      data: { 
        id: 'sch-1', student_id: 'student-1', status: 'scheduled',
        opens_at: pastDate, closes_at: pastClose, notes: null
      },
      error: null,
    });

    renderGate();

    await waitFor(() => {
      expect(screen.getByText('Exam Window Expired')).toBeInTheDocument();
      expect(screen.getByText('Requires Rescheduling')).toBeInTheDocument();
    });
  });

  it('shows "Open" when schedule window is active', async () => {
    // First call: student_view → no attempt
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    // Second call: schedules → open schedule
    const opensAt = new Date(Date.now() - 3600000).toISOString();
    const closesAt = new Date(Date.now() + 3600000).toISOString();
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'sch-1', student_id: 'student-1', status: 'scheduled',
        opens_at: opensAt, closes_at: closesAt, notes: null
      },
      error: null,
    });

    renderGate();

    await waitFor(() => {
      expect(screen.getByText('Exam is Now Open!')).toBeInTheDocument();
      expect(screen.getByText('Start Placement Exam')).toBeInTheDocument();
    });
  });

  it('navigates to /placement-test when Start button clicked', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const opensAt = new Date(Date.now() - 3600000).toISOString();
    const closesAt = new Date(Date.now() + 3600000).toISOString();
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'sch-1', student_id: 'student-1', status: 'scheduled',
        opens_at: opensAt, closes_at: closesAt, notes: null
      },
      error: null,
    });

    renderGate();

    await waitFor(() => {
      expect(screen.getByText('Start Placement Exam')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Start Placement Exam'));
    expect(mockNavigate).toHaveBeenCalledWith('/placement-test');
  });

  it('has sign out button in all states', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    renderGate();

    await waitFor(() => {
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });
  });
});
