import { createHash } from 'node:crypto';
import { FieldPath, FieldValue, Firestore, Timestamp } from '@google-cloud/firestore';
import { Storage, type Bucket } from '@google-cloud/storage';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import {
	compareMutationVersions,
	type AssetPayload,
	type MutationVersion,
	type PagePayload,
	type PullBatch,
	type RemoteAssetDoc,
	type RemotePageDoc,
	type RemoteTombstoneDoc,
	type TombstonePayload
} from '$lib/notes/sync/protocol';

const USERS_COLLECTION = 'notes_users';
const PAGES_COLLECTION = 'pages';
const ASSETS_COLLECTION = 'assets';
const TOMBSTONES_COLLECTION = 'tombstones';
const CHANGES_COLLECTION = 'changes';
const REVISIONS_COLLECTION = 'revisions';

type StoredPageDoc = Omit<PagePayload, 'contentJson' | 'propertiesJson' | 'frontmatterJson'> & {
	frontmatterPresent: boolean;
	bodyObject: string;
	bodyHash: string;
	serverVersion: string;
};

type StoredAssetDoc = AssetPayload & {
	blobUploaded: boolean;
	serverVersion: string;
};

type StoredTombstoneDoc = TombstonePayload & { serverVersion: string };

type ChangeDoc = {
	recordId: string;
	kind: 'page' | 'asset';
	operation: 'put' | 'delete';
	serverAt: Timestamp;
};

type PageBody = {
	contentJson: string;
	propertiesJson: string;
	frontmatterJson?: string;
};

export type PushStatus = 'accepted' | 'stale';

let firestore: Firestore | null = null;
let bucket: Bucket | null = null;

