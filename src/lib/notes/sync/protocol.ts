import type { JSONContent } from '@tiptap/core';
import type { NotesAssetV1, SyncTombstone } from '../storage';
import { parseStoredPage, type NotePageV1 } from '../types';

// Wire/Firestore shapes shared by client and server. Tiptap content and
// frontmatter travel as JSON strings: byte-exact round-trips, no Firestore
// nested-array restrictions, one index entry instead of thousands.

export type RemotePageDoc = {
	id: string;
	slug: string;
	title: string;
	tags: string[];
	createdAt: string;
	updatedAt: string;
	contentJson: string;
	frontmatterJson?: string;
	syncedAt: string;
};

export type RemoteAssetDoc = {
	id: string;
	mediaType: string;
	name: string;
	size: number;
	pageIds: string[];
	createdAt: string;
	updatedAt: string;
	blobUploaded: boolean;
	syncedAt: string;
};

export type RemoteTombstoneDoc = SyncTombstone & { syncedAt: string };

// Firestore docs are capped at 1 MiB; leave headroom for the other fields.
export const MAX_CONTENT_JSON_LENGTH = 900_000;

export function pageToPayload(page: NotePageV1) {
	return {
		id: page.id,
		slug: page.slug,
		title: page.title,
		tags: page.tags,
		createdAt: page.createdAt,
		updatedAt: page.updatedAt,
		contentJson: JSON.stringify(page.content),
		frontmatterJson: page.frontmatter ? JSON.stringify(page.frontmatter) : undefined
	};
}

export function payloadToPage(doc: RemotePageDoc): NotePageV1 | null {
	let content: JSONContent;
	let frontmatter: unknown;

	try {
		content = JSON.parse(doc.contentJson);
		frontmatter = doc.frontmatterJson ? JSON.parse(doc.frontmatterJson) : undefined;
	} catch {
		return null;
	}

	return parseStoredPage({
		version: 1,
		editor: 'tiptap',
		id: doc.id,
		slug: doc.slug,
		title: doc.title,
		tags: doc.tags,
		frontmatter,
		content,
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt
	});
}

export function assetToPayload(asset: NotesAssetV1) {
	return {
		id: asset.id,
		mediaType: asset.mediaType,
		name: asset.name,
		size: asset.size,
		pageIds: asset.pageIds ?? [],
		createdAt: asset.createdAt,
		updatedAt: asset.updatedAt
	};
}

export function payloadToAssetMeta(doc: RemoteAssetDoc): Omit<NotesAssetV1, 'blob'> {
	return {
		id: doc.id,
		mediaType: doc.mediaType,
		name: doc.name,
		size: doc.size,
		pageIds: doc.pageIds,
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt
	};
}

// Deterministic LWW winner shared by server and client: newer updatedAt wins;
// on an exact tie the larger id wins so every replica picks the same winner.
export function remoteWins(
	remoteUpdatedAt: string,
	remoteId: string,
	localUpdatedAt: string,
	localId: string
): boolean {
	const remote = Date.parse(remoteUpdatedAt);
	const local = Date.parse(localUpdatedAt);

	if (remote !== local) return remote > local;

	return remoteId > localId;
}
