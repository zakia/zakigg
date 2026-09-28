import { Decoration, EditorView } from '@codemirror/view';
import { parseMarkdownAst } from '$lib/editor/document/markdown-ast';
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

export const theme = EditorView.baseTheme({
	'.cm-live-media': {
		background: 'var(--base-2)',
		borderRadius: 'var(--radius)',
		display: 'inline-block',
		maxWidth: '100%',
		position: 'relative',
		verticalAlign: 'middle'
	},
	'.cm-live-media-preview': { display: 'block', width: 'fit-content' },
	'.cm-live-image:focus-within': { outline: '2px solid var(--content)', outlineOffset: '3px' },
	'.cm-live-media-edit': {
		background: 'var(--base-1)',
		border: '1px solid var(--edge)',
		borderRadius: 'var(--s-3)',
		color: 'var(--content)',
		cursor: 'pointer',
		font: 'inherit',
		fontSize: 'var(--s-2)',
		opacity: '0',
		padding: 'var(--s-4) var(--s-3)',
		position: 'absolute',
		right: 'var(--s-3)',
		top: 'var(--s-3)'
	},
	'.cm-live-image .cm-live-media-edit': {
		background: 'var(--content)',
		border: '0',
		color: 'var(--base-1)',
		fontFamily: 'var(--font-mono)',
		fontWeight: '700',
		padding: 'var(--s-3) var(--s-2)',
		pointerEvents: 'none'
	},
	'.cm-live-media:not(.cm-live-image):hover .cm-live-media-edit,\n\t.cm-live-media:focus-within .cm-live-media-edit':
		{ opacity: '1', pointerEvents: 'auto' },
	'.cm-live-media img,\n\t.cm-live-media video,\n\t.cm-live-media audio': {
		display: 'block',
		maxHeight: '70vh',
		maxWidth: '100%',
		objectFit: 'contain'
	},
	'.cm-live-media-error': {
		background: 'color-mix(in oklch, var(--error) 8%, var(--base-2))',
		border: '1px dashed var(--edge)',
		minHeight: '6rem',
		padding: 'var(--s1)'
	}
});

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
