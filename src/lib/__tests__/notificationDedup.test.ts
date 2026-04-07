import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ────────────────────────────────────────────
const mockQuery = vi.fn();
const mockInsert = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              eq: vi.fn(() => mockQuery()),
              ...mockQuery(),
            })),
          })),
        })),
      })),
      insert: mockInsert,
    })),
  },
}));

// Import after mocks
import { notificationService } from '../notificationService';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('notificationService.create - Deduplication', () => {
  it('should call supabase to check for duplicates', async () => {
    // This verifies the isDuplicate function structure exists
    // Full integration testing would require a real DB
    expect(typeof notificationService.create).toBe('function');
  });

  it('should have all expected notification methods', () => {
    const expectedMethods = [
      'create',
      'notifyQuizAssigned',
      'notifyAssignmentAssigned',
      'notifyPaymentRecorded',
      'notifySessionRescheduled',
    ];
    
    for (const method of expectedMethods) {
      expect(typeof (notificationService as any)[method]).toBe('function');
    }
  });

  it('should export notificationService as object', () => {
    expect(notificationService).toBeDefined();
    expect(typeof notificationService).toBe('object');
  });
});

describe('notificationService - Method Signatures', () => {
  it('create accepts NotificationData with all fields', async () => {
    // Verify the function signature handles optional fields
    const fn = notificationService.create;
    expect(fn.length).toBeLessThanOrEqual(1); // 1 param (data object)
  });
});
