import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';
import { leadingWhitespace, ownerAt } from './list-structure';

function orderedListAround(state: EditorState, position: number): SyntaxNode | null {
	const line = state.doc.lineAt(Math.min(position, state.doc.length));
	const item = ownerAt(state, line.from + Math.min(position - line.from, line.length));
	if (!item) return null;
	const markerLine = state.doc.line(item.line);
	const markerPosition = markerLine.from + leadingWhitespace(markerLine.text).length;
	let outer: SyntaxNode | null = null;
	for (
		let node: SyntaxNode | null = syntaxTree(state).resolveInner(markerPosition, 1);
		node;
		node = node.parent
	) {
		if (node.name === 'OrderedList') outer = node;
	}
	return outer;
}

export function normalizeOrderedLists(state: EditorState, position: number) {
	const outer = orderedListAround(state, position);
	if (!outer) return null;
	const changes: { from: number; to: number; insert: string }[] = [];
	function visit(node: SyntaxNode, nested: boolean) {
		if (node.name === 'OrderedList') {
			let next = nested ? 1 : null;
			for (let item = node.firstChild; item; item = item.nextSibling) {
				if (item.name !== 'ListItem') continue;
				const mark = item.getChild('ListMark');
				if (!mark) continue;
				const match = /^(\d+)([.)])$/.exec(state.doc.sliceString(mark.from, mark.to));
				if (!match) continue;
				if (next === null) next = Number(match[1]);
				if (Number(match[1]) !== next)
					changes.push({ from: mark.from, to: mark.to - 1, insert: String(next) });
				next++;
			}
		}
		for (let child = node.firstChild; child; child = child.nextSibling)
			visit(child, nested || node.name === 'OrderedList');
	}
	let nested = false;
	for (let ancestor = outer.parent; ancestor; ancestor = ancestor.parent)
		if (ancestor.name === 'ListItem') nested = true;
	visit(outer, nested);
	return changes.length ? state.update({ changes }) : null;
}
