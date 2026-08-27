export const DEFAULT_DOCUMENT_SLUG = 'default';

export function slugifyText(value: unknown) {
	return String(value ?? '')
		.toLowerCase()
		.trim()
		.replace(/['"`]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 72);
}

export function normalizeDocumentSlug(value: unknown) {
	return slugifyText(value) || DEFAULT_DOCUMENT_SLUG;
}

export function titleFromSlug(slug: string) {
	const title = normalizeDocumentSlug(slug)
		.split('-')
		.filter(Boolean)
		.map((word) => word[0]?.toUpperCase() + word.slice(1))
		.join(' ');

	return title || 'Untitled';
}
