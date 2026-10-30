import { Decoration, WidgetType, EditorView } from '@codemirror/view';
import { renderCraftMarkdown } from '#lib/editor/document/markdown-renderer.js';
import { feature } from '../feature';
import { nodes, focusSource, revealSource } from '../source';

export const preview = feature({
	find: (state) => nodes(state, ['Table']),
	render: (state, source) => [
		Decoration.replace({
			block: true,
			widget: new Widget(state.doc.sliceString(source.from, source.to), source.from)
		}).range(source.from, source.to)
	]
});

export const theme = [];

class Widget extends WidgetType {
	constructor(
		readonly markdown: string,
		readonly from: number
	) {
		super();
	}
	eq(other: Widget) {
		return this.markdown === other.markdown && this.from === other.from;
	}
	toDOM(view: EditorView) {
		const wrapper = document.createElement('div');
		wrapper.className = 'table-container';
		wrapper.contentEditable = 'false';
		wrapper.title = 'Click to edit table Markdown';
		wrapper.setAttribute('role', 'button');
		wrapper.setAttribute('aria-label', 'Edit table Markdown');
		wrapper.tabIndex = 0;
		wrapper.addEventListener('mousedown', (event) => revealSource(event, view, this.from + 1));
		wrapper.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				focusSource(view, this.from + 1);
			}
		});
		const block = renderCraftMarkdown(this.markdown).find((item) => item.kind === 'html');
		if (block?.kind === 'html') wrapper.innerHTML = block.html;
		return wrapper;
	}
}
