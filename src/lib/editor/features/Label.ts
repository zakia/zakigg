import { WidgetType, type EditorView } from '@codemirror/view';
import { revealSource } from './source';

export class Label extends WidgetType {
	constructor(
		readonly label: string,
		readonly className: string,
		readonly sourcePosition?: number,
		readonly href?: string | null
	) {
		super();
	}
	eq(other: Label) {
		return (
			this.label === other.label &&
			this.className === other.className &&
			this.sourcePosition === other.sourcePosition &&
			this.href === other.href
		);
	}
	toDOM(view: EditorView) {
		const span = document.createElement('span');
		span.className = this.className;
		span.textContent = this.label;
		span.contentEditable = 'false';
		if (this.sourcePosition !== undefined) {
			span.title = this.href ? 'Click to edit · Cmd/Ctrl-click to open' : 'Click to edit Markdown';
			span.addEventListener('mousedown', (event) =>
				revealSource(event, view, this.sourcePosition!)
			);
		}
		if (this.href) span.dataset.cmLinkHref = this.href;
		return span;
	}
}
