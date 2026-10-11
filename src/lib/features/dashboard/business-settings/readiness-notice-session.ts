import { writable } from 'svelte/store';
import type { SupabaseClient, Session } from '@supabase/supabase-js';

type NoticeState = { deadline: number | null; acknowledged: boolean };
type NoticeStorage = Pick<Storage, 'getItem' | 'setItem'>;

export async function readinessNoticeScope(userId: string, merchantId: string, sessionId: string) {
	const bytes = new TextEncoder().encode(JSON.stringify([userId, merchantId, sessionId]));
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function observeReadinessNoticeScope(
	auth: Pick<SupabaseClient['auth'], 'onAuthStateChange' | 'getSession'>,
	owner: { userId: string; merchantId: string },
	onScope: (scope: string | null) => void
) {
	let active = true;
	let generation = 0;
	async function update(session: Session | null) {
		const request = ++generation;
		try {
			if (!session || session.user.id !== owner.userId) { onScope(null); return; }
			const payload = JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
			if (typeof payload.session_id !== 'string' || !payload.session_id) { onScope(null); return; }
			const next = await readinessNoticeScope(owner.userId, owner.merchantId, payload.session_id);
			if (active && request === generation) onScope(next);
		} catch { if (active && request === generation) onScope(null); }
	}
	const { data } = auth.onAuthStateChange((_event, session) => { if (active) void update(session); });
	const initialGeneration = generation;
	void auth.getSession().then(({ data }) => {
		if (active && generation === initialGeneration) void update(data.session);
	}).catch(() => {});
	return () => { active = false; data.subscription.unsubscribe(); };
}

export function createReadinessNoticeSession(storage?: NoticeStorage) {
	const records = new Map<string, ReturnType<typeof createRecord>>();
	function createRecord(scope: string) {
		const key = `dashboard:readiness:v1:${scope}`;
		let state: NoticeState = { deadline: null, acknowledged: false };
		try {
			const saved = JSON.parse(storage?.getItem(key) ?? 'null');
			if (saved && typeof saved.acknowledged === 'boolean' &&
				(saved.deadline === null || (typeof saved.deadline === 'number' && Number.isFinite(saved.deadline)))) {
				state = { deadline: saved.deadline, acknowledged: saved.acknowledged };
			}
		} catch { state = { deadline: null, acknowledged: false }; }
		const store = writable(state);
		function save() {
			try { storage?.setItem(key, JSON.stringify(state)); } catch { store.set(state); return; }
			store.set(state);
		}
		return {
			subscribe: store.subscribe,
			start(now = Date.now()) {
				if (state.acknowledged) return null;
				state = { ...state, deadline: state.deadline ?? now + 8000 };
				if (state.deadline! <= now) state.acknowledged = true;
				save();
				return state.acknowledged ? null : state.deadline;
			},
			acknowledge() {
				state = { ...state, acknowledged: true };
				save();
			}
		};
	}
	return {
		forScope(scope: string) {
			let record = records.get(scope);
			if (!record) { record = createRecord(scope); records.set(scope, record); }
			return record;
		}
	};
}

let browserSession: ReturnType<typeof createReadinessNoticeSession> | undefined;
export function readinessNoticeSession() {
	if (!browserSession) {
		let storage: Storage | undefined;
		try { storage = sessionStorage; } catch { storage = undefined; }
		browserSession = createReadinessNoticeSession(storage);
	}
	return browserSession;
}