import type { JSONContent } from '@tiptap/core';
import { normalizeLanguage } from './config';

export function escapeMarkdownInfo(value: string) {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function parseCodeFenceInfo(value: unknown) {
	const info = typeof value === 'string' ? value.trim() : '';
	const titleMatch = /(?:^|\s)title=(?:"([^"]*)"|'([^']*)'|([^\s]+))/.exec(info);
	const language = info
		.replace(/(?:^|\s)title=(?:"[^"]*"|'[^']*'|[^\s]+)/, '')
		.trim()
		.split(/\s+/)[0];

	return {
		language: normalizeLanguage(language),
		title: (titleMatch?.[1] ?? titleMatch?.[2] ?? titleMatch?.[3] ?? '').trim()
	};
}

export function createTextContent(
	value: string,
	helpers: { createTextNode: (text: string) => JSONContent }
) {
	return value ? [helpers.createTextNode(value)] : [];
}
