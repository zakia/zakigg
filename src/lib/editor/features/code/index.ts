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
				Decoration.line({ class: 'cm-code-content-line' }).range(state.doc.line(number).from)
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
					? ' cm-code-source-first'
					: number === block.lastLine
						? ' cm-code-source-last'
						: '';
			ranges.push(
				Decoration.line({ class: `cm-code-source-line${edge}` }).range(state.doc.line(number).from)
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

export const theme = EditorView.baseTheme({
	'.cm-code-header': {
		alignItems: 'flex-end',
		background: 'var(--base-2)',
		border: '1px solid var(--edge)',
		borderBottom: '0',
		borderRadius: 'var(--radius) var(--radius) 0 0',
		boxSizing: 'border-box',
		display: 'flex',
		height: '2.25rem',
		justifyContent: 'space-between',
		padding: '0 var(--s0)'
	},
	'.cm-code-header select, .cm-code-header button': {
		background: 'transparent',
		border: '0',
		color: 'var(--content-1)',
		cursor: 'pointer',
		font: 'inherit',
		fontSize: 'var(--s-1)',
		minHeight: '1.25rem'
	},
	'.cm-code-details': { minWidth: '0' },
	'.cm-code-controls': {
		alignItems: 'center',
		display: 'flex',
		gap: 'var(--s-2)',
		marginLeft: 'auto'
	},
	'.cm-code-meta': {
		color: 'var(--content-2)',
		fontSize: 'var(--s-1)',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap'
	},
	'.cm-code-header button:hover, .cm-code-header select:hover': { color: 'var(--content)' },
	'.cm-line.cm-code-content-line, .cm-line.cm-code-source-line': {
		background: 'var(--base-2)',
		borderLeft: '1px solid var(--edge)',
		borderRight: '1px solid var(--edge)',
		fontFamily: 'var(--font-mono)',
		fontSize: 'var(--s-1)',
		lineHeight: '1.5rem',
		paddingLeft: 'var(--s0)',
		paddingRight: 'var(--s0)'
	},
	'.cm-line.cm-code-source-first': {
		borderRadius: 'var(--radius) var(--radius) 0 0',
		boxShadow: 'inset 0 1px var(--edge)',
		boxSizing: 'border-box',
		height: '2.25rem',
		paddingTop: '0.75rem'
	},
	'.cm-line.cm-code-source-last': {
		borderRadius: '0 0 var(--radius) var(--radius)',
		boxShadow: 'inset 0 -1px var(--edge)'
	},
	'.cm-code-footer': {
		background: 'var(--base-2)',
		border: '1px solid var(--edge)',
		borderTop: '0',
		borderRadius: '0 0 var(--radius) var(--radius)',
		boxSizing: 'border-box',
		height: '1.5rem'
	}
});

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
		footer.className = 'cm-code-footer';
		footer.setAttribute('aria-hidden', 'true');
		return footer;
	}
}
