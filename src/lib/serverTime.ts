/**
 * Server Time SSOT
 * 
 * Avoids depending on the client's system clock (which may be wrong or in
 * the wrong timezone) by syncing with the Supabase server clock once per
 * session and using the offset for all time-sensitive comparisons
 * (quiz windows, exam windows, etc.).
 */

import { supabase } from '@/integrations/supabase/client';

let serverOffsetMs = 0;
let isSynced = false;
let syncPromise: Promise<void> | null = null;

/**
 * Sync the local clock with the server clock.
 * Calculates: serverOffsetMs = serverTime - clientTime
 * 
 * Subsequent calls reuse the cached offset.
 * Falls back gracefully to client time if the request fails.
 */
export async function syncServerTime(): Promise<void> {
  if (isSynced) return;
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      const t0 = Date.now();
      // Use Supabase's HEAD request to read the Date response header — fast,
      // no auth needed, returns server UTC time.
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`;
      const resp = await fetch(url, {
        method: 'HEAD',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const t1 = Date.now();
      const dateHeader = resp.headers.get('date');
      if (!dateHeader) throw new Error('No date header');
      const serverMs = new Date(dateHeader).getTime();
      // Estimate one-way latency
      const rtt = t1 - t0;
      const estimatedClientMsAtServerTime = t0 + rtt / 2;
      serverOffsetMs = serverMs - estimatedClientMsAtServerTime;
      isSynced = true;
    } catch (err) {
      console.warn('[serverTime] Failed to sync, falling back to client clock', err);
      serverOffsetMs = 0;
      isSynced = true; // don't keep retrying every call
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
