import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ────────────────────────────────────────────
const mockGetUser = vi.fn();
const mockInsert = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: mockGetUser,
    },
    from: vi.fn(() => ({
      insert: mockInsert,
    })),
  },
}));

import { logLogin, logLogout, logPayment, logSubscription, logWarning } from '../activityLogger';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'test-user-123' } } });
  mockInsert.mockResolvedValue({ error: null });
});

describe('activityLogger', () => {
  it('logLogin calls supabase insert', async () => {
    await logLogin();
    expect(mockInsert).toHaveBeenCalled();
  });

  it('logLogout calls supabase insert', async () => {
    await logLogout();
    expect(mockInsert).toHaveBeenCalled();
  });

  it('logPayment is defined and callable', () => {
    expect(typeof logPayment).toBe('function');
  });

  it('logSubscription is defined and callable', () => {
    expect(typeof logSubscription).toBe('function');
  });

  it('logWarning is defined and callable', () => {
    expect(typeof logWarning).toBe('function');
  });

  it('logPayment passes correct entity_type', async () => {
    await logPayment('create', 'pay-123', { amount: 1000 });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'payment',
        action: 'create',
        entity_id: 'pay-123',
      })
    );
  });

  it('logSubscription passes correct entity_type', async () => {
    await logSubscription('update', 'sub-123', { status: 'active' });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'subscription',
        action: 'update',
        entity_id: 'sub-123',
      })
    );
  });

  it('logWarning passes correct entity_type', async () => {
    await logWarning('create', 'warn-123', { severity: 'medium' });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'warning',
        action: 'create',
        entity_id: 'warn-123',
      })
    );
  });

  it('handles missing user gracefully', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    // Should not throw
    await expect(logLogin()).resolves.not.toThrow();
  });
});
