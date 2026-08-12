import { browser } from '$app/environment';
import { auth } from '$lib/auth';
import {
	clearDirtyFlag,
	getDirtySyncRecords,
	getSyncCheckpoint,
	getSyncStateRow,
	hasPendingSyncWork,
	listSyncTombstones,
	loadNoteAsset,
	markAllRecordsDirty,
	removeSyncTombstone,
	setSyncCheckpoint
} from '../storage';
import { applyPullBatch } from './apply';
import { assetToPayload, pageToPayload } from './protocol';
import { onLocalMutation } from './signals';
import { pullChanges, pushChanges } from './sync.remote';

export type SyncStatus = 'idle' | 'pending' | 'syncing' | 'synced' | 'error';

const DEBOUNCE_MS = 2_000;
const PERIODIC_MS = 60_000;
const MIN_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 300_000;
const PULL_LIMIT = 25;
const MAX_PULL_ROUNDS = 25;
const PAGE_PUSH_BATCH_SIZE = 1;
const METADATA_PUSH_BATCH_SIZE = 100;
const SYNC_ENROLLED_FLAG_KEY = 'zaki.gg:notes:sync:enrolled';

export const syncState = $state({
	status: 'idle' as SyncStatus,
	lastSyncedAt: null as string | null
});

let started = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let backoffTimer: ReturnType<typeof setTimeout> | null = null;
let backoffMs = MIN_BACKOFF_MS;
let inFlight = false;
let runAgain = false;

function signedIn() {
	return Boolean(auth.user);
}

export function startSyncEngine(): void {
	if (!browser || started) return;
	started = true;

	onLocalMutation(() => {
		if (!signedIn()) return;
		if (syncState.status !== 'syncing') syncState.status = 'pending';
		requestSync();
	});

	window.addEventListener('online', () => syncNow());
	window.addEventListener('offline', () => {
		if (signedIn()) syncState.status = 'pending';
	});
	document.addEventListener('visibilitychange', () => {
		if (!document.hidden) syncNow();
	});
	setInterval(() => {
		if (!document.hidden) syncNow();
	}, PERIODIC_MS);
}

// Called after a successful sign-in. The first enrollment of a device queues
// all pre-existing local records so initial sync behaves like a normal push.
export async function handleSignedIn(): Promise<void> {
	if (!browser) return;

	if (!hasEnrolledFlag()) {
		await markAllRecordsDirty();
		setEnrolledFlag();
	}

	void syncNow();
}

export function requestSync(): void {
	if (!browser || !signedIn()) return;

	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => {
		debounceTimer = null;
		void runSync();
	}, DEBOUNCE_MS);
}

export async function syncNow(): Promise<void> {
	if (!browser || !signedIn()) return;

	if (debounceTimer) {
		clearTimeout(debounceTimer);
		debounceTimer = null;
	}

	await runSync();
}

async function runSync(): Promise<void> {
	if (!signedIn() || !navigator.onLine) return;

	if (inFlight) {
		runAgain = true;
		return;
	}

	inFlight = true;
	if (backoffTimer) {
		clearTimeout(backoffTimer);
		backoffTimer = null;
	}
	syncState.status = 'syncing';

	try {
		await pushCycle();
		await pullCycle();

		backoffMs = MIN_BACKOFF_MS;
		syncState.status = (await hasPendingSyncWork()) ? 'pending' : 'synced';
		syncState.lastSyncedAt = new Date().toISOString();
	} catch (error) {
		console.error('Craft sync failed', error);
		syncState.status = 'error';
		backoffTimer = setTimeout(() => {
			backoffTimer = null;
			void runSync();
		}, backoffMs);
		backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
	} finally {
		inFlight = false;
		if (runAgain) {
			runAgain = false;
			requestSync();
		}
	}
}

async function pushCycle(): Promise<void> {
	const [{ pages, assets }, tombstones] = await Promise.all([
		getDirtySyncRecords(),
		listSyncTombstones()
	]);

	if (!pages.length && !assets.length && !tombstones.length) return;

	const pagePayloads = (
		await Promise.all(
			pages.map(async (page) => {
				const state = await getSyncStateRow(page.id);
				return state ? pageToPayload(page, state.mutationId) : null;
			})
		)
	).filter((page) => page !== null);
	const assetPayloads = (
		await Promise.all(
			assets.map(async (asset) => {
				const state = await getSyncStateRow(asset.id);
				return state ? assetToPayload(asset, state.mutationId) : null;
			})
		)
	).filter((asset) => asset !== null);

	for (const batch of chunks(pagePayloads, PAGE_PUSH_BATCH_SIZE)) {
		await pushChanges({ pages: batch, assets: [], tombstones: [] });
		for (const payload of batch) {
			await clearDirtyFlag(payload.id, 'page', payload.mutationId);
		}
	}

	for (const batch of chunks(assetPayloads, METADATA_PUSH_BATCH_SIZE)) {
		const result = await pushChanges({ pages: [], assets: batch, tombstones: [] });
		for (const payload of batch) {
			await clearDirtyFlag(payload.id, 'asset', payload.mutationId);
		}
		for (const assetId of result.needsBlob) await uploadAssetBlob(assetId);
	}

	for (const batch of chunks(tombstones, METADATA_PUSH_BATCH_SIZE)) {
		await pushChanges({ pages: [], assets: [], tombstones: batch });
		// A stale tombstone means a newer remote edit exists; it resurrects the
		// record on pull, so the local tombstone is finished either way.
		for (const tombstone of batch) await removeSyncTombstone(tombstone.id);
	}
}

async function pullCycle(): Promise<void> {
	let since = await getSyncCheckpoint();

	for (let round = 0; round < MAX_PULL_ROUNDS; round++) {
		const batch = await pullChanges({ since, limit: PULL_LIMIT });

		await applyPullBatch(batch, downloadAssetBlob);

		if (batch.checkpoint && batch.checkpoint !== since) {
			await setSyncCheckpoint(batch.checkpoint);
			since = batch.checkpoint;
		} else if (batch.hasMore) {
			// Checkpoint failed to advance; bail rather than spin.
			break;
		}

		if (!batch.hasMore) break;
	}
}

async function uploadAssetBlob(assetId: string): Promise<void> {
	const asset = await loadNoteAsset(assetId);
	if (!asset) return;

	const response = await fetch(assetBlobUrl(assetId), {
		method: 'PUT',
		body: asset.blob,
		headers: { 'Content-Type': asset.mediaType || 'application/octet-stream' }
	});

	if (!response.ok) throw new Error(`Asset upload failed (${response.status})`);
}

async function downloadAssetBlob(assetId: string): Promise<Blob | null> {
	const response = await fetch(assetBlobUrl(assetId));

	if (response.status === 404) return null;
	if (!response.ok) throw new Error(`Asset download failed (${response.status})`);

	return response.blob();
}

function assetBlobUrl(assetId: string) {
	return `/api/pages/assets/${encodeURIComponent(assetId)}`;
}

function hasEnrolledFlag() {
	try {
		return window.localStorage.getItem(SYNC_ENROLLED_FLAG_KEY) === 'true';
	} catch {
		return false;
	}
}

function setEnrolledFlag() {
	try {
		window.localStorage.setItem(SYNC_ENROLLED_FLAG_KEY, 'true');
	} catch {
		// Best effort: worst case the next sign-in re-marks everything dirty,
		// which only costs a redundant push.
	}
}

function chunks<T>(items: T[], size: number): T[][] {
	const result: T[][] = [];
	for (let index = 0; index < items.length; index += size) {
		result.push(items.slice(index, index + size));
	}
	return result;
}