function getFirestore(): Firestore {
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

function userCollection(userId: string, name: string) {
	return getFirestore().collection(USERS_COLLECTION).doc(userId).collection(name);
}

function versionOf(
	value: { updatedAt?: string; deletedAt?: string; mutationId?: string } | undefined
): MutationVersion | null {
	const updatedAt = value?.updatedAt ?? value?.deletedAt;
	return updatedAt && value?.mutationId ? { updatedAt, mutationId: value.mutationId } : null;
}

function incomingWins(incoming: MutationVersion, existing: MutationVersion | null): boolean {
	return !existing || compareMutationVersions(incoming, existing) > 0;
}

function pageBodyObject(userId: string, page: Pick<PagePayload, 'id' | 'mutationId'>) {
	return `users/${userId}/note-bodies/${page.id}/${page.mutationId}.json`;
}

function assetObject(userId: string, id: string) {
	return getBucket().file(`users/${userId}/assets/${id}`);
}

async function savePageBody(
	userId: string,
	page: PagePayload
): Promise<{ object: string; hash: string }> {
	const object = pageBodyObject(userId, page);
	const body: PageBody = {
		contentJson: page.contentJson,
		propertiesJson: page.propertiesJson,
		...(page.frontmatterJson ? { frontmatterJson: page.frontmatterJson } : {})
	};
	const data = Buffer.from(JSON.stringify(body));
	const hash = createHash('sha256').update(data).digest('hex');

	await getBucket()
		.file(object)
		.save(data, {
			contentType: 'application/json',
			resumable: false,
			metadata: { cacheControl: 'private, no-store', metadata: { sha256: hash } }
		});

	return { object, hash };
}

async function readPageBody(object: string, expectedHash: string): Promise<PageBody> {
	const [data] = await getBucket().file(object).download();
	const actualHash = createHash('sha256').update(data).digest('hex');
	if (actualHash !== expectedHash)
		throw new Error(`Note body integrity check failed for ${object}`);
	return JSON.parse(data.toString('utf8')) as PageBody;
}

export async function pushPageLww(userId: string, page: PagePayload): Promise<PushStatus> {
	const body = await savePageBody(userId, page);
	const pages = userCollection(userId, PAGES_COLLECTION);
	const tombstones = userCollection(userId, TOMBSTONES_COLLECTION);
	const changes = userCollection(userId, CHANGES_COLLECTION);
	const revisions = userCollection(userId, REVISIONS_COLLECTION);
	const pageRef = pages.doc(page.id);
	const tombstoneRef = tombstones.doc(page.id);
	const changeRef = changes.doc();
	const revisionRef = revisions.doc(`${page.id}__${page.mutationId}`);

	return getFirestore().runTransaction(async (tx) => {
		const [existingSnapshot, tombstoneSnapshot] = await Promise.all([
			tx.get(pageRef),
			tx.get(tombstoneRef)
		]);
		const existing = existingSnapshot.data() as StoredPageDoc | undefined;
		const tombstone = tombstoneSnapshot.data() as StoredTombstoneDoc | undefined;
		const currentVersion =
			[versionOf(existing), versionOf(tombstone)]
				.filter((value): value is MutationVersion => value !== null)
				.sort(compareMutationVersions)
				.at(-1) ?? null;
		const accepted = incomingWins(versionOf(page)!, currentVersion);

		tx.set(revisionRef, {
			recordId: page.id,
			mutationId: page.mutationId,
			updatedAt: page.updatedAt,
			bodyObject: body.object,
			bodyHash: body.hash,
			outcome: accepted ? 'accepted' : 'conflict',
			serverAt: FieldValue.serverTimestamp()
		});

		if (!accepted) return 'stale';

		const {
			contentJson: _content,
			propertiesJson: _properties,
			frontmatterJson,
			...metadata
		} = page;
		tx.set(pageRef, {
			...metadata,
			frontmatterPresent: frontmatterJson !== undefined,
			bodyObject: body.object,
			bodyHash: body.hash,
			serverVersion: changeRef.id
		} satisfies StoredPageDoc);
		if (tombstoneSnapshot.exists) tx.delete(tombstoneRef);
		tx.set(changeRef, {
			recordId: page.id,
			kind: 'page',
			operation: 'put',
			serverAt: FieldValue.serverTimestamp()
		});

		return 'accepted';
	});
}

export async function pushAssetLww(
	userId: string,
	asset: AssetPayload
): Promise<{ status: PushStatus; needsBlob: boolean }> {
	const assets = userCollection(userId, ASSETS_COLLECTION);
	const tombstones = userCollection(userId, TOMBSTONES_COLLECTION);
	const changes = userCollection(userId, CHANGES_COLLECTION);
	const assetRef = assets.doc(asset.id);
	const tombstoneRef = tombstones.doc(asset.id);
	const changeRef = changes.doc();

	return getFirestore().runTransaction(async (tx) => {
		const [existingSnapshot, tombstoneSnapshot] = await Promise.all([
			tx.get(assetRef),
			tx.get(tombstoneRef)
		]);
		const existing = existingSnapshot.data() as StoredAssetDoc | undefined;
		const tombstone = tombstoneSnapshot.data() as StoredTombstoneDoc | undefined;
		const currentVersion =
			[versionOf(existing), versionOf(tombstone)]
				.filter((value): value is MutationVersion => value !== null)
				.sort(compareMutationVersions)
				.at(-1) ?? null;

		if (!incomingWins(versionOf(asset)!, currentVersion)) {
			return { status: 'stale' as const, needsBlob: false };
		}

		const blobUploaded = existing?.blobUploaded ?? false;
		tx.set(assetRef, {
			...asset,
			blobUploaded,
			serverVersion: changeRef.id
		} satisfies StoredAssetDoc);
		if (tombstoneSnapshot.exists) tx.delete(tombstoneRef);
		tx.set(changeRef, {
			recordId: asset.id,
			kind: 'asset',
			operation: 'put',
			serverAt: FieldValue.serverTimestamp()
		});

		return { status: 'accepted' as const, needsBlob: !blobUploaded };
	});
}

export async function pushTombstoneLww(
	userId: string,
	tombstone: TombstonePayload
): Promise<PushStatus> {
	const records = userCollection(
		userId,
		tombstone.kind === 'page' ? PAGES_COLLECTION : ASSETS_COLLECTION
	);
	const tombstones = userCollection(userId, TOMBSTONES_COLLECTION);
	const changes = userCollection(userId, CHANGES_COLLECTION);
	const recordRef = records.doc(tombstone.id);
	const tombstoneRef = tombstones.doc(tombstone.id);
	const changeRef = changes.doc();

	const status = await getFirestore().runTransaction(async (tx) => {
		const [recordSnapshot, existingTombstoneSnapshot] = await Promise.all([
			tx.get(recordRef),
			tx.get(tombstoneRef)
		]);
		const record = recordSnapshot.data() as StoredPageDoc | StoredAssetDoc | undefined;
		const existingTombstone = existingTombstoneSnapshot.data() as StoredTombstoneDoc | undefined;
		const currentVersion =
			[versionOf(record), versionOf(existingTombstone)]
				.filter((value): value is MutationVersion => value !== null)
				.sort(compareMutationVersions)
				.at(-1) ?? null;
		const incoming = { updatedAt: tombstone.deletedAt, mutationId: tombstone.mutationId };

		if (!incomingWins(incoming, currentVersion)) return 'stale' as const;

		tx.set(tombstoneRef, {
			...tombstone,
			serverVersion: changeRef.id
		} satisfies StoredTombstoneDoc);
		if (recordSnapshot.exists) tx.delete(recordRef);
		tx.set(changeRef, {
			recordId: tombstone.id,
			kind: tombstone.kind,
			operation: 'delete',
			serverAt: FieldValue.serverTimestamp()
		});
		return 'accepted' as const;
	});

	if (status === 'accepted' && tombstone.kind === 'asset') {
		await assetObject(userId, tombstone.id).delete({ ignoreNotFound: true });
	}
	return status;
}

type CursorValue = { seconds: number; nanoseconds: number; id: string };

function encodeCursor(timestamp: Timestamp, id: string): string {
	return Buffer.from(
		JSON.stringify({
			seconds: timestamp.seconds,
			nanoseconds: timestamp.nanoseconds,
			id
		} satisfies CursorValue)
	).toString('base64url');
}

function decodeCursor(value: string): CursorValue {
	try {
		const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as CursorValue;
		if (!Number.isInteger(cursor.seconds) || !Number.isInteger(cursor.nanoseconds) || !cursor.id) {
			throw new Error('invalid cursor');
		}
		return cursor;
	} catch {
		throw error(400, 'Invalid sync checkpoint');
	}
}

export async function pullSince(
	userId: string,
	since: string | null,
	limit: number
): Promise<PullBatch> {
	let query = userCollection(userId, CHANGES_COLLECTION)
		.orderBy('serverAt')
		.orderBy(FieldPath.documentId())
		.limit(limit);
	if (since) {
		const cursor = decodeCursor(since);
		query = query.startAfter(new Timestamp(cursor.seconds, cursor.nanoseconds), cursor.id);
	}

	const snapshot = await query.get();
	if (snapshot.empty) {
		return { pages: [], assets: [], tombstones: [], checkpoint: since, hasMore: false };
	}

	const latestChanges = new Map<string, ChangeDoc>();
	for (const doc of snapshot.docs) {
		const change = doc.data() as ChangeDoc;
		latestChanges.set(`${change.kind}:${change.recordId}`, change);
	}

	const resolved = await Promise.all(
		[...latestChanges.values()].map((change) => resolveCurrentRecord(userId, change))
	);
	const last = snapshot.docs.at(-1)!;
	const lastTimestamp = last.get('serverAt') as Timestamp;

	return {
		pages: resolved.flatMap((item) => (item?.page ? [item.page] : [])),
		assets: resolved.flatMap((item) => (item?.asset ? [item.asset] : [])),
		tombstones: resolved.flatMap((item) => (item?.tombstone ? [item.tombstone] : [])),
		checkpoint: encodeCursor(lastTimestamp, last.id),
		hasMore: snapshot.size === limit
	};
}

async function resolveCurrentRecord(
	userId: string,
	change: ChangeDoc
): Promise<{
	page?: RemotePageDoc;
	asset?: RemoteAssetDoc;
	tombstone?: RemoteTombstoneDoc;
} | null> {
	const recordCollection = change.kind === 'page' ? PAGES_COLLECTION : ASSETS_COLLECTION;
	const [recordSnapshot, tombstoneSnapshot] = await Promise.all([
		userCollection(userId, recordCollection).doc(change.recordId).get(),
		userCollection(userId, TOMBSTONES_COLLECTION).doc(change.recordId).get()
	]);

	if (recordSnapshot.exists) {
		if (change.kind === 'asset') {
			return { asset: recordSnapshot.data() as RemoteAssetDoc };
		}
		const stored = recordSnapshot.data() as StoredPageDoc;
		const body = await readPageBody(stored.bodyObject, stored.bodyHash);
		const {
			bodyObject: _object,
			bodyHash: _hash,
			frontmatterPresent: _present,
			...metadata
		} = stored;
		return { page: { ...metadata, ...body } };
	}

	if (tombstoneSnapshot.exists) {
		return { tombstone: tombstoneSnapshot.data() as RemoteTombstoneDoc };
	}
	return null;
}

export async function getAssetDoc(userId: string, id: string): Promise<RemoteAssetDoc | null> {
	const snapshot = await userCollection(userId, ASSETS_COLLECTION).doc(id).get();
	return (snapshot.data() as RemoteAssetDoc | undefined) ?? null;
}

export async function markAssetBlobUploaded(userId: string, id: string): Promise<void> {
	const assetRef = userCollection(userId, ASSETS_COLLECTION).doc(id);
	const changeRef = userCollection(userId, CHANGES_COLLECTION).doc();

	await getFirestore().runTransaction(async (tx) => {
		const snapshot = await tx.get(assetRef);
		if (!snapshot.exists) throw error(404, 'Asset metadata not found');
		tx.update(assetRef, { blobUploaded: true, serverVersion: changeRef.id });
		tx.set(changeRef, {
			recordId: id,
			kind: 'asset',
			operation: 'put',
			serverAt: FieldValue.serverTimestamp()
		});
	});
}

export async function saveAssetBlob(
	userId: string,
	id: string,
	data: Buffer,
	contentType: string
): Promise<void> {
	await assetObject(userId, id).save(data, {
		contentType,
		resumable: false,
		metadata: { cacheControl: 'private, no-store' }
	});
}

export async function readAssetBlob(
	userId: string,
	id: string
): Promise<{ data: Buffer; contentType: string | undefined } | null> {
	const file = assetObject(userId, id);
	try {
		const [metadata] = await file.getMetadata();
		const [data] = await file.download();
		return { data, contentType: metadata.contentType ?? undefined };
	} catch (cause) {
		if ((cause as { code?: number }).code === 404) return null;
		throw cause;
	}
}
