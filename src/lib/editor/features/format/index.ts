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

export const theme = [];

const classes: Record<string, string> = {
	StrongEmphasis: 'strong',
	Emphasis: 'em',
	InlineCode: 'inline-code',
	Strikethrough: 'strike'
};

function appearance(node: SyntaxNode) {
	return node.firstChild && node.lastChild
		? mark(node.firstChild.to, node.lastChild.from, classes[node.name])
		: [];
}
