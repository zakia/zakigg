import { Firestore } from '@google-cloud/firestore';
import { Storage, type Bucket } from '@google-cloud/storage';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import type { RemoteAssetDoc, RemotePageDoc, RemoteTombstoneDoc } from '$lib/notes/sync/protocol';

const PAGES_COLLECTION = 'notes_pages';
const ASSETS_COLLECTION = 'notes_assets';
const TOMBSTONES_COLLECTION = 'notes_tombstones';
const ASSET_OBJECT_PREFIX = 'notes-assets';

export type { RemoteAssetDoc, RemotePageDoc, RemoteTombstoneDoc };

export type PushStatus = 'accepted' | 'stale';

let firestore: Firestore | null = null;
let bucket: Bucket | null = null;

function getFirestore(): Firestore {
	// ADC: on Cloud Run credentials/project come from the metadata server; in
	// local dev from `gcloud auth application-default login` (+ GCP_PROJECT_ID).
	firestore ??= new Firestore(env.GCP_PROJECT_ID ? { projectId: env.GCP_PROJECT_ID } : undefined);

	return firestore;
}

function getBucket(): Bucket {
	if (!bucket) {
		const name = env.NOTES_GCS_BUCKET;
		if (!name) throw error(500, 'NOTES_GCS_BUCKET is not configured');
		bucket = new Storage(env.GCP_PROJECT_ID ? { projectId: env.GCP_PROJECT_ID } : undefined).bucket(
			name
		);
	}

	return bucket;
}

// syncedAt is a plain ISO string issued here rather than a Firestore server
// timestamp: string cursors compare lexicographically and sidestep Timestamp
// precision mismatches. Kept strictly increasing per instance so batched
// writes in one push never share a cursor value.
let lastIssuedSyncedAt = 0;

function issueSyncedAt(): string {
	lastIssuedSyncedAt = Math.max(Date.now(), lastIssuedSyncedAt + 1);

	return new Date(lastIssuedSyncedAt).toISOString();
}

// LWW acceptance: newer updatedAt wins; on an exact tie the larger id wins so
// every replica picks the same winner.
function incomingWins(
	incomingUpdatedAt: string,
	incomingId: string,
	existingUpdatedAt: string | undefined,
	existingId: string | undefined
): boolean {
	if (existingUpdatedAt === undefined) return true;

	const incoming = Date.parse(incomingUpdatedAt);
	const existing = Date.parse(existingUpdatedAt);

	if (incoming !== existing) return incoming > existing;

	return incomingId > (existingId ?? '');
}

export async function pushPageLww(page: Omit<RemotePageDoc, 'syncedAt'>): Promise<PushStatus> {
	const db = getFirestore();
	const pageRef = db.collection(PAGES_COLLECTION).doc(page.id);
	const tombstoneRef = db.collection(TOMBSTONES_COLLECTION).doc(page.id);

	return db.runTransaction(async (tx) => {
		const [existing, tombstone] = await Promise.all([tx.get(pageRef), tx.get(tombstoneRef)]);
		const existingUpdatedAt =
			(existing.data() as RemotePageDoc | undefined)?.updatedAt ??
			(tombstone.data() as RemoteTombstoneDoc | undefined)?.deletedAt;

		if (!incomingWins(page.updatedAt, page.id, existingUpdatedAt, existing.data()?.id)) {
			return 'stale';
		}

		tx.set(pageRef, { ...page, syncedAt: issueSyncedAt() });
		// An accepted edit newer than a pending delete resurrects the page.
		if (tombstone.exists) tx.delete(tombstoneRef);

		return 'accepted';
	});
}

export async function pushAssetLww(
	asset: Omit<RemoteAssetDoc, 'syncedAt' | 'blobUploaded'>
): Promise<{ status: PushStatus; needsBlob: boolean }> {
	const db = getFirestore();
	const assetRef = db.collection(ASSETS_COLLECTION).doc(asset.id);
	const tombstoneRef = db.collection(TOMBSTONES_COLLECTION).doc(asset.id);

	return db.runTransaction(async (tx) => {
		const [existing, tombstone] = await Promise.all([tx.get(assetRef), tx.get(tombstoneRef)]);
		const existingDoc = existing.data() as RemoteAssetDoc | undefined;
		const existingUpdatedAt =
			existingDoc?.updatedAt ?? (tombstone.data() as RemoteTombstoneDoc | undefined)?.deletedAt;

		if (!incomingWins(asset.updatedAt, asset.id, existingUpdatedAt, existingDoc?.id)) {
			return { status: 'stale' as const, needsBlob: false };
		}

		const blobUploaded = existingDoc?.blobUploaded ?? false;

		tx.set(assetRef, { ...asset, blobUploaded, syncedAt: issueSyncedAt() });
		if (tombstone.exists) tx.delete(tombstoneRef);

		return { status: 'accepted' as const, needsBlob: !blobUploaded };
	});
}

