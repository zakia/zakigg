export type MediaKind = 'image' | 'video' | 'audio' | 'attachment';

const IMAGE_URL_RE = /\.(png|jpe?g|webp|gif|avif)(?:[?#].*)?$/i;
const VIDEO_URL_RE = /\.(mp4|m4v|mov|webm)(?:[?#].*)?$/i;
const AUDIO_URL_RE = /\.(mp3|wav|ogg|m4a|aac|flac|weba)(?:[?#].*)?$/i;

const MIME_EXTENSIONS: Record<string, string> = {
	'image/png': '.png',
	'image/jpeg': '.jpg',
	'image/webp': '.webp',
	'image/gif': '.gif',
	'image/avif': '.avif',
	'video/mp4': '.mp4',
	'video/webm': '.webm',
	'video/quicktime': '.mov',
	'audio/mpeg': '.mp3',
	'audio/wav': '.wav',
	'audio/x-wav': '.wav',
	'audio/ogg': '.ogg',
	'audio/mp4': '.m4a',
	'audio/aac': '.aac',
	'audio/flac': '.flac',
	'audio/webm': '.weba'
};

export function mediaKindForFile(file: File): MediaKind {
	return mediaKindForMime(file.type);
}

function mediaKindForMime(type: string): MediaKind {
	if (type.startsWith('image/')) return 'image';
	if (type.startsWith('video/')) return 'video';
	if (type.startsWith('audio/')) return 'audio';
	return 'attachment';
}

export function mediaKindForUrl(url: string): MediaKind {
	if (IMAGE_URL_RE.test(url)) return 'image';
	if (VIDEO_URL_RE.test(url)) return 'video';
	if (AUDIO_URL_RE.test(url)) return 'audio';
	return 'attachment';
}

export function mediaUrlForAsset(assetId: string, fileName: string, mediaType = '') {
	const nameExtension = fileExtension(fileName);
	const expectedKind = mediaKindForMime(mediaType);
	const compatible = nameExtension && mediaKindForUrl(`file${nameExtension}`) === expectedKind;
	const extension = compatible
		? nameExtension
		: MIME_EXTENSIONS[mediaType.toLowerCase()] || nameExtension || '.bin';
	return `/media/${assetId}${extension}`;
}

export function altTextFromFile(file: File) {
	return (
		file.name
			.replace(/\.[^.]+$/, '')
			.replace(/[-_]+/g, ' ')
			.trim() || 'file'
	);
}

export function assetIdFromMediaUrl(url: string) {
	const match = url.match(/^\/media\/(asset_[A-Za-z0-9_-]+)(?:\.[a-z0-9]{1,8})?$/i);
	return match?.[1] ?? '';
}

export function escapeAlt(value: string) {
	return value.replace(/\\/g, '\\\\').replace(/]/g, '\\]').replace(/\n/g, ' ');
}

function fileExtension(fileName: string) {
	const match = fileName.match(/\.([a-z0-9]{1,8})$/i);
	return match ? `.${match[1].toLowerCase()}` : '';
}
