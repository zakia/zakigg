import { syntaxTree } from '@codemirror/language';
import { StateField, type EditorState } from '@codemirror/state';
import {
	Decoration,
	EditorView,
	ViewPlugin,
	WidgetType,
	type DecorationSet,
	type ViewUpdate
} from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';
import { renderCraftMarkdown } from '$lib/editor/document/markdown-renderer';
import { parseMarkdownAst } from '$lib/editor/document/markdown-ast';
import { resolveNoteAssetObjectUrl } from '$lib/editor/document/persistence/storage';
import { assetIdFromMediaUrl, mediaKindForUrl } from './media-types';
import { linkHrefFromMarkdown } from './link-target';

// Markdown stays in CodeMirror. Small syntax marks are decorated inline; media,
// tables, and rules use a state field because their replacements change layout.
// Moving the caret into a construct removes its replacement so the source can
// be edited without a second document model.
type Item = { from: number; to: number; decoration: Decoration };
const headings = [
	'',
	'cm-live-h1',
	'cm-live-h2',
	'cm-live-h3',
	'cm-live-h4',
	'cm-live-h5',
	'cm-live-h6'
];

function add(out: Item[], from: number, to: number, decoration: Decoration) {
	if (from <= to) out.push({ from, to, decoration });
}
function hide(out: Item[], from: number, to: number) {
	if (from < to) add(out, from, to, Decoration.replace({}));
}
function mark(out: Item[], from: number, to: number, className: string, href?: string | null) {
	if (from < to)
		add(
			out,
			from,
			to,
			Decoration.mark({
				class: className,
				...(href
					? {
							attributes: {
								'data-cm-link-href': href,
								title: 'Cmd/Ctrl-click to open link'
							}
						}
					: {})
			})
		);
}
function finish(out: Item[]): DecorationSet {
	return Decoration.set(
		out.map(({ from, to, decoration }) => decoration.range(from, to)),
		true
	);
}
function active(state: EditorState, from: number, to: number) {
	return state.selection.ranges.some((range) => range.from < to && range.to > from);
}
function activeLine(state: EditorState, from: number) {
	const line = state.doc.lineAt(from);
	return state.selection.ranges.some((range) =>
		range.empty
			? range.head >= line.from && range.head <= line.to
			: range.from < line.to && range.to > line.from
	);
}
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
function children(node: SyntaxNode) {
	const result: SyntaxNode[] = [];
	for (let child = node.firstChild; child; child = child.nextSibling) result.push(child);
	return result;
}
function lines(out: Item[], state: EditorState, from: number, to: number, className: string) {
	let line = state.doc.lineAt(from);
	for (;;) {
		add(out, line.from, line.from, Decoration.line({ class: className }));
		if (line.to >= to || line.number === state.doc.lines) break;
		line = state.doc.line(line.number + 1);
	}
}

