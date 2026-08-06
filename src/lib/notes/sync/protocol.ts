import type { JSONContent } from '@tiptap/core';
import type { MetadataEntry } from '../metadata-block';
import { parseStoredPage, type NotePageV1 } from '../types';
import type { NotesAssetV1, SyncKind } from '../storage';

export type MutationVersion = {
	updatedAt: string;
	mutationId: string;
};

export type PagePayload = {
	id: string;
	slug: string;
	title: string;
	tags: string[];
	createdAt: string;
	updatedAt: string;
	mutationId: string;
	contentJson: string;
	propertiesJson: string;
	frontmatterJson?: string;
};

export type AssetPayload = {
	id: string;
	mediaType: string;
	name: string;
	size: number;
	pageIds: string[];
	createdAt: string;
	updatedAt: string;
	mutationId: string;
	blobUploaded?: boolean;
};

export type TombstonePayload = {
	id: string;
	kind: SyncKind;
	deletedAt: string;
	mutationId: string;
};

export type RemotePageDoc = PagePayload & { serverVersion: string };
export type RemoteAssetDoc = AssetPayload & { serverVersion: string; blobUploaded: boolean };
export type RemoteTombstoneDoc = TombstonePayload & { serverVersion: string };

export type PullBatch = {
	pages: RemotePageDoc[];
	assets: RemoteAssetDoc[];
	tombstones: RemoteTombstoneDoc[];
	checkpoint: string | null;
	hasMore: boolean;
};

export function pageToPayload(page: NotePageV1, mutationId: string): PagePayload {
	return {
		id: page.id,
		slug: page.slug,
		title: page.title,
		tags: page.tags,
		createdAt: page.createdAt,
		updatedAt: page.updatedAt,
		mutationId,
		contentJson: JSON.stringify(page.content),
		propertiesJson: JSON.stringify(page.properties),
		...(page.frontmatter ? { frontmatterJson: JSON.stringify(page.frontmatter) } : {})
	};
}

export function payloadToPage(payload: RemotePageDoc): NotePageV1 | null {
	try {
		const content = JSON.parse(payload.contentJson) as JSONContent;
		const properties = JSON.parse(payload.propertiesJson) as MetadataEntry[];
		const frontmatter = payload.frontmatterJson
			? (JSON.parse(payload.frontmatterJson) as NotePageV1['frontmatter'])
			: undefined;

		return parseStoredPage({
			version: 1,
			editor: 'tiptap',
			id: payload.id,
			slug: payload.slug,
			title: payload.title,
			tags: payload.tags,
			properties,
			...(frontmatter ? { frontmatter } : {}),
			content,
			createdAt: payload.createdAt,
			updatedAt: payload.updatedAt
		});
	} catch {
		return null;
	}
}

export function assetToPayload(asset: NotesAssetV1, mutationId: string): AssetPayload {
	return {
		id: asset.id,
		mediaType: asset.mediaType,
		name: asset.name,
		size: asset.size,
		pageIds: asset.pageIds ?? [],
		createdAt: asset.createdAt,
		updatedAt: asset.updatedAt,
		mutationId
	};
}

export function payloadToAssetMeta(payload: RemoteAssetDoc): Omit<NotesAssetV1, 'blob'> {
	return {
		id: payload.id,
		mediaType: payload.mediaType,
		name: payload.name,
		size: payload.size,
		pageIds: payload.pageIds,
		createdAt: payload.createdAt,
		updatedAt: payload.updatedAt
	};
}

export function compareMutationVersions(a: MutationVersion, b: MutationVersion): number {
	const timeDifference = Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
	if (timeDifference !== 0) return timeDifference;

	return a.mutationId.localeCompare(b.mutationId);
}

export function remoteWins(
	remoteUpdatedAt: string,
	remoteMutationId: string,
	localUpdatedAt: string,
	localMutationId: string
): boolean {
	return (
		compareMutationVersions(
			{ updatedAt: remoteUpdatedAt, mutationId: remoteMutationId },
			{ updatedAt: localUpdatedAt, mutationId: localMutationId }
		) > 0
	);
}
