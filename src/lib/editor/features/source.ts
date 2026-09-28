import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import { Decoration, type EditorView } from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';
import type { Decorations, Source } from './feature';

// These constructs own their contents. Do not decorate text inside a replacement
// or treat the language within a code fence as more Markdown.
const opaque = new Set(['Image', 'Table', 'HorizontalRule', 'FencedCode', 'Link', 'HTMLTag']);
export function nodes(state: EditorState, names: readonly string[]): SyntaxNode[] {
	const found: SyntaxNode[] = [];
	syntaxTree(state).iterate({
		enter(ref) {
			if (names.includes(ref.name)) found.push(ref.node);
			if (opaque.has(ref.name)) return false;
		}
	});
	return found;
}

export function children(node: SyntaxNode) {
	const result: SyntaxNode[] = [];
	for (let child = node.firstChild; child; child = child.nextSibling) result.push(child);
	return result;
}

export function hide(from: number, to: number): Decorations {
	return from < to ? [Decoration.replace({}).range(from, to)] : [];
}

export function mark(
	from: number,
	to: number,
	className: string,
	href?: string | null
): Decorations {
	return from < to
		? [
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
				}).range(from, to)
			]
		: [];
}

export function lines(state: EditorState, source: Source, className: string): Decorations {
	const result: Decorations = [];
	let line = state.doc.lineAt(source.from);
	for (;;) {
		result.push(Decoration.line({ class: className }).range(line.from));
		if (line.to >= source.to || line.number === state.doc.lines) break;
		line = state.doc.line(line.number + 1);
	}
	return result;
}

export function focusSource(view: EditorView, position: number) {
	view.dispatch({ selection: { anchor: position }, scrollIntoView: true });
	view.focus();
}

export function revealSource(event: MouseEvent, view: EditorView, position: number) {
	if (event.button !== 0 || event.metaKey || event.ctrlKey) return;
	event.preventDefault();
	event.stopPropagation();
	focusSource(view, position);
}
