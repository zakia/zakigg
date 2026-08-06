import { browser } from '$app/environment';
import {
	clearDirtyFlag,
	getDirtySyncRecords,
	getSyncCheckpoint,
	hasPendingSyncWork,
	listSyncTombstones,
	loadNoteAsset,
	markAllRecordsDirty,
	removeSyncTombstone,
	setSyncCheckpoint
} from '../storage';
import { applyPullBatch } from './apply';
import { MAX_CONTENT_JSON_LENGTH, assetToPayload, pageToPayload } from './protocol';
import { syncSession } from './session.svelte';
import { onLocalMutation } from './signals';
import { pullChanges, pushChanges } from './sync.remote';

export type SyncStatus = 'idle' | 'pending' | 'syncing' | 'synced' | 'error';

const DEBOUNCE_MS = 2_000;
const PERIODIC_MS = 60_000;
const MIN_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 300_000;
const PULL_LIMIT = 200;
const MAX_PULL_ROUNDS = 25;
const SYNC_ENROLLED_FLAG_KEY = 'zaki.gg:notes:sync:enrolled';

export const syncState = $state({
	status: 'idle' as SyncStatus,
	lastSyncedAt: null as string | null,
	// Notes too large for Firestore's doc limit, surfaced in the UI.
	oversizedPageIds: [] as string[]
});

let started = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let backoffTimer: ReturnType<typeof setTimeout> | null = null;
let backoffMs = MIN_BACKOFF_MS;
let inFlight = false;
let runAgain = false;

function signedIn() {
	return syncSession.status === 'signed-in';
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
		console.error('Notes sync failed', error);
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

	const pagePayloads = pages.map(pageToPayload);
	// Oversized notes stay local-only (and dirty); pushing them would fail the
	// whole batch at validation.
	const oversized = pagePayloads.filter((p) => p.contentJson.length > MAX_CONTENT_JSON_LENGTH);
	const pushablePages = pagePayloads.filter((p) => p.contentJson.length <= MAX_CONTENT_JSON_LENGTH);

	syncState.oversizedPageIds = oversized.map((p) => p.id);

	const result = await pushChanges({
		pages: pushablePages,
		assets: assets.map(assetToPayload),
		tombstones: tombstones.map(({ id, kind, deletedAt }) => ({ id, kind, deletedAt }))
	});

	// 'stale' also clears the dirty flag: the server kept a newer version,
	// which arrives on the next pull.
	for (const page of pages) {
		if (syncState.oversizedPageIds.includes(page.id)) continue;
		await clearDirtyFlag(page.id, 'page', page.updatedAt);
	}
	for (const asset of assets) {
		await clearDirtyFlag(asset.id, 'asset', asset.updatedAt);
	}
	// A stale tombstone means a newer remote edit exists; it resurrects the
	// record on pull, so the local tombstone is finished either way.
	for (const tombstone of tombstones) {
		await removeSyncTombstone(tombstone.id);
	}

	for (const assetId of result.needsBlob) {
		await uploadAssetBlob(assetId);
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
	return `/notes/sync/assets/${encodeURIComponent(assetId)}`;
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
