import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';
import {
	EditorSelection,
	countColumn,
	type ChangeSpec,
	type EditorState,
	type SelectionRange,
	type StateCommand
} from '@codemirror/state';
import {
	leadingWhitespace,
	markerAt,
	ownerAt,
	previousSibling,
	parentItem,
	subtreeEnd,
	selectedItems,
	type Marker
} from './source';

function dispatchListEdit(
	target: Parameters<StateCommand>[0],
	changes: ChangeSpec,
	range: SelectionRange,
	normalizeAt: number,
	userEvent: string
) {
	const { state, dispatch } = target;
	const draft = state.update({ changes });
	const anchor = draft.changes.mapPos(range.anchor, 1);
	const head = draft.changes.mapPos(range.head, 1);
	const normalized = normalizeOrderedLists(draft.state, draft.changes.mapPos(normalizeAt, 1));
	if (!normalized) {
		dispatch(
			state.update({
				changes,
				selection: EditorSelection.range(anchor, head),
				scrollIntoView: true,
				userEvent
			})
		);
		return;
	}
	const finalAnchor = normalized.changes.mapPos(anchor, 1);
	const finalHead = normalized.changes.mapPos(head, 1);
	dispatch(
		state.update({
			changes: draft.changes.compose(normalized.changes),
			selection: EditorSelection.range(finalAnchor, finalHead),
			scrollIntoView: true,
			userEvent
		})
	);
}

function exitPrefix(state: EditorState, item: Marker) {
	const parent = parentItem(state, item);
	if (!parent) return '';
	const ordered = /^(\d+)([.)])$/.exec(parent.text);
	const marker = ordered ? `${Number(ordered[1]) + 1}${ordered[2]}` : parent.text;
	const task = /^\s*[-+*]\s+\[[ xX]\]/.test(state.doc.line(parent.line).text);
	return `${' '.repeat(parent.indent)}${marker} ${task ? '[ ] ' : ''}`;
}

function moveItem(target: Parameters<StateCommand>[0], direction: 1 | -1) {
	const { state } = target;
	if (state.readOnly || state.selection.ranges.length !== 1) return false;
	const range = state.selection.main;
	const items = selectedItems(state, range);
	const item = items[0];
	if (!item) return !range.empty && !!ownerAt(state, range.from);
	const sibling = direction === 1 ? previousSibling(state, item) : null;
	if (direction === 1 && !sibling) return true;
	const parent = direction === -1 ? parentItem(state, item) : null;
	if (direction === -1 && item.indent === 0) return true;
	const delta =
		direction === 1
			? Math.max(4, sibling!.contentIndent - item.indent)
			: item.indent - (parent?.indent ?? 0);
	const changes = [];
	for (const selected of items) {
		for (let number = selected.line; number <= subtreeEnd(state, selected); number++) {
			const line = state.doc.line(number);
			if (direction === 1) {
				const marker = number === selected.line ? selected : null;
				const ordered = marker && !marker.parsed && /^(\d+)([.)])$/.exec(marker.text);
				if (ordered) {
					const prefix = leadingWhitespace(line.text);
					changes.push({
						from: line.from,
						to: line.from + prefix.length + ordered[1].length,
						insert: `${' '.repeat(delta)}${prefix}1`
					});
				} else changes.push({ from: line.from, insert: ' '.repeat(delta) });
			} else {
				const prefix = leadingWhitespace(line.text);
				const indent = countColumn(prefix, state.tabSize);
				changes.push({
					from: line.from,
					to: line.from + prefix.length,
					insert: ' '.repeat(Math.max(0, indent - delta))
				});
			}
		}
	}
	dispatchListEdit(target, changes, range, state.doc.line(item.line).from, 'input.indent');
	return true;
}

export const indentListItem: StateCommand = (target) => moveItem(target, 1);
export const outdentListItem: StateCommand = (target) => moveItem(target, -1);

function moveAcrossListIndent(
	{ state, dispatch }: Parameters<StateCommand>[0],
	direction: 'left' | 'right'
) {
	if (state.selection.ranges.length !== 1 || !state.selection.main.empty) return false;
	const position = state.selection.main.head;
	const line = state.doc.lineAt(position);
	const indentEnd = line.from + leadingWhitespace(line.text).length;
	if (indentEnd === line.from || (!markerAt(state, line.number) && !ownerAt(state, position)))
		return false;
	if (direction === 'left' && (position <= line.from || position > indentEnd)) return false;
	if (direction === 'right' && (position < line.from || position >= indentEnd)) return false;
	const target = direction === 'left' ? line.from : indentEnd;
	dispatch(
		state.update({ selection: { anchor: target }, scrollIntoView: true, userEvent: 'select' })
	);
	return true;
}

