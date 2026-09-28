export type MediaBlockKind = 'image' | 'video';
export type MediaBlockAlign = 'left' | 'center' | 'right';

export type MediaBlockAttrs = {
	kind: MediaBlockKind;
	src: string;
	assetId: string;
	alt: string;
	title: string;
	caption: string;
	width: number;
	align: MediaBlockAlign;
	controls: boolean;
	autoplay: boolean;
	loop: boolean;
	muted: boolean;
};

const VIDEO_SOURCE_RE = /\.(mp4|m4v|mov|webm)(?:[?#].*)?$/i;
const MIN_MEDIA_WIDTH_PERCENT = 24;
const MAX_MEDIA_WIDTH_PERCENT = 100;

export function normalizeMediaBlockAttrs(attrs: Partial<MediaBlockAttrs> = {}): MediaBlockAttrs {
	const src = normalizeString(attrs.src);
	const kind = normalizeMediaKind(attrs.kind ?? inferMediaKindFromSource(src));

	return {
		kind,
		src,
		assetId: normalizeString(attrs.assetId),
		alt: normalizeString(attrs.alt),
		title: normalizeString(attrs.title),
		caption: normalizeString(attrs.caption),
		width: normalizeMediaWidthPercent(attrs.width),
		align: normalizeMediaAlign(attrs.align),
		controls: normalizeBoolean(attrs.controls, kind === 'video'),
		autoplay: normalizeBoolean(attrs.autoplay, false),
		loop: normalizeBoolean(attrs.loop, false),
		muted: normalizeBoolean(attrs.muted, false)
	};
}

function normalizeMediaWidthPercent(value: unknown) {
	const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number(value);

	if (!Number.isFinite(parsed)) return MAX_MEDIA_WIDTH_PERCENT;

	return clamp(Math.round(parsed * 10) / 10, MIN_MEDIA_WIDTH_PERCENT, MAX_MEDIA_WIDTH_PERCENT);
}

function normalizeMediaKind(value: unknown): MediaBlockKind {
	return value === 'video' ? 'video' : 'image';
}

function normalizeMediaAlign(value: unknown): MediaBlockAlign {
	if (value === 'left' || value === 'right') return value;

	return 'center';
}

function inferMediaKindFromSource(src: string): MediaBlockKind {
	return VIDEO_SOURCE_RE.test(src) ? 'video' : 'image';
}

function normalizeString(value: unknown) {
	return typeof value === 'string' ? value.trim() : '';
}

function normalizeBoolean(value: unknown, fallback: boolean) {
	return typeof value === 'boolean' ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}
