import { describe, expect, it } from 'vitest';
import { DEFAULT_DOCUMENT_SLUG, normalizeDocumentSlug, slugifyText, titleFromSlug } from './slug';

describe('document slugs', () => {
	it('normalizes titles into stable URL slugs', () => {
		expect(slugifyText("  What's New in Svelte 5?  ")).toBe('whats-new-in-svelte-5');
		expect(slugifyText('Already---spaced')).toBe('already-spaced');
	});

	it('uses the default slug when no usable characters remain', () => {
		expect(normalizeDocumentSlug('---')).toBe(DEFAULT_DOCUMENT_SLUG);
		expect(normalizeDocumentSlug(null)).toBe(DEFAULT_DOCUMENT_SLUG);
	});

	it('derives readable titles without importing the editor model', () => {
		expect(titleFromSlug('editor-architecture')).toBe('Editor Architecture');
		expect(titleFromSlug('')).toBe('Default');
	});
});
