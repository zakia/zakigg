import { EditorView } from '@codemirror/view';
import type { EditorState } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';
import { feature } from '../feature';
import { nodes, lines, hide } from '../source';

export const preview = feature({
	find: (state) =>
		nodes(state, [
			'ATXHeading1',
			'ATXHeading2',
			'ATXHeading3',
			'ATXHeading4',
			'ATXHeading5',
			'ATXHeading6',
			'SetextHeading1',
			'SetextHeading2'
		]),
	render(state, node) {
		const marker = node.getChild('HeaderMark');
		return [...appearance(state, node), ...(marker ? hide(marker.from, marker.to) : [])];
	},
	edit: appearance
});

export const theme = EditorView.baseTheme({
	'.cm-live-h1, .cm-live-h2, .cm-live-h3, .cm-live-h4, .cm-live-h5, .cm-live-h6': {
		display: 'block',
		fontWeight: '750',
		letterSpacing: '-0.04em',
		lineHeight: '1.08'
	},
	'.cm-live-h1': { fontSize: 'var(--s4)' },
	'.cm-live-h2': { fontSize: 'var(--s2)' },
	'.cm-live-h3': { fontSize: 'var(--s1)' }
});

function appearance(state: EditorState, node: SyntaxNode) {
	return lines(
		state,
		{
			from: node.from,
			to: node.name.startsWith('Setext') ? state.doc.lineAt(node.from).to : node.to
		},
		`cm-live-h${node.name.slice(-1)}`
	);
}
