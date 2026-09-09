import type { Root } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { mdxJsxFromMarkdown } from 'mdast-util-mdx-jsx';
import { gfm } from 'micromark-extension-gfm';
import { mdxJsx } from 'micromark-extension-mdx-jsx';

type MarkdownNode = {
	type: string;
	value?: string;
	alt?: string | null;
	depth?: number;
	children?: MarkdownNode[];
};

export class MarkdownSyntaxError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'MarkdownSyntaxError';
	}
}

export function parseMarkdownAst(markdown: string): Root {
	try {
		return fromMarkdown(markdown, {
			extensions: [gfm(), mdxJsx()],
			mdastExtensions: [gfmFromMarkdown(), mdxJsxFromMarkdown()]
		});
	} catch (cause) {
		throw new MarkdownSyntaxError(
			cause instanceof Error ? cause.message : 'The Markdown document could not be parsed.'
		);
	}
}

export function getMarkdownText(markdown: string) {
	return nodeText(parseMarkdownAst(markdown) as MarkdownNode)
		.replace(/\s+/g, ' ')
		.trim();
}

export function getFirstMarkdownHeading(markdown: string) {
	const root = parseMarkdownAst(markdown) as MarkdownNode;
	const heading = root.children?.find((node) => node.type === 'heading' && node.depth === 1);
	if (!heading) return '';

	return nodeText(heading).replace(/\s+/g, ' ').trim();
}

function nodeText(node: MarkdownNode): string {
	if (node.type === 'text' || node.type === 'code' || node.type === 'inlineCode') {
		return node.value ?? '';
	}
	if (node.type === 'image') return node.alt ?? '';

	const separator = ['root', 'blockquote', 'list', 'listItem', 'table', 'tableRow'].includes(
		node.type
	)
		? ' '
		: '';
	return (node.children ?? []).map(nodeText).join(separator);
}
