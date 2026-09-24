import type { Root } from 'mdast';
import { toHast } from 'mdast-util-to-hast';
import { toHtml } from 'hast-util-to-html';
import { gfmToMarkdown } from 'mdast-util-gfm';
import { mdxJsxToMarkdown } from 'mdast-util-mdx-jsx';
import { toMarkdown } from 'mdast-util-to-markdown';
import type { ComponentEmbedAttrs } from '$lib/editor/components/registry';
import { parseMarkdownAst } from '$lib/editor/document/markdown-ast';
import { parseMarkdownFrontmatter } from '$lib/editor/document/markdown';
import { normalizePageSlug } from '$lib/editor/document/model';

type AstAttribute =
	| { type: 'mdxJsxAttribute'; name: string; value?: string | null | { value?: string } }
	| { type: 'mdxJsxExpressionAttribute'; value?: string };

type AstNode = {
	type: string;
	value?: string;
	lang?: string | null;
	meta?: string | null;
	name?: string | null;
	url?: string;
	attributes?: AstAttribute[];
	children?: AstNode[];
};

export type CraftRenderBlock =
	| { kind: 'html'; html: string }
	| { kind: 'code'; code: string; language: string; title: string }
	| { kind: 'component'; attrs: ComponentEmbedAttrs };

const EVENT_PROP_RE = /^on[A-Z]/;

export function renderCraftMarkdown(source: string): CraftRenderBlock[] {
	const root = parseMarkdownAst(parseMarkdownFrontmatter(source).markdown) as AstNode;
	transformWikiLinks(root);
	const blocks: CraftRenderBlock[] = [];
	let standardNodes: AstNode[] = [];

	const flushStandardNodes = () => {
		if (!standardNodes.length) return;
		const hast = toHast({ type: 'root', children: standardNodes } as Root, {
			allowDangerousHtml: false,
			handlers: {
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

function readComponent(node: AstNode): ComponentEmbedAttrs | null {
	const callout = readCallout(node);
	if (callout) return callout;
	if (node.type !== 'mdxJsxFlowElement') return null;

	const name = node.name?.trim() ?? '';
	if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) return null;
	if (name === 'Column') throw new Error('<Column> can only be used directly inside <Columns>.');

	const props = readProps(name, node.attributes ?? []);
	if (name === 'Columns') {
		const columns = (node.children ?? []).map((child) => {
			if (
				!['mdxJsxFlowElement', 'mdxJsxTextElement'].includes(child.type) ||
				child.name !== 'Column'
			) {
				throw new Error('<Columns> may only contain <Column> children.');
			}
			const columnProps = readProps('Column', child.attributes ?? []);
			return {
				markdown: serializeNodes(child.children ?? []).trim(),
				...(typeof columnProps.width === 'number' || typeof columnProps.width === 'string'
					? { width: columnProps.width }
					: {})
			};
		});
		return { component: name, markdownName: name, props: { ...props, columns } };
	}

	const childrenMarkdown = serializeNodes(node.children ?? []).trim();
	return {
		component: name,
		markdownName: name,
		props,
		...(childrenMarkdown ? { childrenMarkdown } : {})
	};
}

function readCallout(node: AstNode): ComponentEmbedAttrs | null {
	if (node.type !== 'blockquote') return null;
	const children = node.children ?? [];
	const first = children[0];
	const firstText = first?.type === 'paragraph' ? first.children?.[0] : undefined;
	if (firstText?.type !== 'text') return null;

	const match = firstText.value?.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)]\s*/i);
	if (!match) return null;

	const nextChildren = structuredClone(children);
	const nextText = nextChildren[0]?.children?.[0];
	if (nextText) nextText.value = (nextText.value ?? '').slice(match[0].length);

	return {
		component: 'Callout',
		markdownName: 'Callout',
		props: {
			kind: match[1].toLowerCase(),
			markdown: serializeNodes(nextChildren).trim()
		}
	};
}

function readProps(name: string, attributes: AstAttribute[]) {
	const props: Record<string, unknown> = {};
	for (const attribute of attributes) {
		if (attribute.type !== 'mdxJsxAttribute') {
			throw new Error(`Spread attributes are not allowed on <${name}>.`);
		}
		if (EVENT_PROP_RE.test(attribute.name)) {
			throw new Error(`Event handler prop “${attribute.name}” is not allowed.`);
		}

		if (attribute.value == null) props[attribute.name] = true;
		else if (typeof attribute.value === 'string') props[attribute.name] = attribute.value;
		else {
			try {
				props[attribute.name] = JSON.parse(attribute.value.value ?? '');
			} catch {
				throw new Error(`Prop “${attribute.name}” on <${name}> must be a JSON literal.`);
			}
		}
	}
	return props;
}

function serializeNodes(nodes: AstNode[]) {
	if (!nodes.length) return '';
	return toMarkdown({ type: 'root', children: nodes } as Root, {
		extensions: [gfmToMarkdown(), mdxJsxToMarkdown({ quote: '"' })]
	});
}

function transformWikiLinks(parent: AstNode) {
	if (
		!parent.children ||
		['code', 'inlineCode', 'link', 'image', 'mdxJsxFlowElement'].includes(parent.type)
	) {
		return;
	}

	parent.children = parent.children.flatMap((node) => {
		if (node.type !== 'text' || !node.value?.includes('[[')) {
			transformWikiLinks(node);
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
					url: wikiLinkHref(target),
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

function wikiLinkHref(target: string) {
	const [page = '', heading = ''] = target.split('#', 2);
	const slug = normalizePageSlug(page);
	const hash = heading ? `#${encodeURIComponent(heading.trim())}` : '';
	return slug ? `/crafts/${encodeURIComponent(slug)}${hash}` : hash || '#';
}
