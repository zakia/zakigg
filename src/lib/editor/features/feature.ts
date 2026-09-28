import { syntaxTree } from '@codemirror/language';
import { StateField, type EditorState, type Range } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';

export type Source = { from: number; to: number };
export type Decorations = Range<Decoration>[];

/** Source positions belong to CodeMirror. A feature only decides how to display them. */
export type Feature<T extends Source> = {
	find(state: EditorState): T[];
	/** Defaults to a caret inside the range or a selection overlapping it. */
	active?(state: EditorState, source: NoInfer<T>): boolean;
	render(state: EditorState, source: T): Decorations;
	/** Omit to reveal unadorned source while active. */
	edit?(state: EditorState, source: T): Decorations;
};

export function inside(state: EditorState, source: Source) {
	return state.selection.ranges.some((range) => range.from < source.to && range.to > source.from);
}

/** Include both edges when a block's delimiters must remain editable. */
export function touches(state: EditorState, source: Source) {
	return state.selection.ranges.some((range) => range.from <= source.to && range.to >= source.from);
}

export function onLine(state: EditorState, source: Source) {
	const line = state.doc.lineAt(source.from);
	return state.selection.ranges.some((range) =>
		range.empty
			? range.head >= line.from && range.head <= line.to
			: range.from < line.to && range.to > line.from
	);
}

export function feature<T extends Source>(definition: Feature<T>): StateField<DecorationSet> {
	function build(state: EditorState) {
		const ranges = definition.find(state).flatMap((source) => {
			const active = (definition.active ?? inside)(state, source);
			return active ? (definition.edit?.(state, source) ?? []) : definition.render(state, source);
		});
		return Decoration.set(ranges, true);
	}
	return StateField.define<DecorationSet>({
		create: build,
		update(value, transaction) {
			return transaction.docChanged ||
				transaction.selection ||
				syntaxTree(transaction.state) !== syntaxTree(transaction.startState)
				? build(transaction.state)
				: value;
		},
		// A state field supports both inline marks and replacements that change block layout.
		provide: (field) => EditorView.decorations.from(field)
	});
}
