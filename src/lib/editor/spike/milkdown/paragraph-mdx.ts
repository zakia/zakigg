import { paragraphSchema } from '@milkdown/kit/preset/commonmark';
import type { MarkdownAstNode } from './mdx';

function isEmptyParagraphMarker(node: MarkdownAstNode) {
	return (
		(node.type === 'mdxJsxFlowElement' && node.name === 'br') ||
		(node.type === 'html' && String(node.value ?? '').trim() === '<br />')
	);
}

export const paragraphMdxSchema = paragraphSchema.extendSchema((previous) => (ctx) => {
	const schema = previous(ctx);
	return {
		...schema,
		parseMarkdown: {
			match: (node) =>
				schema.parseMarkdown.match(node) || isEmptyParagraphMarker(node as MarkdownAstNode),
			runner: (state, node, type) => {
				if (isEmptyParagraphMarker(node as MarkdownAstNode)) {
					state.addNode(type);
					return;
				}
				schema.parseMarkdown.runner(state, node, type);
			}
		}
	};
});
