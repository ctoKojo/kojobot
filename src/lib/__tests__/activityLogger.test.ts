import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase (no top-level variable refs) ───────────────
vi.mock('@/integrations/supabase/client', () => {
  const mockInsert = vi.fn(() => Promise.resolve({ error: null }));
  return {
    supabase: {
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'test-user-123' } } })),
      },
      from: vi.fn(() => ({
        insert: mockInsert,
      })),
      __mockInsert: mockInsert,
    },
  };
});

import { logLogin, logLogout, logPayment, logSubscription, logWarning } from '../activityLogger';
import { supabase } from '@/integrations/supabase/client';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('activityLogger', () => {
  it('logLogin calls supabase insert', async () => {
    await logLogin();
    expect(supabase.from).toHaveBeenCalledWith('activity_logs');
  });

  it('logLogout calls supabase insert', async () => {
    await logLogout();
    expect(supabase.from).toHaveBeenCalledWith('activity_logs');
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

  it('logPayment calls supabase', async () => {
    await logPayment('pay-123', { amount: 1000 });
    expect(supabase.from).toHaveBeenCalledWith('activity_logs');
  });

  it('logSubscription calls supabase', async () => {
    await logSubscription('update', 'sub-123', { status: 'active' });
    expect(supabase.from).toHaveBeenCalledWith('activity_logs');
  });

  it('logWarning calls supabase', async () => {
    await logWarning('warning', 'warn-123', { severity: 'medium' });
    expect(supabase.from).toHaveBeenCalledWith('activity_logs');
  });
});
