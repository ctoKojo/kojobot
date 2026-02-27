import { describe, it, expect } from 'vitest';
import { calculateReceivables } from './receivablesCalculator';

describe('calculateReceivables', () => {
  it('divides evenly when total is divisible by 12', () => {
    const rows = calculateReceivables(1200, 12, []);
    expect(rows).toHaveLength(12);
    rows.forEach(r => expect(r.amountDue).toBe(100));
    expect(rows.reduce((s, r) => s + r.amountDue, 0)).toBe(1200);
  });

  it('handles rounding when total is not divisible by 12', () => {
    const rows = calculateReceivables(1000, 12, []);
    expect(rows).toHaveLength(12);
    const total = rows.reduce((s, r) => s + r.amountDue, 0);
    expect(Math.round(total * 100) / 100).toBe(1000);
    // First 11 should be the same
    const first11 = rows.slice(0, 11);
    first11.forEach(r => expect(r.amountDue).toBe(first11[0].amountDue));
  });

  it('distributes a single full payment', () => {
    const rows = calculateReceivables(1200, 12, [{ amount: 1200 }]);
    rows.forEach(r => {
      expect(r.status).toBe('paid');
      expect(r.remaining).toBe(0);
    });
  });

  it('distributes a partial payment', () => {
    const rows = calculateReceivables(1200, 12, [{ amount: 250 }]);
    // First 2 fully paid (100 each), 3rd partially (50)
    expect(rows[0].status).toBe('paid');
    expect(rows[1].status).toBe('paid');
    expect(rows[2].status).toBe('partial');
    expect(rows[2].amountCovered).toBe(50);
    expect(rows[3].status).toBe('unpaid');
  });

  it('distributes multiple payments', () => {
    const rows = calculateReceivables(1200, 12, [{ amount: 100 }, { amount: 200 }]);
    // Total paid = 300, covers 3 sessions
    expect(rows[0].status).toBe('paid');
    expect(rows[1].status).toBe('paid');
    expect(rows[2].status).toBe('paid');
    expect(rows[3].status).toBe('unpaid');
  });

  it('handles no payments', () => {
    const rows = calculateReceivables(1200, 12, []);
    rows.forEach(r => {
      expect(r.status).toBe('unpaid');
      expect(r.amountCovered).toBe(0);
    });
  });

  it('total of amountDue always equals totalAmount', () => {
    const amounts = [999, 1500, 750, 1234.56];
    amounts.forEach(total => {
      const rows = calculateReceivables(total, 12, []);
      const sum = Math.round(rows.reduce((s, r) => s + r.amountDue, 0) * 100) / 100;
      expect(sum).toBe(total);
    });
  });

  it('returns empty for zero or negative inputs', () => {
    expect(calculateReceivables(0, 12, [])).toHaveLength(0);
    expect(calculateReceivables(1000, 0, [])).toHaveLength(0);
  });
});
