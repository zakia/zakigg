import { toHast } from 'mdast-util-to-hast';
import { toHtml } from 'hast-util-to-html';
import { parseMarkdownAst } from '$lib/editor/document/markdown-ast';

/**
 * Renders a short Markdown string (typically a single paragraph) to inline HTML
 * without a wrapping `<p>` element. Used for compact rich-text fields such as
 * resume bullet points.
 */
export function renderMarkdownInlineToHtml(markdown: string): string {
	const root = parseMarkdownAst(markdown);
	const paragraph = root.children.find((child) => child.type === 'paragraph');
	if (!paragraph || !('children' in paragraph) || !paragraph.children) return '';

	const hast = toHast(
		{ type: 'paragraph', children: paragraph.children },
		{ allowDangerousHtml: false }
	);
	if (!hast || hast.type !== 'element') return '';

	return toHtml({ type: 'root', children: hast.children ?? [] });
}
