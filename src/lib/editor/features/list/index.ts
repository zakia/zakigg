import type { EditorState } from '@codemirror/state';
import { Decoration, EditorView, type KeyBinding, WidgetType } from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';
import { feature } from '../feature';
import { nodes } from '../source';
import {
	exitEmptyListItem,
	indentListItem,
	insertListHardBreak,
	insertListSiblingAfterContinuation,
	moveLeftAcrossListIndent,
	moveRightAcrossListIndent,
	outdentListItem
} from './commands';

export function listDepth(node: SyntaxNode): number {
	let depth = 0;
	for (let p: SyntaxNode | null = node.parent; p; p = p.parent) {
		if (p.name === 'BulletList' || p.name === 'OrderedList') depth++;
	}
	return Math.max(1, depth);
}

export function bulletForDepth(depth: number): string {
	if (depth === 2) return '◦';
	if (depth >= 3) return '▪';
	return '•';
}

export const preview = feature({
	find: (state) => {
		const sources = nodes(state, ['ListItem']).flatMap((node) => {
			const marker = node.getChild('ListMark');
			const task = node.getChild('Task')?.getChild('TaskMarker');
			if (!marker) return [];
			const line = state.doc.lineAt(marker.from);
			let prefixEnd = (task ?? marker).to;
			while (prefixEnd < line.to && /[ \t]/.test(state.doc.sliceString(prefixEnd, prefixEnd + 1)))
				prefixEnd++;
			// Include indentation in the marker slot, but leave enclosing syntax (quotes,
			// another list marker on the same line) to the feature that owns it.
			const indentation = state.doc.sliceString(line.from, marker.from);
			const from = /^[ \t]*$/.test(indentation) ? line.from : marker.from;
			return [{ from, to: prefixEnd, node, marker, task, prefixEnd }];
		});
		// Markdown can nest multiple markers on one line ("- - text"). The
		// deepest item owns one slot containing the entire source prefix.
		const byLine = new Map(
			sources.map((source) => [state.doc.lineAt(source.marker.from).from, source] as const)
		);
		for (const source of sources) {
			const prefix = byLine.get(state.doc.lineAt(source.marker.from).from)!;
			prefix.from = Math.min(prefix.from, source.from);
		}
		return [...byLine.values()];
	},
	active: (state, source) => activeAtListMarker(state, source.marker, source.task),
	render(state, source) {
		const { marker, task, node, prefixEnd } = source;
		const line = state.doc.lineAt(marker.from);
		const depth = listDepth(node);
		const isOrdered = node.parent?.name === 'OrderedList';

		const lineClass = isOrdered ? 'list-line is-ordered' : 'list-line';

		const widget = task
			? new TaskWidget(
					/\[[xX]\]/.test(state.doc.sliceString(task.from, task.to)),
					marker.from,
					task.to
				)
			: new Marker(
					isOrdered ? state.doc.sliceString(marker.from, marker.to) : bulletForDepth(depth)
				);

		return [
			Decoration.line({
				class: lineClass,
				attributes: { style: `--list-depth: ${depth}` }
			}).range(line.from),
			Decoration.replace({ widget }).range(source.from, prefixEnd)
		];
	},
	edit(state, source) {
		const { marker, node } = source;
		const line = state.doc.lineAt(marker.from);
		const depth = listDepth(node);
		const isOrdered = node.parent?.name === 'OrderedList';
		const lineClass = isOrdered ? 'list-line is-editing is-ordered' : 'list-line is-editing';

		return [
			Decoration.line({
				class: lineClass,
				attributes: { style: `--list-depth: ${depth}` }
			}).range(line.from),
			Decoration.mark({ class: 'list-marker' }).range(source.from, source.prefixEnd)
		];
	}
});

export const keys: KeyBinding[] = [
	{ key: 'Enter', run: exitEmptyListItem },
	{ key: 'Enter', run: insertListSiblingAfterContinuation },
	{ key: 'Shift-Enter', run: insertListHardBreak },
	{ key: 'Tab', run: indentListItem },
	{ key: 'Shift-Tab', run: outdentListItem }
];

export const navigation: KeyBinding[] = [
	{ key: 'ArrowLeft', run: moveLeftAcrossListIndent },
	{ key: 'ArrowRight', run: moveRightAcrossListIndent }
];

export const theme = [];

export function activeAtListMarker(
	state: EditorState,
	marker: SyntaxNode,
	task?: SyntaxNode | null
) {
	const line = state.doc.lineAt(marker.from);
	let prefixEnd = (task ?? marker).to;
	while (prefixEnd < line.to && /[ \t]/.test(state.doc.sliceString(prefixEnd, prefixEnd + 1)))
		prefixEnd++;
	return state.selection.ranges.some((range) => range.from <= prefixEnd && range.to >= line.from);
}

class Marker extends WidgetType {
	constructor(readonly text: string) {
		super();
	}
	eq(other: Marker) {
		return this.text === other.text;
	}
	toDOM() {
		const span = document.createElement('span');
		span.className = 'list-marker';
		span.textContent = this.text;
		span.contentEditable = 'false';
		span.title = 'Click to edit Markdown';
		return span;
	}
	ignoreEvent() {
		// List markers participate in CodeMirror's native click, drag and Shift-click selection.
		return false;
	}
}

class TaskWidget extends WidgetType {
	constructor(
		readonly checked: boolean,
		readonly from: number,
		readonly to: number
	) {
		super();
	}
	eq(other: TaskWidget) {
		return this.checked === other.checked && this.from === other.from && this.to === other.to;
	}
	toDOM(view: EditorView) {
		const span = document.createElement('span');
		span.className = 'list-marker';
		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.className = 'task-checkbox';
		checkbox.checked = this.checked;
		checkbox.contentEditable = 'false';
		checkbox.setAttribute(
			'aria-label',
			this.checked ? 'Mark task incomplete' : 'Mark task complete'
		);
		checkbox.addEventListener('change', () => {
			const current = view.state.doc.sliceString(this.from, this.to);
			const next = current.replace(/\[[ xX]\]/, checkbox.checked ? '[x]' : '[ ]');
			if (next !== current)
				view.dispatch({ changes: { from: this.from, to: this.to, insert: next } });
			view.focus();
		});
		span.appendChild(checkbox);
		return span;
	}
	ignoreEvent() {
		return true;
	}
}
