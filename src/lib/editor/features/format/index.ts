import { EditorView } from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';
import { feature } from '../feature';
import { nodes, mark, hide } from '../source';

export const preview = feature({
	find: (state) => nodes(state, Object.keys(classes)),
	render(_state, node) {
		return node.firstChild && node.lastChild
			? [
					...appearance(node),
					...hide(node.firstChild.from, node.firstChild.to),
					...hide(node.lastChild.from, node.lastChild.to)
				]
			: [];
	},
	edit: (_state, node) => appearance(node)
});

export const theme = EditorView.baseTheme({
	'.cm-live-strong': { fontWeight: '750' },
	'.cm-live-em': { fontStyle: 'italic' },
	'.cm-live-strike': { textDecoration: 'line-through' },
	'.cm-live-inline-code': {
		background: 'color-mix(in oklch, var(--brand) 9%, var(--base-2))',
		borderRadius: 'calc(var(--radius) * 0.45)',
		color: 'var(--brand)',
		fontFamily: 'var(--font-mono)',
		fontSize: '0.88em',
		padding: '0.1em 0.3em'
	}
});

const classes: Record<string, string> = {
	StrongEmphasis: 'cm-live-strong',
	Emphasis: 'cm-live-em',
	InlineCode: 'cm-live-inline-code',
	Strikethrough: 'cm-live-strike'
};

function appearance(node: SyntaxNode) {
	return node.firstChild && node.lastChild
		? mark(node.firstChild.to, node.lastChild.from, classes[node.name])
		: [];
}
