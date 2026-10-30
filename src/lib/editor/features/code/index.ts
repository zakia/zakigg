import { feature, touches } from '../feature';
import { nodes } from '../source';
import {
	Decoration,
	EditorView,
	WidgetType,
	type Command,
	type KeyBinding
} from '@codemirror/view';
import { Header } from './Header';
import { read } from './source';

export const preview = feature({
	find: (state) =>
		nodes(state, ['FencedCode']).flatMap((node) => {
			const block = read(state, node.from);
			return block ? [block] : [];
		}),
	active: touches,
	render(state, block) {
		const opening = state.doc.line(block.firstLine);
		const closing = state.doc.line(block.lastLine);
		const ranges = [
			Decoration.replace({ block: true, widget: new Header(block) }).range(opening.from, opening.to)
		];
		for (let number = block.firstLine + 1; number < block.lastLine; number++) {
			ranges.push(
				Decoration.line({ class: 'code-content-line' }).range(state.doc.line(number).from)
			);
		}
		if (block.lastLine > block.firstLine && closing.from < state.doc.length) {
			ranges.push(
				Decoration.replace({ block: true, widget: new Footer() }).range(closing.from, closing.to)
			);
		}
		return ranges;
	},
	edit(state, block) {
		const ranges = [];
		for (let number = block.firstLine; number <= block.lastLine; number++) {
			const edge =
				number === block.firstLine
					? ' code-source-first'
					: number === block.lastLine
						? ' code-source-last'
						: '';
			ranges.push(
				Decoration.line({ class: `code-source-line${edge}` }).range(state.doc.line(number).from)
			);
		}
		return ranges;
	}
});

export const enterUp = enterCodeFence('up');

export const enterDown = enterCodeFence('down');

export const keys: KeyBinding[] = [
	{ key: 'ArrowUp', run: enterUp },
	{ key: 'ArrowDown', run: enterDown }
];

export const theme = [];

function enterCodeFence(direction: 'up' | 'down'): Command {
	return (view) => {
		const selection = view.state.selection.main;
		if (!selection.empty) return false;
		const current = view.state.doc.lineAt(selection.head);
		const nextNumber = current.number + (direction === 'down' ? 1 : -1);
		if (nextNumber < 1 || nextNumber > view.state.doc.lines) return false;
		if (
			view.state.doc.lineAt(view.moveVertically(selection, direction === 'down').head).number ===
			current.number
		)
			return false;
		const next = view.state.doc.line(nextNumber);
		const block = read(view.state, next.from);
		if (!block || (nextNumber !== block.firstLine && nextNumber !== block.lastLine)) return false;
		view.dispatch({ selection: { anchor: next.from }, scrollIntoView: true });
		return true;
	};
}

class Footer extends WidgetType {
	toDOM() {
		const footer = document.createElement('div');
		footer.className = 'code-footer';
		footer.setAttribute('aria-hidden', 'true');
		return footer;
	}
}
