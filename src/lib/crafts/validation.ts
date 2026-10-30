import { readFrontmatter } from '#lib/editor/document/frontmatter.js';

export function validateCraftProperties(values: Record<string, unknown>) {
	for (const key of ['id', 'title', 'slug', 'description']) {
		if (values[key] != null && typeof values[key] !== 'string') return `${key} must be text.`;
	}
	if (
		values.date != null &&
		(typeof values.date !== 'string' ||
			(values.date !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(values.date)))
	)
		return 'date must use YYYY-MM-DD.';
	if (
		values.tags != null &&
		(!Array.isArray(values.tags) || !values.tags.every((value) => typeof value === 'string'))
	)
		return 'tags must be a list of text values.';
	for (const key of ['published', 'draft']) {
		if (values[key] != null && typeof values[key] !== 'boolean')
			return `${key} must be true or false.`;
	}
	return null;
}

export function validateCraftSource(source: string): string | null {
	const parsed = readFrontmatter(source);
	return parsed.error || validateCraftProperties(parsed.values ?? {});
}