export const moveLeftAcrossListIndent: StateCommand = (target) =>
	moveAcrossListIndent(target, 'left');
export const moveRightAcrossListIndent: StateCommand = (target) =>
	moveAcrossListIndent(target, 'right');

export const exitEmptyListItem: StateCommand = (target) => {
	const { state } = target;
	if (state.readOnly || state.selection.ranges.length !== 1 || !state.selection.main.empty)
		return false;
	const position = state.selection.main.head;
	const line = state.doc.lineAt(position);
	const item = markerAt(state, line.number);
	if (!item || line.text.slice(item.contentOffset).trim()) return false;
	const end = subtreeEnd(state, item);
	for (let number = item.line + 1; number <= end; number++)
		if (state.doc.line(number).text.trim()) return true;
	const insert = exitPrefix(state, item);
	dispatchListEdit(
		target,
		{ from: line.from, to: state.doc.line(end).to, insert },
		state.selection.main,
		line.from,
		'input'
	);
	return true;
};

export const insertListHardBreak: StateCommand = ({ state, dispatch }) => {
	if (state.readOnly || state.selection.ranges.length !== 1) return false;
	const range = state.selection.main;
	if (!range.empty && state.doc.lineAt(range.from).number !== state.doc.lineAt(range.to).number)
		return false;
	const item = ownerAt(state, range.head);
	if (!item) return false;
	const line = state.doc.lineAt(range.head);
	if (line.number === item.line && range.head < line.from + item.contentOffset) return false;
	const empty = !line.text.slice(line.number === item.line ? item.contentOffset : 0).trim();
	const indent = Math.max(
		item.contentIndent,
		countColumn(leadingWhitespace(line.text), state.tabSize)
	);
	let from = range.from;
	const earliest = line.number === item.line ? line.from + item.contentOffset : line.from;
	while (from > earliest && /[ \t]/.test(state.doc.sliceString(from - 1, from))) from--;
	const insert = `${empty ? '' : '  '}${state.lineBreak}${' '.repeat(indent)}`;
	dispatch(
		state.update({
			changes: { from, to: range.to, insert },
			selection: { anchor: from + insert.length },
			scrollIntoView: true,
			userEvent: 'input'
		})
	);
	return true;
};

export const insertListSiblingAfterContinuation: StateCommand = (target) => {
	const { state } = target;
	if (state.readOnly || state.selection.ranges.length !== 1) return false;
	const range = state.selection.main;
	if (!range.empty && state.doc.lineAt(range.from).number !== state.doc.lineAt(range.to).number)
		return false;
	const line = state.doc.lineAt(range.head);
	if (markerAt(state, line.number)) return false;
	const item = ownerAt(state, range.head);
	if (!item) return false;
	if (!line.text.trim() && !state.doc.line(item.line).text.slice(item.contentOffset).trim()) {
		const end = subtreeEnd(state, item);
		let meaningful = false;
		for (let number = item.line + 1; number <= end; number++)
			if (state.doc.line(number).text.trim()) meaningful = true;
		if (!meaningful) {
			const itemLine = state.doc.line(item.line);
			dispatchListEdit(
				target,
				{ from: itemLine.from, to: state.doc.line(end).to, insert: exitPrefix(state, item) },
				range,
				itemLine.from,
				'input'
			);
			return true;
		}
	}
	const ordered = /^(\d+)([.)])$/.exec(item.text);
	const marker = ordered ? `${Number(ordered[1]) + 1}${ordered[2]}` : item.text;
	const task = /^\s*[-+*]\s+\[[ xX]\]/.test(state.doc.line(item.line).text);
	const prefix = `${' '.repeat(item.indent)}${marker} ${task ? '[ ] ' : ''}`;
	let from = range.from;
	while (from > line.from && /[ \t]/.test(state.doc.sliceString(from - 1, from))) from--;
	const empty = !line.text.trim();
	const insert = empty ? prefix : `${state.lineBreak}${prefix}`;
	const to = empty ? Math.max(range.to, line.to) : range.to;
	const previous = empty && line.number > 1 ? state.doc.line(line.number - 1) : null;
	const trailingBreak = previous && /[ \t]{2,}$/.exec(previous.text);
	const changes = [
		...(trailingBreak && previous
			? [{ from: previous.to - trailingBreak[0].length, to: previous.to, insert: '' }]
			: []),
		{ from: empty ? line.from : from, to, insert }
	];
	dispatchListEdit(target, changes, range, empty ? line.from : from, 'input');
	return true;
};

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

function normalizeOrderedLists(state: EditorState, position: number) {
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
