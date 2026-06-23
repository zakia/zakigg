import type { JSONContent } from '@tiptap/core';
import { getReferencedAssetIds, type NotePageV1 } from './types';
import { serializeNoteMarkdown } from './markdown';
import { listFullNotePages, listNoteAssets, loadNoteAsset, type NotesAssetV1 } from './storage';
import { createZipBlob, downloadBlob, type ZipEntryInput } from './zip';

const EXPORT_VERSION = 1;

type ExportAsset = {
	id: string;
	path: string;
	name: string;
	mediaType: string;
	size: number;
	createdAt: string;
	updatedAt: string;
};

export async function downloadNotePageExport(
	page: NotePageV1,
	content: JSONContent = page.content
) {
	const blob = await createNotePageExportZip({
		...page,
		content
	});

	downloadBlob(blob, `${safeFileStem(page.slug || page.title)}.zip`);
}

export async function downloadNotesDatabaseExport() {
	const blob = await createNotesDatabaseExportZip();
	const date = new Date().toISOString().slice(0, 10);

	downloadBlob(blob, `notes-db-${date}.zip`);
}

export async function createNotePageExportZip(page: NotePageV1) {
	const entries: ZipEntryInput[] = [];
	const assetPaths = new Map<string, string>();
	const assets: ExportAsset[] = [];

	for (const assetId of getReferencedAssetIds(page.content)) {
		const asset = await loadNoteAsset(assetId);
		if (!asset) continue;

		const path = `assets/${assetFileName(asset)}`;
		assetPaths.set(asset.id, path);
		assets.push(serializeAsset(asset, path));
		entries.push({
			path,
			data: asset.blob,
			lastModified: new Date(asset.updatedAt)
		});
	}

	entries.unshift({
		path: 'page.md',
		data: serializeNoteMarkdown(page.content, { assetPaths }),
		lastModified: new Date(page.updatedAt)
	});
	entries.push({
		path: 'page.json',
		data: `${JSON.stringify(page, null, 2)}\n`,
		lastModified: new Date(page.updatedAt)
	});
	entries.push({
		path: 'manifest.json',
		data: `${JSON.stringify(
			{
				type: 'zaki.gg.notes.page',
				version: EXPORT_VERSION,
				exportedAt: new Date().toISOString(),
				page: serializePageManifest(page, 'page.md'),
				assets
			},
			null,
			2
		)}\n`
	});

	return createZipBlob(entries);
}

export async function createNotesDatabaseExportZip() {
	const [pages, allAssets] = await Promise.all([listFullNotePages(), listNoteAssets()]);
	const entries: ZipEntryInput[] = [];
	const assetPaths = new Map<string, string>();
	const assetManifest: ExportAsset[] = [];

	for (const asset of allAssets) {
		const path = `assets/${assetFileName(asset)}`;
		assetPaths.set(asset.id, path);
		assetManifest.push(serializeAsset(asset, path));
		entries.push({
			path,
			data: asset.blob,
			lastModified: new Date(asset.updatedAt)
		});
	}

	for (const page of pages) {
		entries.push({
			path: `pages/${safeFileStem(page.slug || page.title)}.md`,
			data: serializeNoteMarkdown(page.content, { assetPaths }),
			lastModified: new Date(page.updatedAt)
		});
		entries.push({
			path: `pages/${safeFileStem(page.slug || page.title)}.json`,
			data: `${JSON.stringify(page, null, 2)}\n`,
			lastModified: new Date(page.updatedAt)
		});
	}

	entries.push({
		path: 'manifest.json',
		data: `${JSON.stringify(
			{
				type: 'zaki.gg.notes.database',
				version: EXPORT_VERSION,
				exportedAt: new Date().toISOString(),
				pages: pages.map((page) =>
					serializePageManifest(page, `pages/${safeFileStem(page.slug || page.title)}.md`)
				),
				assets: assetManifest
			},
			null,
			2
		)}\n`
	});

	return createZipBlob(entries);
}

function serializePageManifest(page: NotePageV1, markdownPath: string) {
	return {
		id: page.id,
		slug: page.slug,
		title: page.title,
		tags: page.tags,
		markdownPath,
		jsonPath: markdownPath.replace(/\.md$/i, '.json'),
		assetIds: getReferencedAssetIds(page.content),
		createdAt: page.createdAt,
		updatedAt: page.updatedAt
	};
}

function serializeAsset(asset: NotesAssetV1, path: string): ExportAsset {
	return {
		id: asset.id,
		path,
		name: asset.name,
		mediaType: asset.mediaType,
		size: asset.size,
		createdAt: asset.createdAt,
		updatedAt: asset.updatedAt
	};
}

function assetFileName(asset: NotesAssetV1) {
	const stem = safeFileStem(asset.name.replace(/\.[^.]+$/, '')) || 'asset';
	const extension = getAssetExtension(asset);

	return `${asset.id}-${stem}${extension}`;
}

function getAssetExtension(asset: NotesAssetV1) {
	const fromName = asset.name.match(/\.([a-z0-9]{1,8})$/i)?.[0]?.toLowerCase();
	if (fromName) return fromName;

	switch (asset.mediaType.toLowerCase()) {
		case 'image/png':
			return '.png';
		case 'image/webp':
			return '.webp';
		case 'image/gif':
			return '.gif';
		case 'image/avif':
			return '.avif';
		case 'video/webm':
			return '.webm';
		case 'video/quicktime':
			return '.mov';
		case 'video/x-m4v':
			return '.m4v';
		case 'video/mp4':
			return '.mp4';
		default:
			return '.jpg';
	}
}

function safeFileStem(value: string) {
	return (
		value
			.toLowerCase()
			.trim()
			.replace(/['"`]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 72) || 'note'
	);
}
