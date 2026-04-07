import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

// ─── Mock LanguageContext ─────────────────────────────────────
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', setLanguage: vi.fn(), t: (k: string) => k }),
  LanguageProvider: ({ children }: any) => children,
}));

// ─── Mock AuthContext ─────────────────────────────────────────
const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// ─── Deep Supabase mock ──────────────────────────────────────
let subscriptionResult: any = { data: null, error: null };
let profileResult: any = { data: null, error: null };

function createChain(result: any) {
  const chain: any = {};
  const methods = ['select', 'eq', 'order', 'limit', 'gte', 'lte', 'neq', 'in', 'is', 'single'];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  return chain;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'subscriptions') return createChain(subscriptionResult);
      if (table === 'profiles') return createChain(profileResult);
      return createChain({ data: null, error: null });
    }),
  },
}));

// ─── Mock LoadingScreen ───────────────────────────────────────
vi.mock('@/components/LoadingScreen', () => ({
  LoadingScreen: () => React.createElement('div', null, 'Loading...'),
}));

// ─── Helper ──────────────────────────────────────────────────
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
        <Route path="/placement-gate" element={<div>Placement Gate</div>} />
      </Routes>
    </MemoryRouter>
  );
}

// Must import AFTER mocks
import { ProtectedRoute } from '../ProtectedRoute';

beforeEach(() => {
  vi.clearAllMocks();
  subscriptionResult = { data: null, error: null };
  profileResult = { data: null, error: null };
});

// ═══════════════════════════════════════════════════════════════
// SECTION 1: Basic Auth
// ═══════════════════════════════════════════════════════════════

describe('ProtectedRoute - Authentication', () => {
  it('redirects to /auth when no user', () => {
    mockUseAuth.mockReturnValue({ user: null, role: null, loading: false });
    renderProtected();
    expect(screen.getByText('Auth Page')).toBeInTheDocument();
  });

  it('shows loading screen while auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, role: null, loading: true });
    renderProtected();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 2: Role Access
// ═══════════════════════════════════════════════════════════════

describe('ProtectedRoute - Role Access', () => {
  it('allows admin access to admin-only route', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'admin-1' }, role: 'admin', loading: false });
    renderProtected(['admin']);
    expect(await screen.findByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects instructor from admin-only route', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'instr-1' }, role: 'instructor', loading: false });
    profileResult = { data: { employment_status: 'permanent' }, error: null };
    renderProtected(['admin']);
    // Role mismatch → redirect to /dashboard (which loops, but the role check fires)
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects student from admin-only route', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'stu-1' }, role: 'student', loading: false });
    subscriptionResult = { data: { is_suspended: false }, error: null };
    profileResult = { data: { level_id: 'lv1' }, error: null };
    renderProtected(['admin']);
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('allows reception on reception-allowed route', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'rec-1' }, role: 'reception', loading: false });
    profileResult = { data: { employment_status: 'permanent' }, error: null };
    renderProtected(['admin', 'reception']);
    expect(await screen.findByText('Protected Content')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 3: Status Checks
// ═══════════════════════════════════════════════════════════════

describe('ProtectedRoute - Status Checks', () => {
  it('redirects terminated instructor', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'instr-t' }, role: 'instructor', loading: false });
    profileResult = { data: { employment_status: 'terminated' }, error: null };
    renderProtected();
    expect(await screen.findByText('Terminated Page')).toBeInTheDocument();
  });

  it('redirects suspended student', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'stu-s' }, role: 'student', loading: false });
    subscriptionResult = { data: { is_suspended: true }, error: null };
    profileResult = { data: { level_id: 'lv1' }, error: null };
    renderProtected();
    expect(await screen.findByText('Suspended Page')).toBeInTheDocument();
  });

  it('redirects student without level to placement gate', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'stu-nl' }, role: 'student', loading: false });
    subscriptionResult = { data: { is_suspended: false }, error: null };
    profileResult = { data: { level_id: null }, error: null };
    renderProtected();
    expect(await screen.findByText('Placement Gate')).toBeInTheDocument();
  });
});
