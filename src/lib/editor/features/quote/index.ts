import type { EditorState } from '@codemirror/state';
import { feature, onLine } from '../feature';
import { nodes, lines, mark } from '../source';

type QuoteSource = { from: number; to: number; kind: 'block' | 'prefix' };

function findQuotes(state: EditorState): QuoteSource[] {
	const blocks: QuoteSource[] = [];
	const prefixes: QuoteSource[] = [];
	for (const node of nodes(state, ['Blockquote', 'QuoteMark'])) {
		if (node.name === 'Blockquote') {
			blocks.push({ from: node.from, to: node.to, kind: 'block' });
			continue;
		}
		const line = state.doc.lineAt(node.from);
		let to = node.to;
		while (to < line.to && /[ \t]/.test(state.doc.sliceString(to, to + 1))) to++;
		const previous = prefixes.at(-1);
		if (
			previous &&
			state.doc.lineAt(previous.from).from === line.from &&
			/^[ \t]*$/.test(state.doc.sliceString(previous.to, node.from))
		) {
			previous.to = to;
		} else prefixes.push({ from: node.from, to, kind: 'prefix' });
	}
	return [...blocks, ...prefixes];
}

export const preview = feature({
	find: findQuotes,
	active: (state, source) => source.kind === 'prefix' && onLine(state, source),
	render: (state, source) =>
		source.kind === 'block'
			? lines(state, source, 'blockquote')
			: mark(source.from, source.to, 'quote-marker is-hidden'),
	// Keep the prefix in flow in both states so pointer selection cannot move the text.
	edit: (_state, source) => mark(source.from, source.to, 'quote-marker')
});

export const theme = [];
