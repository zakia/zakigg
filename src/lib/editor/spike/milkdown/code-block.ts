import { mount, unmount } from 'svelte';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import type { LanguageDescription, LanguageSupport } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { Compartment, EditorState, type Line, type SelectionRange } from '@codemirror/state';
import {
	drawSelection,
	EditorView as CodeMirror,
	keymap as codeMirrorKeymap,
	type KeyBinding,
	type ViewUpdate
} from '@codemirror/view';
import { basicSetup } from 'codemirror';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { exitCode } from '@milkdown/kit/prose/commands';
import { redo, undo } from '@milkdown/kit/prose/history';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView, NodeView, NodeViewConstructor } from '@milkdown/kit/prose/view';
import { codeBlockSchema } from '@milkdown/kit/preset/commonmark';
import { $view } from '@milkdown/kit/utils';
import CodeBlockView, { type CodeLanguageInfo } from './CodeBlockView.svelte';
import { CodeBlockState } from './code-block-state.svelte';

class LanguageLoader {
	readonly #languages: LanguageDescription[];
	readonly #map = new Map<string, LanguageDescription>();

	constructor(languageDescriptions: LanguageDescription[]) {
		this.#languages = languageDescriptions;
		for (const language of languageDescriptions) {
			this.#map.set(language.name.toLowerCase(), language);
			for (const alias of language.alias) this.#map.set(alias.toLowerCase(), language);
		}
	}

	getAll(): CodeLanguageInfo[] {
		return this.#languages.map((language) => ({ name: language.name, alias: language.alias }));
	}

	load(languageName: string): Promise<LanguageSupport | undefined> {
		const language = this.#map.get(languageName.toLowerCase());
		if (!language) return Promise.resolve(undefined);
		if (language.support) return Promise.resolve(language.support);
		return language.load();
	}
}

const loader = new LanguageLoader(languages);

class SvelteCodeMirrorBlock implements NodeView {
	dom: HTMLElement;
	readonly #editorView: EditorView;
	readonly #getPos: () => number | undefined;
	readonly #codeMirror: CodeMirror;
	readonly #component: ReturnType<typeof mount>;
	readonly #state: CodeBlockState;
	readonly #languageCompartment = new Compartment();
	readonly #readOnlyCompartment = new Compartment();
	#node: ProseNode;
	#updating = false;
	#languageName = '';

	constructor(node: ProseNode, editorView: EditorView, getPos: () => number | undefined) {
		this.#node = node;
		this.#editorView = editorView;
		this.#getPos = getPos;
		this.#state = new CodeBlockState(String(node.attrs.language ?? ''), node.textContent);

		const dom = document.createElement('div');
		dom.className = 'milkdown-code-block';
		const controls = document.createElement('div');
		controls.className = 'zaki-code-block-controls';
		const editorHost = document.createElement('div');
		editorHost.className = 'code-editor-host';
		dom.append(controls, editorHost);
		this.dom = dom;

		this.#codeMirror = new CodeMirror({
			doc: node.textContent,
			parent: editorHost,
			root: editorView.root,
			extensions: [
				this.#readOnlyCompartment.of(EditorState.readOnly.of(!editorView.editable)),
				drawSelection(),
				codeMirrorKeymap.of(this.#keymap()),
				this.#languageCompartment.of([]),
				EditorState.changeFilter.of(() => editorView.editable || this.#updating),
				basicSetup,
				CodeMirror.theme({
					'&': { color: 'var(--content)', backgroundColor: 'transparent' },
					'.cm-content': {
						fontFamily: 'var(--font-mono)',
						fontSize: '0.88rem',
						lineHeight: '1.65',
						padding: '0.45rem 0.8rem 0.9rem'
					},
					'.cm-gutters': {
						backgroundColor: 'transparent',
						border: '0',
						color: 'var(--content-2)'
					},
					'.cm-activeLine, .cm-activeLineGutter': {
						backgroundColor: 'color-mix(in oklch, var(--brand) 7%, transparent)'
					},
					'&.cm-focused .cm-selectionBackground, ::selection': {
						backgroundColor: 'color-mix(in oklch, var(--brand) 24%, transparent)'
					}
				}),
				CodeMirror.updateListener.of(this.#forwardUpdate)
			]
		});

		this.#component = mount(CodeBlockView, {
			target: controls,
			props: {
				viewState: this.#state,
				languages: loader.getAll(),
				onSetLanguage: this.#setLanguage,
				onFocusEditor: () => this.#codeMirror.focus()
			}
		});

