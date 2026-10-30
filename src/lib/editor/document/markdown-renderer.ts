import type { Root } from 'mdast';
import { toHast } from 'mdast-util-to-hast';
import { toHtml } from 'hast-util-to-html';
import type { ComponentEmbedAttrs } from '#lib/editor/components/registry.js';
import { mediaKindForUrl } from '#lib/editor/features/media/source.js';
import { parseMarkdownAst } from '#lib/editor/document/markdown-ast.js';
import { parseMarkdownFrontmatter } from '#lib/editor/document/markdown.js';
import { readFrontmatter } from './frontmatter';
import type { EmbedValidator } from './validation';

import { readComponent, serializeNodes, type AstNode } from './embeds';
export type RenderBlock =
	| { kind: 'source'; markdown: string; error: string }
	| { kind: 'html'; html: string }
	| { kind: 'code'; code: string; language: string; title: string }
	| { kind: 'component'; attrs: ComponentEmbedAttrs };

export type RenderOptions = {
	resolveWikiLink?: (target: string) => string;
	embeds?: EmbedValidator;
};
export function renderMarkdown(source: string, options: RenderOptions = {}): RenderBlock[] {
	try {
		const frontmatter = readFrontmatter(source);
		if (frontmatter.error) throw new Error(frontmatter.error);
		return renderBlocks(source, options);
	} catch (cause) {
		return [
			{
				kind: 'source',
				markdown: source,
				error: cause instanceof Error ? cause.message : 'Preview unavailable.'
			}
		];
	}
}
function renderBlocks(source: string, options: RenderOptions): RenderBlock[] {
	const root = parseMarkdownAst(parseMarkdownFrontmatter(source).markdown) as AstNode;
	transformWikiLinks(root, options.resolveWikiLink);
	const blocks: RenderBlock[] = [];
	let standardNodes: AstNode[] = [];

	const flushStandardNodes = () => {
		if (!standardNodes.length) return;
		const hast = toHast({ type: 'root', children: standardNodes } as Root, {
			allowDangerousHtml: false,
			handlers: {
				heading(state, node) {
					const result = state.all(node);
					const text = getHeadingText(node);
					return {
						type: 'element',
						tagName: `h${node.depth}`,
						properties: { id: headingId(text) },
						children: result
					};
				},
				// Render media by its type so `![alt](url)` becomes an `<img>`, `<video>`,
				// `<audio>` or a download link based on the URL's file extension.
				image(state, node) {
					const url = node.url ?? '';
					const kind = mediaKindForUrl(url);
					if (kind === 'video') {
						return {
							type: 'element',
							tagName: 'video',
							properties: { src: url, controls: true },
							children: []
						};
					}
					if (kind === 'audio') {
						return {
							type: 'element',
							tagName: 'audio',
							properties: { src: url, controls: true },
							children: []
						};
					}
					if (kind === 'attachment') {
						return {
							type: 'element',
							tagName: 'a',
							properties: { href: url, download: '' },
							children: [{ type: 'text', value: node.alt || 'Download' }]
						};
					}
					return {
						type: 'element',
						tagName: 'img',
						properties: {
							src: url,
							alt: node.alt ?? '',
							title: node.title ?? undefined
						},
						children: []
					};
				},
				// Preserve the previous `markdown-it` `html: false` behaviour: escape raw
				// HTML rather than dropping or passing it through.
				html(_state, node) {
					return { type: 'text', value: (node as { value?: string }).value ?? '' };
				},
				// Unrecognized JSX (lowercase tags that aren't registered components) is
				// serialized back to its source text and escaped, matching the previous
				// `markdown-it` `html: false` behaviour.
				mdxJsxFlowElement(_state, node) {
					return { type: 'text', value: serializeNodes([node as AstNode]) };
				},
				mdxJsxTextElement(_state, node) {
					return { type: 'text', value: serializeNodes([node as AstNode]) };
				}
			}
		});
		blocks.push({ kind: 'html', html: toHtml(hast) });
		standardNodes = [];
	};

	for (const node of root.children ?? []) {
		const component = readComponent(node);
		if (component) {
			const validation = options.embeds?.parseProps(component.component, component.props);
			if (validation && !validation.ok) throw new Error(validation.message || 'Invalid embed.');
			flushStandardNodes();
			blocks.push({ kind: 'component', attrs: component });
			continue;
		}

		if (node.type === 'code') {
			flushStandardNodes();
			blocks.push({
				kind: 'code',
				code: node.value ?? '',
				language: node.lang ?? '',
				title: node.meta ?? ''
			});
			continue;
		}

		standardNodes.push(node);
	}

	flushStandardNodes();
	return blocks;
}

function transformWikiLinks(parent: AstNode, resolve = wikiLinkHref) {
	if (
		!parent.children ||
		['code', 'inlineCode', 'link', 'image', 'mdxJsxFlowElement'].includes(parent.type)
	) {
		return;
	}

	parent.children = parent.children.flatMap((node) => {
		if (node.type !== 'text' || !node.value?.includes('[[')) {
			transformWikiLinks(node, resolve);
			return [node];
		}

		const nodes: AstNode[] = [];
		let cursor = 0;
		for (const match of node.value.matchAll(/(?<!\\)\[\[([^\]|\n]+?)(?:\|([^\]\n]+?))?]]/g)) {
			const index = match.index ?? 0;
			if (index > cursor) nodes.push({ type: 'text', value: node.value.slice(cursor, index) });
			const target = (match[1] ?? '').trim();
			const label = (match[2] ?? target).trim();
			if (target && label) {
				nodes.push({
					type: 'link',
					url: resolve(target),
					children: [{ type: 'text', value: label }]
				});
			} else nodes.push({ type: 'text', value: match[0] });
			cursor = index + match[0].length;
		}
		if (!cursor) return [node];
		if (cursor < node.value.length) nodes.push({ type: 'text', value: node.value.slice(cursor) });
		return nodes;
	});
}

export function headingId(heading: string) {
	return heading
		.trim()
		.toLowerCase()
		.replace(/[^\p{L}\p{N} _-]/gu, '')
		.replace(/\s+/g, '-');
}
export function wikiLinkHref(target: string, resolvePage = (page: string) => encodeURI(page)) {
	const [page = '', heading = ''] = target.split('#', 2);
	const hash = heading ? `#${encodeURIComponent(headingId(heading))}` : '';
	return (page ? resolvePage(page) : '') + hash || '#';
}

function getHeadingText(node: { value?: string; children?: unknown[] }): string {
	return (
		node.value ??
		(node.children ?? [])
			.map((child) => getHeadingText(child as { value?: string; children?: unknown[] }))
			.join('')
	);
}
