import { syntaxTree } from '@codemirror/language';
import { redo, undo } from '@codemirror/commands';
import { StateField, type ChangeSpec, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';
import {
	CODE_BLOCK_LANGUAGES,
	normalizeLanguage
} from '$lib/editor/presentation/code-block/config';

type CodeBlock = {
	from: number;
	language: string;
	languageFrom: number;
	languageTo: number;
	meta: string;
	code: string;
	firstLine: number;
	lastLine: number;
};

function codeBlockAt(state: EditorState, from: number): CodeBlock | null {
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
		language,
		languageFrom,
		languageTo: languageFrom + language.length,
		meta: info.slice(leadingWhitespace + language.length).trim(),
		code: state.doc.sliceString(codeFrom, codeTo),
		firstLine: opening.number,
		lastLine: closing?.number ?? state.doc.lines
	};
}

export function changeCodeBlockLanguage(
	state: EditorState,
	from: number,
	language: string
): ChangeSpec | null {
	const block = codeBlockAt(state, from);
	if (!block) return null;
	return {
		from: block.languageFrom,
		to: block.languageTo,
		// A plain-text token keeps any following fence metadata attached to the code block.
		insert: language === 'plaintext' && !block.meta ? '' : language
	};
}

class CodeHeaderWidget extends WidgetType {
	constructor(readonly block: CodeBlock) {
		super();
	}
	eq(other: CodeHeaderWidget) {
		return (
			this.block.from === other.block.from &&
			this.block.language === other.block.language &&
			this.block.meta === other.block.meta &&
			this.block.code === other.block.code
		);
	}
	toDOM(view: EditorView) {
		const header = document.createElement('div');
		header.className = 'cm-code-header';
		header.contentEditable = 'false';
		header.addEventListener('keydown', (event) => {
			if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
			event.preventDefault();
			event.stopPropagation();
			if (event.shiftKey) redo(view);
			else undo(view);
		});
		const language = document.createElement('select');
		language.setAttribute('aria-label', 'Code block language');
		const selected = normalizeLanguage(this.block.language);
		if (this.block.language && selected === 'plaintext' && this.block.language !== 'plaintext') {
			const unknown = document.createElement('option');
			unknown.value = this.block.language;
			unknown.textContent = this.block.language;
			language.append(unknown);
		}
		for (const item of CODE_BLOCK_LANGUAGES) {
			const option = document.createElement('option');
			option.value = item.value;
			option.textContent = item.label;
			language.append(option);
		}
		language.value = this.block.language || 'plaintext';
		if (!language.value) language.value = selected;
		language.addEventListener('change', () => {
			const changes = changeCodeBlockLanguage(view.state, this.block.from, language.value);
			if (changes) view.dispatch({ changes, userEvent: 'input' });
		});
		const details = document.createElement('div');
		details.className = 'cm-code-details';
		if (this.block.meta) {
			const title = document.createElement('span');
			title.className = 'cm-code-meta';
			title.textContent = this.block.meta;
			details.append(title);
		}
		const copy = document.createElement('button');
		copy.type = 'button';
		copy.className = 'cm-code-copy';
		copy.textContent = 'Copy';
		copy.setAttribute('aria-label', 'Copy code block');
		copy.addEventListener('click', async () => {
			const current = codeBlockAt(view.state, this.block.from);
			if (!current) return;
			try {
				await navigator.clipboard.writeText(current.code);
				copy.textContent = 'Copied';
			} catch {
				copy.textContent = 'Copy failed';
			}
			window.setTimeout(() => {
				if (copy.isConnected) copy.textContent = 'Copy';
			}, 1300);
		});
		const controls = document.createElement('div');
		controls.className = 'cm-code-controls';
		controls.append(copy, language);
		header.append(details, controls);
		return header;
	}
	ignoreEvent() {
		return true;
	}
}

class CodeFooterWidget extends WidgetType {
	toDOM() {
		const footer = document.createElement('div');
		footer.className = 'cm-code-footer';
		footer.setAttribute('aria-hidden', 'true');
		return footer;
	}
}

