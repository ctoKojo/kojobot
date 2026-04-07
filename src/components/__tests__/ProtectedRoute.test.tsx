import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';

// ─── Mock AuthContext ─────────────────────────────────────────
const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// ─── Mock Supabase ────────────────────────────────────────────
const mockMaybeSingle = vi.fn();
const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockOrder = vi.fn(() => ({ limit: mockLimit }));
const mockEq2 = vi.fn(() => ({ order: mockOrder, maybeSingle: mockMaybeSingle }));
const mockEq = vi.fn(() => ({ eq: mockEq2 }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
    })),
  },
}));

// ─── Helpers ──────────────────────────────────────────────────
function renderProtected(
  allowedRoles?: ('admin' | 'instructor' | 'student' | 'reception')[],
  path = '/dashboard',
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth" element={<div>Auth Page</div>} />
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={allowedRoles}>
            <div>Protected Content</div>
          </ProtectedRoute>
        } />
        <Route path="/account-suspended" element={<div>Suspended Page</div>} />
        <Route path="/account-terminated" element={<div>Terminated Page</div>} />
        <Route path="/placement-gate" element={
          <ProtectedRoute allowedRoles={['student']}>
            <div>Placement Gate</div>
          </ProtectedRoute>
        } />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset module-level cache by mocking Date.now to force refetch
  vi.spyOn(Date, 'now').mockReturnValue(Date.now());
});

// ═══════════════════════════════════════════════════════════════
// SECTION 1: Basic Auth Flow
// ═══════════════════════════════════════════════════════════════

describe('ProtectedRoute - Authentication', () => {
  it('redirects to /auth when no user', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      role: null,
      loading: false,
    });
    renderProtected();
    expect(screen.getByText('Auth Page')).toBeInTheDocument();
  });

  it('shows loading screen while auth is loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      role: null,
      loading: true,
    });
    renderProtected();
    // LoadingScreen renders (not Auth page, not content)
    expect(screen.queryByText('Auth Page')).not.toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 2: Role-Based Access
// ═══════════════════════════════════════════════════════════════

describe('ProtectedRoute - Role Access', () => {
  it('allows admin to access admin-only route', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1' },
      role: 'admin',
      loading: false,
    });
    // Admin skips status checks → content shows immediately
    renderProtected(['admin']);
    // Admin role goes through else branch and sets states synchronously-ish
    // Content should appear after state update
    expect(await screen.findByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects instructor away from admin-only route', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'instr-1' },
      role: 'instructor',
      loading: false,
    });
    renderProtected(['admin']);
    // Should redirect to /dashboard (which re-renders, but role check comes first)
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects student away from admin-only route', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'student-1' },
      role: 'student',
      loading: false,
    });
    renderProtected(['admin']);
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('allows reception to access reception-allowed route', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'reception-1' },
      role: 'reception',
      loading: false,
    });
    // Mock terminated check
    mockMaybeSingle.mockResolvedValue({ data: { employment_status: 'permanent' }, error: null });
    renderProtected(['admin', 'reception']);
    expect(await screen.findByText('Protected Content')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 3: Suspension & Termination
// ═══════════════════════════════════════════════════════════════

describe('ProtectedRoute - Status Checks', () => {
  it('redirects terminated instructor to /account-terminated', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'instr-term' },
      role: 'instructor',
      loading: false,
    });
    mockMaybeSingle.mockResolvedValue({ data: { employment_status: 'terminated' }, error: null });
    renderProtected();
    expect(await screen.findByText('Terminated Page')).toBeInTheDocument();
  });

  it('redirects suspended student to /account-suspended', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'student-susp' },
      role: 'student',
      loading: false,
    });
    // Mock subscription check (suspended) and profile check
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { is_suspended: true }, error: null })
      .mockResolvedValueOnce({ data: { level_id: 'some-level' }, error: null });
    renderProtected();
    expect(await screen.findByText('Suspended Page')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 4: Placement Gate
// ═══════════════════════════════════════════════════════════════

describe('ProtectedRoute - Placement Gate', () => {
  it('redirects student without level to placement gate', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'student-nolevel' },
      role: 'student',
      loading: false,
    });
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { is_suspended: false }, error: null })
      .mockResolvedValueOnce({ data: { level_id: null }, error: null });
    renderProtected();
    // Should redirect to /placement-gate
    expect(await screen.findByText('Placement Gate')).toBeInTheDocument();
  });
});
