import { syntaxTree } from '@codemirror/language';
import type { ChangeSpec, EditorState } from '@codemirror/state';

export type Block = {
	from: number;
	to: number;
	language: string;
	languageFrom: number;
	languageTo: number;
	meta: string;
	code: string;
	firstLine: number;
	lastLine: number;
};

export function read(state: EditorState, from: number): Block | null {
	const node = syntaxTree(state).resolveInner(from, 1);
	let fenced = node;
	while (fenced && fenced.name !== 'FencedCode') fenced = fenced.parent!;
	if (!fenced) return null;
	const marks = [];
	for (let child = fenced.firstChild; child; child = child.nextSibling)
		if (child.name === 'CodeMark') marks.push(child);
	if (marks.length < 2) return null;
	const opening = state.doc.lineAt(marks[0].from);
	const closing = marks.length > 1 ? state.doc.lineAt(marks[marks.length - 1].from) : null;
	const codeFrom =
		opening.number < state.doc.lines ? state.doc.line(opening.number + 1).from : opening.to;
	const codeTo =
		closing && closing.number > opening.number + 1
			? state.doc.line(closing.number - 1).to
			: codeFrom;
	const info = state.doc.sliceString(marks[0].to, opening.to);
	const leadingWhitespace = /^\s*/.exec(info)?.[0].length ?? 0;
	const language = /^\S*/.exec(info.slice(leadingWhitespace))?.[0] ?? '';
	const languageFrom = marks[0].to + leadingWhitespace;
	return {
		from: fenced.from,
		to: fenced.to,
		language,
		languageFrom,
		languageTo: languageFrom + language.length,
		meta: info.slice(leadingWhitespace + language.length).trim(),
		code: state.doc.sliceString(codeFrom, codeTo),
		firstLine: opening.number,
		lastLine: closing?.number ?? state.doc.lines
	};
}

export function changeLanguage(
	state: EditorState,
	from: number,
	language: string
): ChangeSpec | null {
	const block = read(state, from);
	if (!block) return null;
	return {
		from: block.languageFrom,
		to: block.languageTo,
		// A plain-text token keeps any following fence metadata attached to the code block.
		insert: language === 'plaintext' && !block.meta ? '' : language
	};
}
