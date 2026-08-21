import type { JSONContent } from '@tiptap/core';

// Page title and description belong to the page envelope. Older notes and
// imported Markdown may still carry a matching presentation header in the
// Tiptap document, so normalize that legacy shape at storage/import boundaries.
export function normalizePageBody(
	content: JSONContent,
	title: string,
	description = ''
): JSONContent {
	if (content.type !== 'doc' || !content.content?.length) return content;

	const children = [...content.content];
	const normalizedTitle = normalizeText(title);
	const normalizedDescription = normalizeText(description);
	const first = children[0];
	let removedTitle = false;

	if (
		first?.type === 'heading' &&
		Number(first.attrs?.level) === 1 &&
		normalizeText(nodeText(first)) === normalizedTitle
	) {
		children.shift();
		removedTitle = true;
	}

	const next = children[0];
	if (
		removedTitle &&
		normalizedDescription &&
		next?.type === 'heading' &&
		normalizeText(nodeText(next)) === normalizedDescription
	) {
		children.shift();
	}

	return { ...content, content: children.length ? children : [{ type: 'paragraph' }] };
}

function normalizeText(value: string) {
	return value.trim().replace(/\s+/g, ' ');
}

function nodeText(node: JSONContent): string {
	if (node.text) return node.text;

	return (node.content ?? []).map(nodeText).join('');
}
