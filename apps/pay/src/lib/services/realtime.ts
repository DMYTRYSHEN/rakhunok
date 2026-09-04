import type { Order, Terminal } from '../types/order.js';
import { isOrderFresh } from './expiry.js';

const SUPABASE_URL = 'https://mwaeazabpvbxqfrceogr.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13YWVhemFicHZieHFmcmNlb2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyOTc5MjIsImV4cCI6MjA5OTg3MzkyMn0.9omKvLBG6QXHTT9mtZzcBXPWDY5VOMRh2Sygdk4UPvo';

export type TableUpdateCallback = (order: Order) => void;

export function startTableSync(
  terminal: Terminal,
  legacyTtlMinutes = 30,
  onOrderReady: TableUpdateCallback
): () => void {
  let active = true;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let broadcastChannel: BroadcastChannel | null = null;

  const handleCandidate = (candidate: unknown) => {
    if (!active || !candidate || typeof candidate !== 'object') return;
    const order = candidate as Order;
    if (
      (order.order_number === terminal.code || order.id === `term-${terminal.code}`) &&
      Number(order.total_amount) > 0 &&
      isOrderFresh(order, Date.now(), legacyTtlMinutes)
    ) {
      onOrderReady(order);
    }
  };

  // 1. BroadcastChannel (0ms latency cross-tab)
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      broadcastChannel = new BroadcastChannel('rahunok_bus');
      broadcastChannel.onmessage = (ev) => {
        if (ev.data) handleCandidate(ev.data);
      };
    } catch {
      // ignore
    }
  }

  // 2. Storage event
  const onStorage = (e: StorageEvent) => {
    if (e.key === `rahunok_term_${terminal.code}` || e.key === 'rahunok_last_order') {
      try {
        const parsed = JSON.parse(e.newValue || '{}');
        handleCandidate(parsed);
      } catch {
        // ignore
      }
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }

  // 3. Lazy Supabase Realtime
  let supabaseChannel: unknown = null;
  import('@supabase/supabase-js')
    .then(({ createClient }) => {
      if (!active) return;
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const channel = supabase.channel(`table_room_${terminal.code}`, {
          config: { broadcast: { self: true } }
        });

        channel.on('broadcast', { event: 'table_bill' }, (payload: { payload?: unknown }) => {
          if (payload?.payload) handleCandidate(payload.payload);
        });

        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          (payload: { new?: unknown }) => {
            if (payload?.new) handleCandidate(payload.new);
          }
        );

        channel.subscribe();
        supabaseChannel = channel;
      } catch (err) {
        console.warn('Supabase realtime init error:', err);
      }
    })
    .catch(() => {});

  // 4. Polling fallback (every 800ms)
  pollInterval = setInterval(() => {
    if (!active) return;
    try {
      const stored = localStorage.getItem(`rahunok_term_${terminal.code}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        handleCandidate(parsed);
      }
    } catch {
      // ignore
    }
  }, 800);

  // Return cleanup destructor
  return () => {
    active = false;
    if (pollInterval) clearInterval(pollInterval);
    if (broadcastChannel) broadcastChannel.close();
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
    if (supabaseChannel && typeof (supabaseChannel as { unsubscribe?: () => void }).unsubscribe === 'function') {
      (supabaseChannel as { unsubscribe: () => void }).unsubscribe();
    }
  };
}
