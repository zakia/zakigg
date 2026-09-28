import type { EditorState } from '@codemirror/state';
import { Decoration, EditorView, type KeyBinding, WidgetType } from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';
import { feature } from '../feature';
import { nodes } from '../source';
import { Label } from '../Label';
import {
	exitEmptyListItem,
	indentListItem,
	insertListHardBreak,
	insertListSiblingAfterContinuation,
	moveLeftAcrossListIndent,
	moveRightAcrossListIndent,
	outdentListItem
} from './commands';

export const preview = feature({
	find: (state) =>
		nodes(state, ['ListItem']).flatMap((node) => {
			const marker = node.getChild('ListMark');
			const task = node.getChild('Task')?.getChild('TaskMarker');
			return marker ? [{ from: marker.from, to: task?.to ?? marker.to, node, marker, task }] : [];
		}),
	active: (state, source) => activeAtListMarker(state, source.marker, source.task),
	render(state, source) {
		const { marker, task, node } = source;
		const widget = task
			? new TaskWidget(
					/\[[xX]\]/.test(state.doc.sliceString(task.from, task.to)),
					marker.from,
					task.to
				)
			: new Label(
					node.parent?.name === 'OrderedList' ? state.doc.sliceString(marker.from, marker.to) : '•',
					'cm-live-list-marker',
					marker.from + 1
				);
		return [Decoration.replace({ widget }).range(source.from, source.to)];
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

export const theme = EditorView.baseTheme({
	'.cm-live-list-marker': { color: 'var(--brand)', display: 'inline-block', minWidth: '1ch' },
	'.cm-live-task': { accentColor: 'var(--brand)', marginRight: '0.3em' }
});

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
		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.className = 'cm-live-task';
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
		return checkbox;
	}
	ignoreEvent() {
		return true;
	}
}
