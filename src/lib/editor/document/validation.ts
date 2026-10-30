import { readFrontmatter } from './frontmatter';
import { parseMarkdownAst } from './markdown-ast';
import { readComponent, type AstNode } from './embeds';

/** Only the pure validation role of the host's embed catalog crosses this seam. */
export type EmbedValidator = {
	parseProps(name: string, props: unknown): { ok: boolean; message?: string };
};
export type Diagnostic = { message: string; from: number; to: number };

export function validateMarkdown(source: string, embeds?: EmbedValidator): Diagnostic[] {
	const frontmatter = readFrontmatter(source);
	if (frontmatter.error)
		return [
			{
				message: frontmatter.error,
				from: frontmatter.range?.yamlFrom ?? 0,
				to: frontmatter.range?.yamlTo ?? source.length
			}
		];
	const offset = frontmatter.range?.bodyFrom ?? 0;
	const diagnostics: Diagnostic[] = [];
	function visit(node: AstNode, parent = '') {
		try {
			if (node.type === 'html')
				throw new Error('Raw HTML is not supported. Use an allowed component instead.');
			if (node.name === 'Column' && parent === 'Columns') {
				// Column contents are interpreted normally, but the parent owns Column placement.
			} else {
				const attrs = readComponent(node);
				if (attrs && embeds) {
					const result = embeds.parseProps(attrs.component, attrs.props);
					if (!result.ok) throw new Error(result.message || 'Invalid embed properties.');
				}
			}
		} catch (cause) {
			diagnostics.push({
				message: cause instanceof Error ? cause.message : 'Invalid Markdown.',
				from: offset + (node.position?.start.offset ?? 0),
				to: offset + (node.position?.end.offset ?? 0)
			});
		}
		for (const child of node.children ?? []) visit(child, node.name ?? '');
	}
	try {
		visit(parseMarkdownAst(source.slice(offset)) as AstNode);
	} catch (cause) {
		diagnostics.push({
			message: cause instanceof Error ? cause.message : 'Invalid Markdown.',
			from: offset,
			to: source.length
		});
	}
	return diagnostics;
}
