import type { JSONContent } from '@tiptap/core';

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
