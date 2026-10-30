import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import type { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { feature } from '../feature';
import { focusSource } from '../source';
import { readEmbedSource } from '../../document/embeds';
import { editorOptions } from '../../configuration';
import type { ComponentEmbedAttrs } from '#lib/editor/components/registry.js';

export class ComponentEmbedWidget extends WidgetType {
	private cleanup: (() => void) | undefined;

	constructor(
		readonly raw: string,
		readonly attrs: ComponentEmbedAttrs,
		readonly from: number,
		readonly to: number
	) {
		super();
	}

	eq(other: ComponentEmbedWidget) {
		return this.raw === other.raw && this.from === other.from && this.to === other.to;
	}

	toDOM(view: EditorView) {
		const wrapper = document.createElement('div');
		wrapper.className = 'component-embed';
		wrapper.contentEditable = 'false';

		const editBtn = document.createElement('button');
		editBtn.type = 'button';
		editBtn.className = 'component-edit-btn';
		editBtn.textContent = '</>';
		editBtn.title = `Edit <${this.attrs.component}> Markdown`;
		editBtn.setAttribute('aria-label', `Edit <${this.attrs.component}> Markdown`);
		editBtn.addEventListener('mousedown', (event) => {
			event.preventDefault();
			event.stopPropagation();
		});
		editBtn.addEventListener('click', (event) => {
			event.stopPropagation();
			focusSource(view, this.from);
		});
		wrapper.appendChild(editBtn);

		const mountTarget = document.createElement('div');
		mountTarget.className = 'component-frame';
		wrapper.appendChild(mountTarget);

		try {
			this.cleanup = view.state.facet(editorOptions).renderEmbed?.(mountTarget, this.attrs);
		} catch (error) {
			const err = document.createElement('div');
			err.className = 'component-embed-error';
			err.textContent = error instanceof Error ? error.message : 'Error rendering component';
			mountTarget.appendChild(err);
		}

		return wrapper;
	}

	destroy() {
		this.cleanup?.();
		this.cleanup = undefined;
	}

	ignoreEvent() {
		return true;
	}
}

function findEmbeds(state: EditorState) {
	if (!state.facet(editorOptions).renderEmbed) return [];
	const text = state.doc.toString();
	const results: Array<{ from: number; to: number; raw: string; attrs: ComponentEmbedAttrs }> = [];

	syntaxTree(state).iterate({
		enter(ref) {
			if (ref.name === 'FencedCode') return false;
			if (ref.name === 'HTMLBlock' || ref.name === 'HTMLTag') {
				const raw = text.slice(ref.from, ref.to);
				const trimmed = raw.trimStart();
				if (/^<[A-Z][A-Za-z0-9]*/.test(trimmed)) {
					try {
						const attrs = readEmbedSource(raw);
						if (attrs) {
							results.push({
								from: ref.from,
								to: ref.to,
								raw,
								attrs
							});
						}
					} catch {
						/* ignore malformed tags */
					}
				}
				return false;
			}
		}
	});

	return results;
}

function activeAtEmbed(state: EditorState, source: { from: number; to: number }) {
	const startLine = state.doc.lineAt(source.from);
	const endLine = state.doc.lineAt(source.to);
	return state.selection.ranges.some(
		(range) => range.from <= endLine.to && range.to >= startLine.from
	);
}

export const preview = feature({
	find: findEmbeds,
	active: activeAtEmbed,
	render(state, source) {
		const lineStart = state.doc.lineAt(source.from);
		const lineEnd = state.doc.lineAt(source.to);
		const isBlock =
			state.doc.sliceString(lineStart.from, source.from).trim() === '' &&
			state.doc.sliceString(source.to, lineEnd.to).trim() === '';

		return [
			Decoration.replace({
				block: isBlock,
				widget: new ComponentEmbedWidget(source.raw, source.attrs, source.from, source.to)
			}).range(source.from, source.to)
		];
	}
});

export const theme = [];
