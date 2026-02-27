export interface ReceivableRow {
  sessionNumber: number;
  amountDue: number;
  amountCovered: number;
  remaining: number;
  status: 'paid' | 'partial' | 'unpaid';
}

export function calculateReceivables(
  totalAmount: number,
  sessionCount: number,
  payments: { amount: number }[]
): ReceivableRow[] {
  if (sessionCount <= 0 || totalAmount <= 0) return [];

  const perSession = Math.floor((totalAmount * 100) / sessionCount) / 100;
  const rows: ReceivableRow[] = [];

  for (let i = 1; i <= sessionCount; i++) {
    const amountDue = i < sessionCount
      ? perSession
      : Math.round((totalAmount - perSession * (sessionCount - 1)) * 100) / 100;
    rows.push({
      sessionNumber: i,
      amountDue,
      amountCovered: 0,
      remaining: amountDue,
      status: 'unpaid',
    });
  }

  // Distribute payments sequentially
  let paymentPool = payments.reduce((sum, p) => sum + p.amount, 0);

  for (const row of rows) {
    if (paymentPool <= 0) break;
    const cover = Math.min(paymentPool, row.amountDue);
    row.amountCovered = Math.round(cover * 100) / 100;
    row.remaining = Math.round((row.amountDue - row.amountCovered) * 100) / 100;
    row.status = row.remaining <= 0 ? 'paid' : row.amountCovered > 0 ? 'partial' : 'unpaid';
    paymentPool = Math.round((paymentPool - cover) * 100) / 100;
  }

  return rows;
}
