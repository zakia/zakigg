import { Decoration, EditorView } from '@codemirror/view';
import { parseMarkdownAst } from '#lib/editor/document/markdown-ast.js';
import { feature, onLine } from '../feature';
import { nodes } from '../source';
import { Widget } from './Widget';
import { mediaKindForUrl } from './source';

export const preview = feature({
	find: (state) =>
		nodes(state, ['Image']).flatMap((node) => {
			const data = imageData(state.doc.sliceString(node.from, node.to));
			return data ? [{ from: node.from, to: node.to, ...data }] : [];
		}),
	active: onLine,
	render: (_state, source) => [
		Decoration.replace({
			widget: new Widget(source.src, source.alt, source.to - source.from)
		}).range(source.from, source.to)
	],
	edit: (state, source) =>
		mediaKindForUrl(source.src) === 'image'
			? [
					Decoration.widget({
						block: true,
						side: 1,
						widget: new Widget(source.src, source.alt, source.to - source.from, true)
					}).range(state.doc.lineAt(source.to).to)
				]
			: []
});

export const theme = [];

function imageData(markdown: string) {
	try {
		const first = parseMarkdownAst(markdown).children[0];
		const image = first?.type === 'paragraph' ? first.children[0] : null;
		if (image?.type === 'image') return { src: image.url, alt: image.alt || '' };
	} catch {
		/* Malformed source remains visible. */
	}
	return null;
}
