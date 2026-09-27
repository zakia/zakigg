import { parseMarkdownAst } from '$lib/editor/document/markdown-ast';
import { wikiLinkHref } from '$lib/editor/document/markdown-renderer';

export function linkHrefFromMarkdown(markdown: string): string | null {
	const wiki = /^\[\[([^\]\n]+)\]\]$/.exec(markdown);
	if (wiki) return safeLinkHref(wikiLinkHref(wiki[1].split('|', 1)[0].trim()));

	try {
		const first = parseMarkdownAst(markdown).children[0];
		const link = first?.type === 'paragraph' ? first.children[0] : null;
		return link?.type === 'link' ? safeLinkHref(link.url) : null;
	} catch {
		return null;
	}
}

function safeLinkHref(raw: string): string | null {
	try {
		const url = new URL(raw, window.location.href);
		return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null;
	} catch {
		return null;
	}
}
