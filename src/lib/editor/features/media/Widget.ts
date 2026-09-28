import { WidgetType, type EditorView } from '@codemirror/view';
import { resolveNoteAssetObjectUrl } from '$lib/editor/document/persistence/storage';
import { assetIdFromMediaUrl, mediaKindForUrl } from './source';
import { focusSource } from '../source';

export class Widget extends WidgetType {
	private objectUrl = { value: '' };
	constructor(
		readonly src: string,
		readonly alt: string,
		readonly sourceLength: number,
		readonly preview = false
	) {
		super();
	}
	eq() {
		// updateDOM transfers ownership of the loaded URL when the widget is rebuilt.
		return false;
	}
	updateDOM(dom: HTMLElement, _view: EditorView, from: Widget) {
		if (
			this.src !== from.src ||
			this.preview !== from.preview ||
			(!this.preview && this.sourceLength !== from.sourceLength)
		)
			return false;
		const image = dom.querySelector('img');
		if (image) image.alt = this.alt;
		if (!this.preview && mediaKindForUrl(this.src) === 'image')
			dom.setAttribute('aria-label', this.alt ? `Image: ${this.alt}` : 'Image');
		this.objectUrl = from.objectUrl;
		return true;
	}
	toDOM(view: EditorView) {
		const wrapper: HTMLElement = document.createElement(this.preview ? 'div' : 'span');
		wrapper.className = this.preview ? 'cm-live-media cm-live-media-preview' : 'cm-live-media';
		wrapper.contentEditable = 'false';
		wrapper.draggable = false;
		wrapper.addEventListener('dragstart', (event) => event.preventDefault());
		const sourceRange = () => {
			const from = view.posAtDOM(wrapper);
			return { from, to: from + this.sourceLength };
		};
		const sourcePosition = () => sourceRange().from + 1;
		const kind = mediaKindForUrl(this.src);
		if (this.preview) {
			wrapper.addEventListener('mousedown', (event) => event.preventDefault());
		} else if (kind === 'image') {
			wrapper.classList.add('cm-live-image');
			wrapper.tabIndex = 0;
			wrapper.setAttribute('role', 'group');
			wrapper.setAttribute('aria-label', this.alt ? `Image: ${this.alt}` : 'Image');
			wrapper.addEventListener('mousedown', (event) => {
				if (event.button !== 0 || (event.target !== wrapper && event.target !== element)) return;
				event.preventDefault();
				event.stopPropagation();
				wrapper.focus();
			});
			wrapper.addEventListener('keydown', (event) => {
				if (event.target !== wrapper) return;
				const { from, to } = sourceRange();
				if (event.key === 'Escape') {
					event.preventDefault();
					view.focus();
					return;
				}
				if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
					event.preventDefault();
					focusSource(view, from);
					return;
				}
				if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
					event.preventDefault();
					focusSource(view, to);
					return;
				}
				if ((event.key !== 'Backspace' && event.key !== 'Delete') || view.state.readOnly) return;
				event.preventDefault();
				view.dispatch({ changes: { from, to }, selection: { anchor: from } });
				view.focus();
			});
		}
		const element =
			kind === 'video'
				? document.createElement('video')
				: kind === 'audio'
					? document.createElement('audio')
					: kind === 'attachment'
						? document.createElement('a')
						: document.createElement('img');
		if (element instanceof HTMLImageElement) {
			element.alt = this.alt;
			element.draggable = false;
		} else if (element instanceof HTMLMediaElement) {
			element.controls = true;
			element.draggable = false;
			if (element instanceof HTMLVideoElement) element.playsInline = true;
		} else {
			element.textContent = this.alt || 'Download';
			element.download = '';
		}
		element.addEventListener('error', () => wrapper.classList.add('cm-live-media-error'));
		element.addEventListener('load', () => view.requestMeasure());
		element.addEventListener('loadedmetadata', () => view.requestMeasure());
		wrapper.append(element);
		if (!this.preview) {
			const edit = document.createElement('button');
			edit.type = 'button';
			edit.className = 'cm-live-media-edit';
			edit.textContent = kind === 'image' ? '</>' : 'Edit';
			edit.setAttribute(
				'aria-label',
				kind === 'image' ? 'Show image Markdown' : 'Edit media Markdown'
			);
			edit.contentEditable = 'false';
			edit.addEventListener('mousedown', (event) => {
				event.preventDefault();
				event.stopPropagation();
			});
			edit.addEventListener('click', (event) => {
				event.stopPropagation();
				focusSource(view, sourcePosition());
			});
			wrapper.append(edit);
		}
		void this.resolve(element, wrapper, view);
		return wrapper;
	}
	private async resolve(
		element: HTMLImageElement | HTMLMediaElement | HTMLAnchorElement,
		wrapper: HTMLElement,
		view: EditorView
	) {
		let src = this.src;
		const id = assetIdFromMediaUrl(src);
		if (!id) {
			if (element instanceof HTMLAnchorElement) element.href = src;
			else element.src = src;
			return;
		}
		try {
			src = await resolveNoteAssetObjectUrl(id);
			if (src.startsWith('blob:')) this.objectUrl.value = src;
		} catch {
			src = this.src;
		}
		if (!wrapper.isConnected) {
			this.revoke();
			return;
		}
		if (element instanceof HTMLAnchorElement) element.href = src;
		else element.src = src;
		view.requestMeasure();
	}
	private revoke() {
		if (this.objectUrl.value) URL.revokeObjectURL(this.objectUrl.value);
		this.objectUrl.value = '';
	}
	destroy() {
		this.revoke();
	}
	ignoreEvent() {
		return true;
	}
}
