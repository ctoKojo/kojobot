/**
 * Server Time SSOT
 * 
 * Avoids depending on the client's system clock (which may be wrong or in
 * the wrong timezone) by syncing with the Supabase server clock once per
 * session and using the offset for all time-sensitive comparisons
 * (quiz windows, exam windows, etc.).
 */

import { publicSupabase } from '@/integrations/supabase/publicClient';

let serverOffsetMs = 0;
let isSynced = false;
let syncPromise: Promise<void> | null = null;
let lastSyncedAt = 0;

const SYNC_TTL_MS = 5 * 60 * 1000;

/**
 * Sync the local clock with the server clock.
 * Calculates: serverOffsetMs = serverTime - clientTime
 * 
 * Subsequent calls reuse the cached offset.
 * Falls back gracefully to client time if the request fails.
 */
export async function syncServerTime(): Promise<void> {
  if (isSynced && Date.now() - lastSyncedAt < SYNC_TTL_MS) return;
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      const t0 = Date.now();
      const { data, error } = await publicSupabase.functions.invoke('get-server-time');
      const t1 = Date.now();
      if (error) throw error;

      const serverMs = Number(data?.nowMs);
      if (!Number.isFinite(serverMs)) throw new Error('Invalid server time response');

      // Estimate one-way latency
      const rtt = t1 - t0;
      const estimatedClientMsAtServerTime = t0 + rtt / 2;
      serverOffsetMs = serverMs - estimatedClientMsAtServerTime;
      isSynced = true;
      lastSyncedAt = t1;
    } catch (err) {
      console.warn('[serverTime] Failed to sync, will retry on next request', err);
      isSynced = false;
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
}

/**
 * Returns the current time in ms, corrected by the server offset.
 * Returns plain Date.now() if sync hasn't completed yet.
 */
export function serverNow(): number {
  return Date.now() + serverOffsetMs;
}

/** Returns the cached server-vs-client offset in ms (server - client). */
export function getServerOffsetMs(): number {
  return serverOffsetMs;
}

/** Whether the initial sync has completed. */
export function isServerTimeSynced(): boolean {
  return isSynced;
}
