import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ count: 0 })),
            })),
          })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

import { notificationService } from '../notificationService';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('notificationService - Structure', () => {
  it('exports create method', () => {
    expect(typeof notificationService.create).toBe('function');
  });

  it('exports notifyQuizAssigned', () => {
    expect(typeof notificationService.notifyQuizAssigned).toBe('function');
  });

  it('exports notifyAssignmentAssigned', () => {
    expect(typeof notificationService.notifyAssignmentAssigned).toBe('function');
  });

  it('exports notifyPaymentRecorded', () => {
    expect(typeof notificationService.notifyPaymentRecorded).toBe('function');
  });

  it('is a valid object with multiple methods', () => {
    expect(notificationService).toBeDefined();
    const methods = Object.keys(notificationService).filter(
      k => typeof (notificationService as any)[k] === 'function'
    );
    expect(methods.length).toBeGreaterThan(3);
  });
});