class LabelWidget extends WidgetType {
	constructor(
		readonly label: string,
		readonly className: string,
		readonly sourcePosition?: number,
		readonly href?: string | null
	) {
		super();
	}
	eq(other: LabelWidget) {
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

function revealSource(event: MouseEvent, view: EditorView, position: number) {
	if (event.button !== 0 || event.metaKey || event.ctrlKey) return;
	event.preventDefault();
	event.stopPropagation();
	focusSource(view, position);
}
function focusSource(view: EditorView, position: number) {
	view.dispatch({ selection: { anchor: position }, scrollIntoView: true });
	view.focus();
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

class MediaWidget extends WidgetType {
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
	updateDOM(dom: HTMLElement, _view: EditorView, from: MediaWidget) {
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
class TableWidget extends WidgetType {
	constructor(
		readonly markdown: string,
		readonly from: number
	) {
		super();
	}
	eq(other: TableWidget) {
		return this.markdown === other.markdown && this.from === other.from;
	}
	toDOM(view: EditorView) {
		const wrapper = document.createElement('div');
		wrapper.className = 'cm-live-table';
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
class RuleWidget extends WidgetType {
	constructor(readonly from: number) {
		super();
	}
	eq(other: RuleWidget) {
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
function imageData(markdown: string) {
	try {
		const first = parseMarkdownAst(markdown).children[0];
		const image = first?.type === 'paragraph' ? first.children[0] : null;
		if (image?.type === 'image') return { src: image.url, alt: image.alt || '' };
	} catch {
		/* Malformed source remains visible. */
	}
	return null;
}
function buildBlocks(state: EditorState) {
	const out: Item[] = [];
	syntaxTree(state).iterate({
		enter(node) {
			if (node.name === 'Image') {
				const data = imageData(state.doc.sliceString(node.from, node.to));
				if (!data) return;
				const editing = activeLine(state, node.from);
				if (editing && mediaKindForUrl(data.src) === 'image') {
					const line = state.doc.lineAt(node.to);
					add(
						out,
						line.to,
						line.to,
						Decoration.widget({
							block: true,
							side: 1,
							widget: new MediaWidget(data.src, data.alt, node.to - node.from, true)
						})
					);
				} else if (!editing) {
					add(
						out,
						node.from,
						node.to,
						Decoration.replace({ widget: new MediaWidget(data.src, data.alt, node.to - node.from) })
					);
				}
			} else if (node.name === 'Table' && !active(state, node.from, node.to)) {
				add(
					out,
					node.from,
					node.to,
					Decoration.replace({
						block: true,
						widget: new TableWidget(state.doc.sliceString(node.from, node.to), node.from)
					})
				);
			} else if (node.name === 'HorizontalRule' && !active(state, node.from, node.to)) {
				add(
					out,
					node.from,
					node.to,
					Decoration.replace({ block: true, widget: new RuleWidget(node.from) })
				);
			}
		}
	});
	return finish(out);
}
const blocks = StateField.define<DecorationSet>({
	create: buildBlocks,
	update(value, transaction) {
		return transaction.docChanged || transaction.selection !== transaction.startState.selection
			? buildBlocks(transaction.state)
			: value;
	},
	provide: (field) => EditorView.decorations.from(field)
});

function collect(node: SyntaxNode, view: EditorView, out: Item[]) {
	const state = view.state;
	const name = node.name;
	const selected = active(state, node.from, node.to);
	let listMarkerActive = false;
	if (name === 'Image' || name === 'Table' || name === 'HorizontalRule') return;
	if (/^ATXHeading[1-6]$/.test(name)) {
		lines(out, state, node.from, node.to, headings[Number(name.slice(-1))]);
		const marker = node.getChild('HeaderMark');
		if (marker && !selected) hide(out, marker.from, marker.to);
	} else if (/^SetextHeading[12]$/.test(name)) {
		lines(out, state, node.from, state.doc.lineAt(node.from).to, headings[Number(name.slice(-1))]);
		const marker = node.getChild('HeaderMark');
		if (marker && !selected) hide(out, marker.from, marker.to);
	} else if (
		name === 'StrongEmphasis' ||
		name === 'Emphasis' ||
		name === 'InlineCode' ||
		name === 'Strikethrough'
	) {
		const first = node.firstChild;
		const last = node.lastChild;
		const className =
			name === 'StrongEmphasis'
				? 'cm-live-strong'
				: name === 'Emphasis'
					? 'cm-live-em'
					: name === 'Strikethrough'
						? 'cm-live-strike'
						: 'cm-live-inline-code';
		if (first && last) {
			mark(out, first.to, last.from, className);
			if (!selected) {
				hide(out, first.from, first.to);
				hide(out, last.from, last.to);
			}
		}
	} else if (name === 'Link') {
		const full = state.doc.sliceString(
			Math.max(0, node.from - 1),
			Math.min(state.doc.length, node.to + 1)
		);
		const wiki = /^\[\[([^\]\n]+)\]\]$/.exec(full);
		if (wiki) {
			if (!active(state, node.from - 1, node.to + 1)) {
				const label = wiki[1].split('|', 2)[1] || wiki[1].split('|', 2)[0];
				add(
					out,
					node.from - 1,
					node.to + 1,
					Decoration.replace({
						widget: new LabelWidget(label, 'cm-live-link', node.from, linkHrefFromMarkdown(full))
					})
				);
			}
			return;
		}
		const callout = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]$/i.exec(
			state.doc.sliceString(node.from, node.to)
		);
		if (callout && node.parent?.parent?.name === 'Blockquote') {
			if (!selected)
				add(
					out,
					node.from,
					node.to,
					Decoration.replace({
						widget: new LabelWidget(callout[1], 'cm-live-callout-label', node.from + 1)
					})
				);
			return;
		}
		const marks = children(node).filter((child) => child.name === 'LinkMark');
		if (marks.length >= 4) {
			mark(
				out,
				marks[0].to,
				marks[1].from,
				'cm-live-link',
				linkHrefFromMarkdown(state.doc.sliceString(node.from, node.to))
			);
			if (!selected) {
				hide(out, node.from, marks[0].to);
				hide(out, marks[1].from, node.to);
			}
		}
		return;
	} else if (name === 'ListItem') {
		const marker = node.getChild('ListMark');
		const task = node.getChild('Task')?.getChild('TaskMarker');
		listMarkerActive = marker ? activeAtListMarker(state, marker, task) : false;
		if (marker && !listMarkerActive) {
			if (task) {
				const checked = /\[[xX]\]/.test(state.doc.sliceString(task.from, task.to));
				add(
					out,
					marker.from,
					task.to,
					Decoration.replace({ widget: new TaskWidget(checked, marker.from, task.to) })
				);
			} else {
				const label =
					node.parent?.name === 'OrderedList' ? state.doc.sliceString(marker.from, marker.to) : '•';
				add(
					out,
					marker.from,
					marker.to,
					Decoration.replace({
						widget: new LabelWidget(label, 'cm-live-list-marker', marker.from + 1)
					})
				);
			}
		}
	} else if (name === 'Blockquote') {
		lines(out, state, node.from, node.to, 'cm-live-quote-line');
	} else if (name === 'QuoteMark') {
		const line = state.doc.lineAt(node.from);
		if (!active(state, line.from, line.to)) hide(out, node.from, node.to);
		return;
	} else if (name === 'FencedCode') {
		return;
	} else if (name === 'HTMLTag') {
		const tag = state.doc.sliceString(node.from, node.to);
		const component = /^<\s*([A-Z][A-Za-z0-9]*)\b/.exec(tag)?.[1];
		if (component && !selected)
			add(
				out,
				node.from,
				node.to,
				Decoration.replace({
					widget: new LabelWidget(component, 'cm-live-component', node.from + 1)
				})
			);
		return;
	}
	for (const child of children(node)) {
		if (
			name === 'ListItem' &&
			(child.name === 'ListMark' || (child.name === 'Task' && !listMarkerActive))
		)
			continue;
		if (
			(/^ATXHeading[1-6]$/.test(name) || /^SetextHeading[12]$/.test(name)) &&
			child.name === 'HeaderMark'
		)
			continue;
		if (
			(name === 'StrongEmphasis' ||
				name === 'Emphasis' ||
				name === 'InlineCode' ||
				name === 'Strikethrough') &&
			(child === node.firstChild || child === node.lastChild)
		)
			continue;
		collect(child, view, out);
	}
}
function buildInline(view: EditorView) {
	const out: Item[] = [];
	collect(syntaxTree(view.state).topNode, view, out);
	return finish(out);
}
const inline = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;
		constructor(view: EditorView) {
			this.decorations = buildInline(view);
		}
		update(update: ViewUpdate) {
			if (update.docChanged || update.selectionSet || update.viewportChanged)
				this.decorations = buildInline(update.view);
		}
	},
	{ decorations: (plugin) => plugin.decorations }
);

export const livePreview = [blocks, inline];
