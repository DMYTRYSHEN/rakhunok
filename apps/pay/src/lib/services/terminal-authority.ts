import type { Order, Terminal } from '../types/order.js';

export interface TerminalSelection {
  kind: 'active' | 'idle';
  terminal: Terminal;
  order: Pick<Order, 'id' | 'status' | 'total_amount' | 'expires_at' | 'currency'> | null;
}

export function isTerminalPath(path: string): boolean {
  return /^\/tag(?:\/|$)/i.test(path);
}

export function terminalCode(path: string): string {
  const match = path.match(/^\/tag\/([a-z0-9-]{3,36})\/?$/i);
  if (!match) throw new Error('Invalid terminal code');
  return match[1];
}

function expiry(value: unknown): number {
  if (value === null) return Infinity;
  return typeof value === 'string' && value ? Date.parse(value) : NaN;
}

export function matchesTerminalOrder(selection: TerminalSelection, order: Order | null): boolean {
  const active = selection.order;
  return Boolean(selection.kind === 'active' && active && order &&
    order.id === active.id && order.status === active.status &&
    order.total_amount === active.total_amount && order.currency === active.currency &&
    expiry(order.expires_at) === expiry(active.expires_at) && expiry(active.expires_at) > Date.now());
}

export async function readTerminalSelection(code: string): Promise<TerminalSelection> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`/api/v1/checkout/terminal/${encodeURIComponent(code)}`, {
      method: 'GET', cache: 'no-store', redirect: 'error', signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error('Terminal unavailable');
    const data = await response.json();
    if (!data || !['active', 'idle'].includes(data.kind) || data.terminal?.code !== code) {
      throw new Error('Invalid terminal selection');
    }
    const terminal = { code, name: data.terminal.name || code };
    if (data.kind === 'idle') return { kind: 'idle', terminal, order: null };
    const order = data.order;
    if (!order || typeof order.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order.id) ||
      !['pending', 'preparing'].includes(order.status) ||
      !Number.isFinite(order.total_amount) || order.total_amount < 0 ||
      !(expiry(order.expires_at) > Date.now())) {
      throw new Error('Invalid active terminal order');
    }
    return { kind: 'active', terminal, order: Object.freeze({
      id: order.id, status: order.status, total_amount: order.total_amount,
      currency: order.currency, expires_at: order.expires_at
    }) };
  } finally {
    clearTimeout(timeout);
  }
}