export async function pushTombstoneLww(tombstone: {
	id: string;
	kind: 'page' | 'asset';
	deletedAt: string;
}): Promise<PushStatus> {
	const db = getFirestore();
	const recordRef = db
		.collection(tombstone.kind === 'page' ? PAGES_COLLECTION : ASSETS_COLLECTION)
		.doc(tombstone.id);
	const tombstoneRef = db.collection(TOMBSTONES_COLLECTION).doc(tombstone.id);

	const status = await db.runTransaction(async (tx) => {
		const existing = await tx.get(recordRef);
		const existingUpdatedAt = (existing.data() as { updatedAt?: string } | undefined)?.updatedAt;

		// A delete only wins over a strictly older edit; a concurrent newer edit
		// on another device survives (edit-beats-older-delete).
		if (
			existingUpdatedAt !== undefined &&
			Date.parse(tombstone.deletedAt) <= Date.parse(existingUpdatedAt)
		) {
			return 'stale' as const;
		}

		tx.set(tombstoneRef, { ...tombstone, syncedAt: issueSyncedAt() });
		if (existing.exists) tx.delete(recordRef);

		return 'accepted' as const;
	});

	if (status === 'accepted' && tombstone.kind === 'asset') {
		await deleteAssetObject(tombstone.id);
	}

	return status;
}

export type PullResult = {
	pages: RemotePageDoc[];
	assets: RemoteAssetDoc[];
	tombstones: RemoteTombstoneDoc[];
	checkpoint: string | null;
	hasMore: boolean;
};

export async function pullSince(since: string | null, limit: number): Promise<PullResult> {
	const db = getFirestore();

	const queryCollection = async <T>(name: string): Promise<T[]> => {
		let query = db.collection(name).orderBy('syncedAt').limit(limit);
		if (since) query = db.collection(name).orderBy('syncedAt').startAfter(since).limit(limit);

		const snapshot = await query.get();

		return snapshot.docs.map((doc) => doc.data() as T);
	};

	const [pages, assets, tombstones] = await Promise.all([
		queryCollection<RemotePageDoc>(PAGES_COLLECTION),
		queryCollection<RemoteAssetDoc>(ASSETS_COLLECTION),
		queryCollection<RemoteTombstoneDoc>(TOMBSTONES_COLLECTION)
	]);

	const collections = [pages, assets, tombstones];
	const hasMore = collections.some((docs) => docs.length === limit);
	// The checkpoint may not advance past the last row of any truncated
	// collection, otherwise its remaining rows would be skipped next pull.
	// Rows past the checkpoint are re-pulled next round; applying is idempotent.
	const truncatedMaxes = collections
		.filter((docs) => docs.length === limit)
		.map((docs) => docs.at(-1)!.syncedAt);
	const globalMax =
		collections
			.flat()
			.map((doc) => doc.syncedAt)
			.sort()
			.at(-1) ?? null;
	const checkpoint = hasMore ? truncatedMaxes.sort()[0] : globalMax;

	return { pages, assets, tombstones, checkpoint, hasMore };
}

export async function getAssetDoc(id: string): Promise<RemoteAssetDoc | null> {
	const snapshot = await getFirestore().collection(ASSETS_COLLECTION).doc(id).get();

	return (snapshot.data() as RemoteAssetDoc | undefined) ?? null;
}

export async function markAssetBlobUploaded(id: string): Promise<void> {
	await getFirestore().collection(ASSETS_COLLECTION).doc(id).update({ blobUploaded: true });
}

function assetObject(id: string) {
	return getBucket().file(`${ASSET_OBJECT_PREFIX}/${id}`);
}

export async function saveAssetBlob(id: string, data: Buffer, contentType: string): Promise<void> {
	await assetObject(id).save(data, { contentType, resumable: false });
}

export async function readAssetBlob(
	id: string
): Promise<{ data: Buffer; contentType: string | undefined } | null> {
	const file = assetObject(id);

	try {
		const [metadata] = await file.getMetadata();
		const [data] = await file.download();

		return { data, contentType: metadata.contentType ?? undefined };
	} catch (err) {
		if ((err as { code?: number }).code === 404) return null;
		throw err;
	}
}

async function deleteAssetObject(id: string): Promise<void> {
	await assetObject(id).delete({ ignoreNotFound: true });
}
