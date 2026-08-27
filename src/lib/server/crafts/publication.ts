import { createHash } from 'node:crypto';
import { FieldValue } from '@google-cloud/firestore';
import { error } from '@sveltejs/kit';
import type { NotePage } from '$lib/editor/document/model';
import {
	countCraftWords,
	createPublishedCraftDocument,
	createPublishedCraftSummary,
	getPublishedCraftAssetIds,
	rewritePublishedAssetSources,
	toPublishedCraftSummary,
	type PublishedCraftMetadata,
	type PublishedCraftSummary
} from '$lib/crafts/publication';
import type { CraftDocument } from '$lib/crafts/types';
import { getCraftDocumentContent } from '$lib/crafts/document-content';
import { getBucket, getFirestore } from '$lib/server/notes-sync/firestore';

const PUBLISHED_CRAFTS_COLLECTION = 'published_crafts';

function collection() {
	return getFirestore().collection(PUBLISHED_CRAFTS_COLLECTION);
}

function bodyObject(page: NotePage) {
	return `published-crafts/${page.id}/${encodeURIComponent(page.updatedAt)}.json`;
}

export async function publishNoteCraft(
	ownerId: string,
	page: NotePage
): Promise<PublishedCraftSummary> {
	const summary = createPublishedCraftSummary(page);
	const [existing, slugMatch] = await Promise.all([
		collection().doc(page.id).get(),
		collection().where('slug', '==', summary.slug).limit(1).get()
	]);
	const existingRecord = existing.data() as PublishedCraftMetadata | undefined;
	const conflictingSlug = slugMatch.docs.find((document) => document.id !== page.id);

	if (existingRecord && existingRecord.ownerId !== ownerId) {
		throw error(403, 'You cannot replace this craft');
	}
	if (conflictingSlug) throw error(409, 'A published craft already uses this slug');

	const document = createPublishedCraftDocument(page);
	const data = Buffer.from(JSON.stringify(document));
	const bodyHash = createHash('sha256').update(data).digest('hex');
	const object = bodyObject(page);

	await getBucket()
		.file(object)
		.save(data, {
			contentType: 'application/json',
			resumable: false,
			metadata: { cacheControl: 'private, no-store', metadata: { sha256: bodyHash } }
		});

	const publishedAt = existingRecord?.publishedAt ?? new Date().toISOString();
	const record: PublishedCraftMetadata = {
		...summary,
		ownerId,
		assetIds: getPublishedCraftAssetIds(page),
		bodyHash,
		bodyObject: object,
		publishedAt
	};

	await collection()
		.doc(page.id)
		.set({ ...record, indexedAt: FieldValue.serverTimestamp() });
	if (existingRecord?.bodyObject && existingRecord.bodyObject !== object) {
		await getBucket().file(existingRecord.bodyObject).delete({ ignoreNotFound: true });
	}

	return summary;
}

export async function unpublishNoteCraft(ownerId: string, pageId: string): Promise<void> {
	const ref = collection().doc(pageId);
	const snapshot = await ref.get();
	if (!snapshot.exists) return;

	const record = snapshot.data() as PublishedCraftMetadata;
	if (record.ownerId !== ownerId) throw error(403, 'You cannot unpublish this craft');

	await ref.delete();
	await getBucket().file(record.bodyObject).delete({ ignoreNotFound: true });
}

export async function getNoteCraftPublication(ownerId: string, pageId: string) {
	const snapshot = await collection().doc(pageId).get();
	if (!snapshot.exists) return null;

	const record = snapshot.data() as PublishedCraftMetadata;
	return record.ownerId === ownerId ? toPublishedCraftSummary(record) : null;
}

export async function listPublishedCrafts(): Promise<PublishedCraftSummary[]> {
	const snapshot = await collection().orderBy('date', 'desc').get();

	return Promise.all(
		snapshot.docs.map(async (document) => {
			const metadata = document.data() as PublishedCraftMetadata;
			const summary = toPublishedCraftSummary(metadata);
			if (typeof summary.wordCount === 'number') return summary;

			try {
				const publishedDocument = await readPublishedCraftDocument(metadata);
				return {
					...summary,
					wordCount: countCraftWords(getCraftDocumentContent(publishedDocument), metadata.title)
				};
			} catch (cause) {
				console.error(
					`Could not derive the reading time for published craft ${metadata.slug}`,
					cause
				);
				return summary;
			}
		})
	);
}

export async function getPublishedCraftMetadata(
	slug: string
): Promise<PublishedCraftMetadata | null> {
	const snapshot = await collection().where('slug', '==', slug).limit(1).get();

	return (snapshot.docs[0]?.data() as PublishedCraftMetadata | undefined) ?? null;
}

export async function getPublishedCraftDocument(
	metadata: PublishedCraftMetadata
): Promise<CraftDocument> {
	const document = await readPublishedCraftDocument(metadata);
	return rewritePublishedAssetSources(document, metadata.slug);
}

async function readPublishedCraftDocument(
	metadata: PublishedCraftMetadata
): Promise<CraftDocument> {
	const [data] = await getBucket().file(metadata.bodyObject).download();
	const hash = createHash('sha256').update(data).digest('hex');
	if (hash !== metadata.bodyHash) throw error(500, 'Published craft failed its integrity check');

	return JSON.parse(data.toString('utf8')) as CraftDocument;
}
