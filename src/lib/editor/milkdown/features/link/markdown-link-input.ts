import type { Link, Paragraph, Root, Text } from 'mdast';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import { linkSchema } from '@milkdown/kit/preset/commonmark';
import { $inputRule } from '@milkdown/kit/utils';
import { parseMarkdownAst } from '$lib/editor/document/markdown-ast';

const MARKDOWN_LINK_AT_CURSOR = /(^|[^!\\])(\[[^\n]+]\([^\n]*\))$/;

export type ParsedMarkdownLinkInput = {
	label: string;
	href: string;
	title: string | null;
};

/** Parse the candidate with the canonical Markdown parser before changing it. */
export function parseMarkdownLinkInput(candidate: string): ParsedMarkdownLinkInput | undefined {
	let tree: Root;
	try {
		tree = parseMarkdownAst(candidate);
	} catch {
		return;
	}
	if (tree.children.length !== 1 || tree.children[0]?.type !== 'paragraph') return;
	const paragraph = tree.children[0] as Paragraph;
	if (paragraph.children.length !== 1 || paragraph.children[0]?.type !== 'link') return;
	const link = paragraph.children[0] as Link;
	if (!link.children.length || !link.children.every((child) => child.type === 'text')) return;
	const label = (link.children as Text[]).map((child) => child.value).join('');
	if (!label || !link.url) return;
	return { label, href: link.url, title: link.title ?? null };
}

export const markdownLinkInputRule = $inputRule((ctx) => {
	const type = linkSchema.type(ctx);
	return new InputRule(MARKDOWN_LINK_AT_CURSOR, (state, match, start, end) => {
		const prefix = match[1] ?? '';
		const candidate = match[2];
		if (!candidate) return null;
		const parsed = parseMarkdownLinkInput(candidate);
		if (!parsed) return null;

		const from = start + prefix.length;
		const marks = (state.storedMarks ?? state.doc.resolve(from).marks()).filter(
			(mark) => mark.type.name !== 'link' && mark.type.name !== 'wikiLink'
		);
		const link = type.create({ href: parsed.href, title: parsed.title });
		return state.tr.replaceWith(from, end, state.schema.text(parsed.label, [...marks, link]));
	});
});
