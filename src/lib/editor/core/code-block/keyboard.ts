import type { Editor } from '@tiptap/core';
import type { NodeType } from '@tiptap/pm/model';
import { Selection, TextSelection } from '@tiptap/pm/state';
import { DEFAULT_TAB_SIZE, type CodeBlockKeyboardOptions } from './config';

type CodeBlockKeyboardContext = {
	editor: Editor;
	name: string;
	type: NodeType;
	options: CodeBlockKeyboardOptions;
};

function selectedCodeBlockIndent(editor: Editor, type: NodeType, tabSize: number) {
	const { state } = editor;
	const { selection } = state;
	const { $from, empty } = selection;

	if ($from.parent.type !== type) return false;

	const indent = ' '.repeat(tabSize);

	if (empty) {
		return editor.commands.insertContent(indent);
	}

	return editor.commands.command(({ tr }) => {
		const { from, to } = selection;
		const text = state.doc.textBetween(from, to, '\n', '\n');
		const indentedText = text
			.split('\n')
			.map((line) => indent + line)
			.join('\n');

		tr.replaceWith(from, to, state.schema.text(indentedText));
		return true;
	});
}

function outdentCurrentCodeLine(editor: Editor, tabSize: number) {
	const { state } = editor;
	const { selection } = state;
	const { $from } = selection;

	return editor.commands.command(({ tr }) => {
		const { pos } = $from;
		const codeBlockStart = $from.start();
		const allText = state.doc.textBetween(codeBlockStart, $from.end(), '\n', '\n');
		const lines = allText.split('\n');
		const relativeCursorPosition = pos - codeBlockStart;
		let currentLineIndex = 0;
		let charCount = 0;

		for (let index = 0; index < lines.length; index += 1) {
			if (charCount + lines[index].length >= relativeCursorPosition) {
				currentLineIndex = index;
				break;
			}

			charCount += lines[index].length + 1;
		}

		const currentLine = lines[currentLineIndex];
		const spacesToRemove = Math.min(currentLine.match(/^ */)?.[0].length ?? 0, tabSize);

		if (spacesToRemove === 0) return true;

		let lineStartPosition = codeBlockStart;

		for (let index = 0; index < currentLineIndex; index += 1) {
			lineStartPosition += lines[index].length + 1;
		}

		tr.delete(lineStartPosition, lineStartPosition + spacesToRemove);

		const cursorPositionInLine = pos - lineStartPosition;

		if (cursorPositionInLine <= spacesToRemove) {
			tr.setSelection(TextSelection.create(tr.doc, lineStartPosition));
		}

		return true;
	});
}

function outdentSelectedCodeBlock(editor: Editor, type: NodeType, tabSize: number) {
	const { state } = editor;
	const { selection } = state;
	const { $from, empty } = selection;

	if ($from.parent.type !== type) return false;

	if (empty) {
		return outdentCurrentCodeLine(editor, tabSize);
	}

	return editor.commands.command(({ tr }) => {
		const { from, to } = selection;
		const text = state.doc.textBetween(from, to, '\n', '\n');
		const reverseIndentedText = text
			.split('\n')
			.map((line) => {
				const leadingSpaces = line.match(/^ */)?.[0] ?? '';
				return line.slice(Math.min(leadingSpaces.length, tabSize));
			})
			.join('\n');

		tr.replaceWith(from, to, state.schema.text(reverseIndentedText));
		return true;
	});
}

export function createCodeBlockKeyboardShortcuts({
	editor,
	name,
	type,
	options
}: CodeBlockKeyboardContext) {
	return {
		'Mod-Alt-c': () => editor.commands.toggleCodeBlock(),

		Backspace: () => {
			const { empty, $anchor } = editor.state.selection;
			const isAtStart = $anchor.pos === 1;

			if (!empty || $anchor.parent.type.name !== name) {
				return false;
			}

			if (isAtStart || !$anchor.parent.textContent.length) {
				return editor.commands.clearNodes();
			}

			return false;
		},

		Tab: () => {
			if (!options.enableTabIndentation) return false;

			return selectedCodeBlockIndent(editor, type, options.tabSize ?? DEFAULT_TAB_SIZE);
		},

		'Shift-Tab': () => {
			if (!options.enableTabIndentation) return false;

			return outdentSelectedCodeBlock(editor, type, options.tabSize ?? DEFAULT_TAB_SIZE);
		},

		Enter: () => {
			if (!options.exitOnTripleEnter) return false;

			const { state } = editor;
			const { selection } = state;
			const { $from, empty } = selection;

			if (!empty || $from.parent.type !== type) return false;

			const isAtEnd = $from.parentOffset === $from.parent.nodeSize - 2;
			const endsWithDoubleNewline = $from.parent.textContent.endsWith('\n\n');

			if (!isAtEnd || !endsWithDoubleNewline) return false;

			return editor
				.chain()
				.command(({ tr }) => {
					tr.delete($from.pos - 2, $from.pos);
					return true;
				})
				.exitCode()
				.run();
		},

		ArrowDown: () => {
			if (!options.exitOnArrowDown) return false;

			const { state } = editor;
			const { selection, doc } = state;
			const { $from, empty } = selection;

			if (!empty || $from.parent.type !== type) return false;

			const isAtEnd = $from.parentOffset === $from.parent.nodeSize - 2;

			if (!isAtEnd) return false;

			const after = $from.after();
			const nodeAfter = doc.nodeAt(after);

			if (nodeAfter) {
				return editor.commands.command(({ tr }) => {
					tr.setSelection(Selection.near(doc.resolve(after)));
					return true;
				});
			}

			return editor.commands.exitCode();
		}
	};
}
