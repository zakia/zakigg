import { countColumn, type EditorState, type SelectionRange } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';

export type Marker = {
	line: number;
	indent: number;
	contentIndent: number;
	contentOffset: number;
	text: string;
	parsed: boolean;
};

export function leadingWhitespace(text: string) {
	return /^[ \t]*/.exec(text)?.[0] ?? '';
}

export function markerAt(state: EditorState, lineNumber: number): Marker | null {
	const line = state.doc.line(lineNumber);
	const match = /^([ \t]*)([-+*]|\d+[.)])([ \t]+)(?:\[[ xX]\][ \t]+)?/.exec(line.text);
	if (!match) return null;
	const parsed = syntaxTree(state).resolveInner(line.from + match[1].length, 1).name === 'ListMark';
	if (!parsed) {
		if (!/^\d+[.)]$/.test(match[2]) || lineNumber === 1) return null;
		const preceding = markerAt(state, lineNumber - 1);
		if (!preceding || preceding.indent !== countColumn(match[1], state.tabSize)) return null;
	}
	const contentOffset = match[0].length;
	return {
		line: lineNumber,
		indent: countColumn(match[1], state.tabSize),
		contentIndent: countColumn(
			line.text,
			state.tabSize,
			match[1].length + match[2].length + match[3].length
		),
		contentOffset,
		text: match[2],
		parsed
	};
}

export function ownerAt(state: EditorState, position: number): Marker | null {
	const line = state.doc.lineAt(position);
	const direct = markerAt(state, line.number);
	if (direct) return direct;
	const indent = countColumn(leadingWhitespace(line.text), state.tabSize);
	if (!indent) return null;
	for (let number = line.number - 1; number >= 1; number--) {
		const previous = state.doc.line(number);
		if (!previous.text.trim()) continue;
		const marker = markerAt(state, number);
		if (marker) {
			if (indent >= marker.contentIndent) return marker;
			if (marker.indent < indent) return null;
		} else if (!leadingWhitespace(previous.text) && previous.text.trim()) return null;
	}
	return null;
}

function listItemNode(state: EditorState, item: Marker): SyntaxNode | null {
	const line = state.doc.line(item.line);
	const markerPosition = line.from + leadingWhitespace(line.text).length;
	for (
		let node: SyntaxNode | null = syntaxTree(state).resolveInner(markerPosition, 1);
		node;
		node = node.parent
	)
		if (node.name === 'ListItem') return node;
	return null;
}

export function previousSibling(state: EditorState, item: Marker): Marker | null {
	const node = listItemNode(state, item);
	for (let previous = node?.prevSibling; previous; previous = previous.prevSibling)
		if (previous.name === 'ListItem')
			return markerAt(state, state.doc.lineAt(previous.from).number);
	// Adjacent bullet and ordered runs are separate syntax nodes until one is indented.
	for (let number = item.line - 1; number >= 1; number--) {
		const line = state.doc.line(number);
		if (!line.text.trim()) return null;
		const marker = markerAt(state, number);
		if (marker?.indent === item.indent) return marker;
		if (marker && marker.indent < item.indent) return null;
		if (!marker && countColumn(leadingWhitespace(line.text), state.tabSize) <= item.indent)
			return null;
	}
	return null;
}

export function parentItem(state: EditorState, item: Marker): Marker | null {
	for (let node = listItemNode(state, item)?.parent; node; node = node.parent)
		if (node.name === 'ListItem') return markerAt(state, state.doc.lineAt(node.from).number);
	return null;
}

export function subtreeEnd(state: EditorState, item: Marker) {
	let last = item.line;
	for (let number = item.line + 1; number <= state.doc.lines; number++) {
		const line = state.doc.line(number);
		const marker = markerAt(state, number);
		if (marker && marker.indent <= item.indent) break;
		if (!line.text.trim()) {
			const indent = countColumn(leadingWhitespace(line.text), state.tabSize);
			if (indent >= item.contentIndent) {
				last = number;
				continue;
			}
			if (number === state.doc.lines) break;
			const next = state.doc.line(number + 1);
			const nextMarker = markerAt(state, number + 1);
			const nextIndent = countColumn(leadingWhitespace(next.text), state.tabSize);
			if (
				!next.text.trim() ||
				(nextMarker ? nextMarker.indent <= item.indent : nextIndent < item.contentIndent)
			)
				break;
		}
		if (!marker && line.text.trim()) {
			const indent = countColumn(leadingWhitespace(line.text), state.tabSize);
			if (indent < item.contentIndent) break;
		}
		last = number;
	}
	return last;
}

export function selectedItems(state: EditorState, range: SelectionRange): Marker[] {
	const first = ownerAt(state, range.from);
	if (!first) return [];
	if (range.empty) return [first];
	const lastLine = state.doc.lineAt(Math.max(range.from, range.to - 1)).number;
	const markers = [first];
	for (let number = first.line + 1; number <= lastLine; number++) {
		const marker = markerAt(state, number);
		if (marker) markers.push(marker);
	}
	const depth = Math.min(...markers.map((marker) => marker.indent));
	const roots = markers.filter((marker) => marker.indent === depth);
	if (
		markers.some(
			(marker) =>
				marker.indent > depth &&
				!roots.some((root) => root.line < marker.line && marker.line <= subtreeEnd(state, root))
		)
	)
		return [];
	return roots;
}
