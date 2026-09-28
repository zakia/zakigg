import { EditorView } from '@codemirror/view';
import { feature, inside } from '../feature';
import { nodes, lines, hide } from '../source';

export const preview = feature({
	find: (state) => nodes(state, ['Blockquote', 'QuoteMark']),
	active: (state, node) => node.name === 'QuoteMark' && inside(state, state.doc.lineAt(node.from)),
	render: (state, node) =>
		node.name === 'Blockquote' ? lines(state, node, 'cm-live-quote-line') : hide(node.from, node.to)
});

export const theme = EditorView.baseTheme({
	'.cm-live-quote-line': {
		borderLeft: '2px solid var(--edge)',
		color: 'var(--content-1)',
		paddingLeft: 'var(--s-2)'
	}
});
