import { Decoration, EditorView } from '@codemirror/view';
import { feature } from '../feature';
import { nodes } from '../source';
import { Label } from '../Label';

export const preview = feature({
	find: (state) =>
		nodes(state, ['HTMLTag']).flatMap((node) => {
			const name = /^<\s*([A-Z][A-Za-z0-9]*)\b/.exec(
				state.doc.sliceString(node.from, node.to)
			)?.[1];
			return name ? [{ from: node.from, to: node.to, name }] : [];
		}),
	render: (_state, source) => [
		Decoration.replace({
			widget: new Label(source.name, 'cm-live-component', source.from + 1)
		}).range(source.from, source.to)
	]
});

export const theme = EditorView.baseTheme({
	'.cm-live-component': {
		alignItems: 'center',
		background: 'color-mix(in oklch, var(--brand) 10%, var(--base-2))',
		border: '1px solid color-mix(in oklch, var(--brand) 30%, var(--edge))',
		borderRadius: 'calc(var(--radius) * 0.6)',
		color: 'var(--brand)',
		display: 'inline-flex',
		fontFamily: 'var(--font-mono)',
		fontSize: 'var(--s-1)',
		fontWeight: '650',
		padding: '0.1em 0.5em'
	}
});
