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
		]).map((node) => ({
			from: node.from,
			to: node.to,
			node,
			marker: node.getChild('HeaderMark')
		})),
	active: (state, source) => (source.marker ? activeAtHeadingMarker(state, source.marker) : false),
	render(state, source) {
		const { node, marker } = source;
		const hideTo = marker ? headingPrefixEnd(state, marker) : 0;
		return [...appearance(state, node), ...(marker ? hide(marker.from, hideTo) : [])];
	},
	edit: (state, source) => appearance(state, source.node)
});

export function headingPrefixEnd(state: EditorState, marker: SyntaxNode) {
	const line = state.doc.lineAt(marker.from);
	let prefixEnd = marker.to;
	while (prefixEnd < line.to && /[ \t]/.test(state.doc.sliceString(prefixEnd, prefixEnd + 1)))
		prefixEnd++;
	return prefixEnd;
}

export function activeAtHeadingMarker(state: EditorState, marker: SyntaxNode) {
	const line = state.doc.lineAt(marker.from);
	const prefixEnd = headingPrefixEnd(state, marker);
	return state.selection.ranges.some((range) => range.from <= prefixEnd && range.to >= line.from);
}

export const theme = [];

function appearance(state: EditorState, node: SyntaxNode) {
	return lines(
		state,
		{
			from: node.from,
			to: node.name.startsWith('Setext') ? state.doc.lineAt(node.from).to : node.to
		},
		`h${node.name.slice(-1)}`
	);
}
