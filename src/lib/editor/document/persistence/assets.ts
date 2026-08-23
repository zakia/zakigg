import type { MediaBlockKind } from '$lib/editor/core/media-block';

export type MediaAssetUploadInput = {
	fileName: string;
	mediaType: string;
	data: string;
};

const LOCAL_ASSET_PROTOCOL = 'local-asset://';
const IMAGE_MIME_RE = /^image\/(png|jpe?g|webp|gif|avif)$/i;
const VIDEO_MIME_RE = /^video\/(mp4|webm|quicktime|x-m4v)$/i;
const IMAGE_URL_RE = /\.(png|jpe?g|webp|gif|avif)(?:[?#].*)?$/i;
const VIDEO_URL_RE = /\.(mp4|m4v|mov|webm)(?:[?#].*)?$/i;

export function getMediaFiles(data: DataTransfer | null | undefined) {
	if (!data) return [];

	const files = new Map<string, File>();

	for (const file of Array.from(data.files ?? [])) {
		if (isMediaFile(file)) files.set(getFileKey(file), file);
	}

	for (const item of Array.from(data.items ?? [])) {
		if (item.kind !== 'file') continue;

		const file = item.getAsFile();
		if (file && isMediaFile(file)) files.set(getFileKey(file), file);
	}

	return [...files.values()];
}

export function isMediaFile(file: File) {
	return (
		isImageMime(file.type) ||
		isVideoMime(file.type) ||
		IMAGE_URL_RE.test(file.name) ||
		VIDEO_URL_RE.test(file.name)
	);
}

export function getMediaKindForFile(file: File): MediaBlockKind {
	if (isVideoMime(file.type) || VIDEO_URL_RE.test(file.name)) return 'video';

	return 'image';
}

export function getMediaKindForUrl(value: string): MediaBlockKind | null {
	const url = value.trim();

	if (IMAGE_URL_RE.test(url)) return 'image';
	if (VIDEO_URL_RE.test(url)) return 'video';

	try {
		const parsed = new URL(url);
		if (IMAGE_URL_RE.test(parsed.pathname)) return 'image';
		if (VIDEO_URL_RE.test(parsed.pathname)) return 'video';
	} catch {
		return null;
	}

	return null;
}

export function getAltTextForFile(file: File) {
	return file.name
		.replace(/\.[^.]+$/, '')
		.replace(/[-_]+/g, ' ')
		.trim();
}

export function createLocalAssetSrc(assetId: string) {
	return `${LOCAL_ASSET_PROTOCOL}${encodeURIComponent(assetId)}`;
}

export function getLocalAssetId(src: string) {
	if (!src.startsWith(LOCAL_ASSET_PROTOCOL)) return '';

	return decodeURIComponent(src.slice(LOCAL_ASSET_PROTOCOL.length));
}

export async function createMediaAssetUploadInput(file: File): Promise<MediaAssetUploadInput> {
	const dataUrl = await readFileAsDataUrl(file);
	const data = dataUrl.split(',', 2)[1] ?? '';

	return {
		fileName: file.name,
		mediaType: file.type,
		data
	};
}

export function readFileAsDataUrl(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = () => resolve(String(reader.result ?? ''));
		reader.onerror = () => reject(reader.error ?? new Error('Unable to read file.'));
		reader.readAsDataURL(file);
	});
}

function isImageMime(value: string) {
	return IMAGE_MIME_RE.test(value);
}

function isVideoMime(value: string) {
	return VIDEO_MIME_RE.test(value);
}

function getFileKey(file: File) {
	return [file.name, file.type, file.size, file.lastModified].join(':');
}