function buildCodeBlocks(state: EditorState): DecorationSet {
	const ranges: { from: number; to: number; decoration: Decoration }[] = [];
	syntaxTree(state).iterate({
		enter(node) {
			if (node.name !== 'FencedCode') return;
			const block = codeBlockAt(state, node.from);
			if (!block) return;
			const opening = state.doc.line(block.firstLine);
			const closing = state.doc.line(block.lastLine);
			const selected = state.selection.ranges.some(
				(range) => range.from <= node.to && range.to >= node.from
			);
			if (selected) {
				for (let number = block.firstLine; number <= block.lastLine; number++) {
					const line = state.doc.line(number);
					const edge =
						number === block.firstLine
							? ' cm-code-source-first'
							: number === block.lastLine
								? ' cm-code-source-last'
								: '';
					ranges.push({
						from: line.from,
						to: line.from,
						decoration: Decoration.line({ class: `cm-code-source-line${edge}` })
					});
				}
				return;
			}
			ranges.push({
				from: opening.from,
				to: opening.to,
				decoration: Decoration.replace({ block: true, widget: new CodeHeaderWidget(block) })
			});
			for (let number = block.firstLine + 1; number < block.lastLine; number++) {
				const line = state.doc.line(number);
				ranges.push({
					from: line.from,
					to: line.from,
					decoration: Decoration.line({ class: 'cm-code-content-line' })
				});
			}
			if (block.lastLine > block.firstLine && closing.from < state.doc.length)
				ranges.push({
					from: closing.from,
					to: closing.to,
					decoration: Decoration.replace({ block: true, widget: new CodeFooterWidget() })
				});
		}
	});
	return Decoration.set(
		ranges.map((item) => item.decoration.range(item.from, item.to)),
		true
	);
}

const codeBlockField = StateField.define<DecorationSet>({
	create: buildCodeBlocks,
	update(value, transaction) {
		return transaction.docChanged || transaction.selection !== transaction.startState.selection
			? buildCodeBlocks(transaction.state)
			: value;
	},
	provide: (field) => EditorView.decorations.from(field)
});

export const codeBlockExtension = [codeBlockField];

export const codeBlockTheme = EditorView.baseTheme({
	'.cm-code-header': {
		alignItems: 'center',
		background: 'var(--base-2)',
		border: '1px solid var(--edge)',
		borderBottom: '0',
		borderRadius: 'var(--radius) var(--radius) 0 0',
		display: 'flex',
		justifyContent: 'space-between',
		minHeight: '2.25rem',
		padding: 'var(--s-2) var(--s0) 0'
	},
	'.cm-code-header select, .cm-code-header button': {
		background: 'transparent',
		border: '0',
		color: 'var(--content-1)',
		cursor: 'pointer',
		font: 'inherit',
		fontSize: 'var(--s-1)',
		minHeight: '1.5rem'
	},
	'.cm-code-details': { minWidth: '0' },
	'.cm-code-controls': {
		alignItems: 'center',
		display: 'flex',
		gap: 'var(--s-2)',
		marginLeft: 'auto'
	},
	'.cm-code-meta': {
		color: 'var(--content-2)',
		fontSize: 'var(--s-1)',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap'
	},
	'.cm-code-header button:hover, .cm-code-header select:hover': { color: 'var(--content)' },
	'.cm-line.cm-code-content-line, .cm-line.cm-code-source-line': {
		background: 'var(--base-2)',
		borderLeft: '1px solid var(--edge)',
		borderRight: '1px solid var(--edge)',
		fontFamily: 'var(--font-mono)',
		fontSize: 'var(--s-1)',
		paddingLeft: 'var(--s0)',
		paddingRight: 'var(--s0)'
	},
	'.cm-line.cm-code-source-first': {
		borderTop: '1px solid var(--edge)',
		borderRadius: 'var(--radius) var(--radius) 0 0',
		paddingTop: 'var(--s-2)'
	},
	'.cm-line.cm-code-source-last': {
		borderBottom: '1px solid var(--edge)',
		borderRadius: '0 0 var(--radius) var(--radius)',
		paddingBottom: 'var(--s-2)'
	},
	'.cm-code-footer': {
		background: 'var(--base-2)',
		border: '1px solid var(--edge)',
		borderTop: '0',
		borderRadius: '0 0 var(--radius) var(--radius)',
		height: 'var(--s0)'
	}
});
