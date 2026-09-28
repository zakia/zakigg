import { Decoration, WidgetType, EditorView } from '@codemirror/view';
import { feature } from '../feature';
import { nodes, focusSource, revealSource } from '../source';

export const preview = feature({
	find: (state) => nodes(state, ['HorizontalRule']),
	render: (_state, source) => [
		Decoration.replace({ block: true, widget: new Widget(source.from) }).range(
			source.from,
			source.to
		)
	]
});

export const theme = EditorView.baseTheme({
	'.cm-live-rule': {
		border: '0',
		borderTop: '1px solid var(--edge)',
		paddingBlock: 'var(--s1)',
		width: '100%'
	}
});

class Widget extends WidgetType {
	constructor(readonly from: number) {
		super();
	}
	eq(other: Widget) {
		return this.from === other.from;
	}
	toDOM(view: EditorView) {
		const rule = document.createElement('button');
		rule.type = 'button';
		rule.className = 'cm-live-rule';
		rule.title = 'Click to edit Markdown';
		rule.setAttribute('aria-label', 'Edit horizontal rule Markdown');
		rule.addEventListener('mousedown', (event) => revealSource(event, view, this.from + 1));
		rule.addEventListener('click', () => focusSource(view, this.from + 1));
		return rule;
	}
}