		this.#updateLanguage();
	}

	#forwardUpdate = (update: ViewUpdate) => {
		this.#state.text = update.state.doc.toString();
		if (this.#updating || !this.#codeMirror.hasFocus) return;

		let offset = (this.#getPos() ?? 0) + 1;
		const { main } = update.state.selection;
		const selectionFrom = offset + main.from;
		const selectionTo = offset + main.to;
		const proseSelection = this.#editorView.state.selection;
		if (
			!update.docChanged &&
			proseSelection.from === selectionFrom &&
			proseSelection.to === selectionTo
		)
			return;

		const transaction = this.#editorView.state.tr;
		update.changes.iterChanges((fromA, toA, fromB, toB, text) => {
			if (text.length) {
				transaction.replaceWith(
					offset + fromA,
					offset + toA,
					this.#editorView.state.schema.text(text.toString())
				);
			} else transaction.delete(offset + fromA, offset + toA);
			offset += toB - fromB - (toA - fromA);
		});
		transaction.setSelection(TextSelection.create(transaction.doc, selectionFrom, selectionTo));
		this.#editorView.dispatch(transaction);
	};

	#updateLanguage() {
		const languageName = String(this.#node.attrs.language ?? '');
		if (languageName === this.#languageName) return;
		this.#state.language = languageName;
		void loader
			.load(languageName)
			.then((language) => {
				this.#codeMirror.dispatch({
					effects: this.#languageCompartment.reconfigure(language ?? [])
				});
				this.#languageName = languageName;
			})
			.catch(console.error);
	}

	#setLanguage = (language: string) => {
		const position = this.#getPos();
		if (typeof position !== 'number') return;
		this.#editorView.dispatch(
			this.#editorView.state.tr.setNodeAttribute(position, 'language', language)
		);
	};

	#keymap(): KeyBinding[] {
		return [
			{ key: 'ArrowUp', run: () => this.#maybeEscape('line', -1) },
			{ key: 'ArrowLeft', run: () => this.#maybeEscape('char', -1) },
			{ key: 'ArrowDown', run: () => this.#maybeEscape('line', 1) },
			{ key: 'ArrowRight', run: () => this.#maybeEscape('char', 1) },
			{
				key: 'Mod-Enter',
				run: () => {
					if (!exitCode(this.#editorView.state, this.#editorView.dispatch)) return false;
					this.#editorView.focus();
					return true;
				}
			},
			{ key: 'Mod-z', run: () => undo(this.#editorView.state, this.#editorView.dispatch) },
			{ key: 'Shift-Mod-z', run: () => redo(this.#editorView.state, this.#editorView.dispatch) },
			{ key: 'Mod-y', run: () => redo(this.#editorView.state, this.#editorView.dispatch) },
			{
				key: 'Backspace',
				run: () => {
					const selection = this.#codeMirror.state.selection.main;
					if (!selection.empty || selection.anchor > 0 || this.#codeMirror.state.doc.lines >= 2)
						return false;
					const position = this.#getPos() ?? 0;
					const paragraph = this.#editorView.state.schema.nodes.paragraph;
					if (!paragraph) return false;
					const transaction = this.#editorView.state.tr.replaceWith(
						position,
						position + this.#node.nodeSize,
						paragraph.createChecked({}, this.#node.content)
					);
					transaction.setSelection(TextSelection.near(transaction.doc.resolve(position)));
					this.#editorView.dispatch(transaction);
					this.#editorView.focus();
					return true;
				}
			},
			...defaultKeymap,
			indentWithTab
		];
	}

	#maybeEscape(unit: 'line' | 'char', direction: -1 | 1) {
		const state = this.#codeMirror.state;
		let main: SelectionRange | Line = state.selection.main;
		if (!main.empty) return false;
		if (unit === 'line') main = state.doc.lineAt(main.head);
		if (direction < 0 ? main.from > 0 : main.to < state.doc.length) return false;

		const target = (this.#getPos() ?? 0) + (direction < 0 ? 0 : this.#node.nodeSize);
		const selection = TextSelection.near(this.#editorView.state.doc.resolve(target), direction);
		this.#editorView.dispatch(this.#editorView.state.tr.setSelection(selection).scrollIntoView());
		this.#editorView.focus();
		return true;
	}

	setSelection(anchor: number, head: number) {
		this.#codeMirror.focus();
		this.#updating = true;
		this.#codeMirror.dispatch({ selection: { anchor, head } });
		this.#updating = false;
	}

	update(node: ProseNode) {
		if (node.type !== this.#node.type || this.#updating) return node.type === this.#node.type;
		this.#node = node;
		this.#state.text = node.textContent;
		this.#state.language = String(node.attrs.language ?? '');
		this.#updateLanguage();

		if (this.#editorView.editable === this.#codeMirror.state.readOnly) {
			this.#codeMirror.dispatch({
				effects: this.#readOnlyCompartment.reconfigure(
					EditorState.readOnly.of(!this.#editorView.editable)
				)
			});
		}

		const change = computeChange(this.#codeMirror.state.doc.toString(), node.textContent);
		if (change) {
			this.#updating = true;
			this.#codeMirror.dispatch({
				changes: { from: change.from, to: change.to, insert: change.text }
			});
			this.#updating = false;
		}
		return true;
	}

	selectNode() {
		this.#state.selected = true;
		this.dom.classList.add('selected');
		this.#codeMirror.focus();
	}

	deselectNode() {
		this.#state.selected = false;
		this.dom.classList.remove('selected');
	}

	stopEvent() {
		return true;
	}

	destroy() {
		void unmount(this.#component);
		this.#codeMirror.destroy();
		this.dom.remove();
	}
}

function computeChange(oldValue: string, newValue: string) {
	if (oldValue === newValue) return null;
	let start = 0;
	let oldEnd = oldValue.length;
	let newEnd = newValue.length;
	while (start < oldEnd && oldValue.charCodeAt(start) === newValue.charCodeAt(start)) start += 1;
	while (
		oldEnd > start &&
		newEnd > start &&
		oldValue.charCodeAt(oldEnd - 1) === newValue.charCodeAt(newEnd - 1)
	) {
		oldEnd -= 1;
		newEnd -= 1;
	}
	return { from: start, to: oldEnd, text: newValue.slice(start, newEnd) };
}

function createCodeBlockNodeView(): NodeViewConstructor {
	return (node, view, getPos) => new SvelteCodeMirrorBlock(node, view, getPos);
}

export const codeBlockView = $view(codeBlockSchema.node, createCodeBlockNodeView);
export const codeBlockFeature = [codeBlockView];
