import { getReferencedAssetIds, parseStoredPage, type NotePageV1 } from '../model';
import { importNoteAsset, importNotePage } from './storage';
import { readZipEntries } from './zip';

const decoder = new TextDecoder();

type ManifestAsset = {
	id?: string;
	path?: string;
	name?: string;
	mediaType?: string;
	size?: number;
	createdAt?: string;
	updatedAt?: string;
};

type ImportManifest = {
	page?: { jsonPath?: string };
	pages?: { jsonPath?: string }[];
	assets?: ManifestAsset[];
};

export type NotesImportResult = {
	pages: NotePageV1[];
	assetCount: number;
};

export function isNotesArchiveFile(file: File) {
	return (
		/\.zip$/i.test(file.name) ||
		file.type === 'application/zip' ||
		file.type === 'application/x-zip-compressed'
	);
}

export async function importNotesFromZip(source: Blob): Promise<NotesImportResult> {
	const entries = await readZipEntries(source);
	const files = new Map(entries.map((entry) => [entry.path, entry.bytes]));
	const manifest = readJson<ImportManifest>(files.get('manifest.json'));

	const parsedPages = resolvePageJsonPaths(files, manifest)
		.map((path) => parseStoredPage(readJson(files.get(path))))
		.filter((page): page is NotePageV1 => Boolean(page));

	if (!parsedPages.length) {
		throw new Error('No importable note pages were found in this archive.');
	}

	const assetCount = await importAssets(files, manifest, parsedPages);
	const pages: NotePageV1[] = [];

	for (const page of parsedPages) {
		pages.push(await importNotePage(page));
	}

	return { pages, assetCount };
}

function resolvePageJsonPaths(files: Map<string, Uint8Array>, manifest: ImportManifest | null) {
	const declared: string[] = [];

	if (manifest?.page?.jsonPath) declared.push(manifest.page.jsonPath);

	for (const page of manifest?.pages ?? []) {
		if (page?.jsonPath) declared.push(page.jsonPath);
	}

	const existing = declared.filter((path) => files.has(path));
	if (existing.length) return unique(existing);

	return [...files.keys()].filter(
		(path) => /\.json$/i.test(path) && basename(path).toLowerCase() !== 'manifest.json'
	);
}

async function importAssets(
	files: Map<string, Uint8Array>,
	manifest: ImportManifest | null,
	pages: NotePageV1[]
) {
	const assets = Array.isArray(manifest?.assets)
		? manifest.assets
		: inferAssetsFromPages(files, pages);

	let count = 0;

	for (const asset of assets) {
		if (!asset?.id || !asset?.path) continue;

		const bytes = files.get(asset.path);
		if (!bytes) continue;

		const mediaType = asset.mediaType || guessMediaType(asset.path);

		await importNoteAsset({
			id: asset.id,
			blob: new Blob([bytes.slice().buffer as ArrayBuffer], { type: mediaType }),
			mediaType,
			name: asset.name || basename(asset.path),
			size: asset.size ?? bytes.byteLength,
			createdAt: asset.createdAt,
			updatedAt: asset.updatedAt
		});

		count += 1;
	}

	return count;
}

function inferAssetsFromPages(
	files: Map<string, Uint8Array>,
	pages: NotePageV1[]
): ManifestAsset[] {
	const referencedIds = unique(pages.flatMap((page) => getReferencedAssetIds(page.content)));
	const assetPaths = [...files.keys()].filter((path) => path.startsWith('assets/'));

	return referencedIds
		.map((id) => {
			const path = assetPaths.find((candidate) => basename(candidate).startsWith(`${id}-`));

			return path ? { id, path } : null;
		})
		.filter((asset): asset is { id: string; path: string } => Boolean(asset));
}

function readJson<T = unknown>(bytes: Uint8Array | undefined): T | null {
	if (!bytes) return null;

	try {
		return JSON.parse(decoder.decode(bytes)) as T;
	} catch {
		return null;
	}
}

function basename(path: string) {
	return path.split('/').pop() ?? path;
}

function unique<T>(values: T[]) {
	return [...new Set(values)];
}

function guessMediaType(path: string) {
	const extension = path.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase();

	switch (extension) {
		case 'png':
			return 'image/png';
		case 'webp':
			return 'image/webp';
		case 'gif':
			return 'image/gif';
		case 'avif':
			return 'image/avif';
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		case 'webm':
			return 'video/webm';
		case 'mov':
			return 'video/quicktime';
		case 'm4v':
			return 'video/x-m4v';
		case 'mp4':
			return 'video/mp4';
		default:
			return 'application/octet-stream';
	}
}
