const LOCAL_ASSET_PROTOCOL = 'local-asset://';
const IMAGE_MIME_RE = /^image\/(png|jpe?g|webp|gif|avif)$/i;
const VIDEO_MIME_RE = /^video\/(mp4|webm|quicktime|x-m4v)$/i;
const IMAGE_URL_RE = /\.(png|jpe?g|webp|gif|avif)(?:[?#].*)?$/i;
const VIDEO_URL_RE = /\.(mp4|m4v|mov|webm)(?:[?#].*)?$/i;

export function isMediaFile(file: File) {
	return (
		isImageMime(file.type) ||
		isVideoMime(file.type) ||
		IMAGE_URL_RE.test(file.name) ||
		VIDEO_URL_RE.test(file.name)
	);
}

export function createLocalAssetSrc(assetId: string) {
	return `${LOCAL_ASSET_PROTOCOL}${encodeURIComponent(assetId)}`;
}

export function getLocalAssetId(src: string) {
	if (!src.startsWith(LOCAL_ASSET_PROTOCOL)) return '';

	return decodeURIComponent(src.slice(LOCAL_ASSET_PROTOCOL.length));
}

function isImageMime(value: string) {
	return IMAGE_MIME_RE.test(value);
}

function isVideoMime(value: string) {
	return VIDEO_MIME_RE.test(value);
}
