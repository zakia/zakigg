import { $mark, $remark } from '@milkdown/kit/utils';
import type { Root } from 'mdast';

type MarkdownNode = {
	type: string;
	value?: string;
	url?: string;
	target?: string;
	children?: MarkdownNode[];
};

const WIKI_LINK_RE = /(?<!\\)\[\[([^\]|\n]+?)(?:\|([^\]\n]+?))?\]\]/g;
const WIKI_PROTOCOL = 'wikilink:';
const TEXT_ONLY_PARENTS = new Set(['code', 'inlineCode', 'link', 'image', 'mdxJsxFlowElement']);

/**
 * Maps Obsidian-style wiki links to ordinary editor links and back. The
 * persisted source remains `[[target|label]]`; ProseMirror only sees a link.
 */
export function transformWikiLinks<T extends MarkdownNode>(tree: T): T {
	transformChildren(tree);
	return tree;
}

export function restoreWikiLinkSyntax(markdown: string) {
	return markdown.replace(
		/\[([^\]\n]+)]\(wikilink:([^)\s]+)\)/g,
		(source, label, encodedTarget) => {
			try {
				const target = decodeURIComponent(encodedTarget);
				return label.trim() === target ? `[[${target}]]` : `[[${target}|${label.trim()}]]`;
			} catch {
				return source;
			}
		}
	);
}

function transformChildren(parent: MarkdownNode) {
	if (!parent.children || TEXT_ONLY_PARENTS.has(parent.type)) return;

	parent.children = parent.children.flatMap((node) => {
		if (node.type === 'link' && node.url?.startsWith(WIKI_PROTOCOL)) {
			return [wikiLinkToText(node)];
		}
		if (node.type === 'text' && node.value?.includes('[[')) return splitWikiLinks(node.value);

		transformChildren(node);
		return [node];
	});
}

function splitWikiLinks(value: string): MarkdownNode[] {
	const nodes: MarkdownNode[] = [];
	let cursor = 0;

	for (const match of value.matchAll(WIKI_LINK_RE)) {
		const index = match.index ?? 0;
		if (index > cursor) nodes.push({ type: 'text', value: value.slice(cursor, index) });

		const target = (match[1] ?? '').trim();
		const label = (match[2] ?? target).trim();
		if (!target || !label) {
			nodes.push({ type: 'text', value: match[0] });
		} else {
			nodes.push({
				type: 'link',
				url: `${WIKI_PROTOCOL}${encodeURIComponent(target)}`,
				children: [{ type: 'text', value: label }]
			});
		}
		cursor = index + match[0].length;
	}

	if (cursor === 0) return [{ type: 'text', value }];
	if (cursor < value.length) nodes.push({ type: 'text', value: value.slice(cursor) });
	return nodes;
}

function wikiLinkToText(node: MarkdownNode): MarkdownNode {
	const encodedTarget = node.url?.slice(WIKI_PROTOCOL.length) ?? '';
	let target = encodedTarget;
	try {
		target = decodeURIComponent(encodedTarget);
	} catch {
		// Keep malformed values readable and editable.
	}
	const label = getText(node).trim();
	return {
		type: 'text',
		value: label && label !== target ? `[[${target}|${label}]]` : `[[${target}]]`
	};
}

function getText(node: MarkdownNode): string {
	if (node.value) return node.value;
	return (node.children ?? []).map(getText).join('');
}

function wikiLinkPlugin() {
	return (tree: Root) => transformWikiLinks(tree as MarkdownNode) as Root;
}

export const wikiLinkSyntax = $remark('wikiLinkSyntax', () => wikiLinkPlugin);

export const wikiLinkMark = $mark('wikiLink', () => ({
	attrs: { target: { default: '', validate: 'string' } },
	parseDOM: [
		{
			tag: '[data-wiki-link]',
			getAttrs: (dom) => ({
				target: dom instanceof HTMLElement ? (dom.dataset.wikiLink ?? '') : ''
			})
		}
	],
	toDOM: (mark) => [
		'a',
		{
			class: 'wiki-link',
			'data-wiki-link': String(mark.attrs.target),
			href: wikiLinkHref(String(mark.attrs.target))
		}
	],
	parseMarkdown: {
		match: (node) => node.type === 'link' && String(node.url).startsWith(WIKI_PROTOCOL),
		runner: (state, node, markType) => {
			const encodedTarget = String(node.url).slice(WIKI_PROTOCOL.length);
			let target = encodedTarget;
			try {
				target = decodeURIComponent(encodedTarget);
			} catch {
				// Preserve malformed targets verbatim.
			}
			state.openMark(markType, { target });
			state.next(node.children);
			state.closeMark(markType);
		}
	},
	toMarkdown: {
		match: (mark) => mark.type.name === 'wikiLink',
		runner: (state, mark) => {
			state.withMark(mark, 'link', undefined, {
				url: `${WIKI_PROTOCOL}${encodeURIComponent(String(mark.attrs.target))}`,
				title: null
			});
		}
	}
}));

export const wikiLinkFeature = [...wikiLinkSyntax, wikiLinkMark];

function wikiLinkHref(target: string) {
	const [page = '', heading = ''] = target.split('#', 2);
	const slug = page
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	const hash = heading ? `#${encodeURIComponent(heading.trim())}` : '';
	return slug ? `/crafts/${encodeURIComponent(slug)}${hash}` : hash || '#';
}
