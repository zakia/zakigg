import type { JSONContent } from '@tiptap/core';
import {
	editorContentToMarkdown,
	markdownBodyToEditorContent
} from '$lib/editor/document/markdown-ast';
import type { CraftDocument } from './types';

export function getCraftDocumentContent(document: CraftDocument): JSONContent {
	if (document.version === 2) {
		return markdownBodyToEditorContent(stripFrontmatter(document.markdown));
	}

	return document.content;
}

/**
 * Converts either persisted craft generation into the Markdown source used by
 * the next editor. Keep legacy conversion at this boundary so the editor never
 * needs to understand Tiptap JSON.
 */
export function getCraftDocumentMarkdown(document: CraftDocument) {
	return document.version === 2
		? document.markdown
		: editorContentToMarkdown(normalizeCraftDocumentContent(document.content));
}

export function migrateCraftDocumentToMarkdown(document: CraftDocument): CraftDocument {
	if (document.version === 2) return document;

	return {
		version: 2,
		format: 'markdown',
		markdown: getCraftDocumentMarkdown(document),
		...(document.updatedAt ? { updatedAt: document.updatedAt } : {})
	};
}

export function isCraftDocumentContent(value: unknown): value is JSONContent {
	return Boolean(
		value && typeof value === 'object' && typeof (value as JSONContent).type === 'string'
	);
}

export function normalizeCraftDocumentContent(content: JSONContent): JSONContent {
	if (content.type !== 'doc' || !content.content?.length) return content;

	const children = [...content.content];

	while (children.length > 1 && isEmptyParagraph(children.at(-1))) {
		children.pop();
	}

	return children.length === content.content.length ? content : { ...content, content: children };
}

function isEmptyParagraph(node?: JSONContent) {
	return (
		node?.type === 'paragraph' &&
		(!node.content?.length ||
			node.content.every((child) => child.type === 'text' && (child.text ?? '').trim() === ''))
	);
}

function stripFrontmatter(markdown: string) {
	const match = markdown.match(/^\uFEFF?---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/);
	return match ? markdown.slice(match[0].length) : markdown;
}
