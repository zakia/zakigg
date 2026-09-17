<script lang="ts">
	import { onMount } from 'svelte';
	import { defaultKeymap, indentWithTab } from '@codemirror/commands';
	import { markdown } from '@codemirror/lang-markdown';
	import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
	import { languages } from '@codemirror/language-data';
	import { EditorState } from '@codemirror/state';
	import { EditorView, keymap } from '@codemirror/view';
	import { tags } from '@lezer/highlight';
	import { basicSetup } from 'codemirror';

	let {
		value,
		ariaLabel,
		autofocus = false,
		onChange
	}: {
		value: string;
		ariaLabel: string;
		autofocus?: boolean;
		onChange: (markdown: string) => void;
	} = $props();

	let host = $state<HTMLDivElement>();
	let editor = $state.raw<EditorView>();

	const markdownHighlighting = HighlightStyle.define([
		{ tag: tags.heading, color: 'var(--content)', fontWeight: '750' },
		{ tag: tags.strong, color: 'var(--content)', fontWeight: '750' },
		{ tag: tags.emphasis, fontStyle: 'italic' },
		{ tag: [tags.link, tags.url], color: 'var(--brand)', textDecoration: 'underline' },
		{ tag: [tags.meta, tags.processingInstruction], color: 'var(--content-1)' },
		{ tag: [tags.quote, tags.comment], color: 'var(--content-1)' },
		{ tag: [tags.monospace, tags.contentSeparator], color: 'var(--brand)' },
		{
			tag: [tags.bool, tags.number],
			color: 'color-mix(in oklch, var(--brand) 72%, var(--content))'
		}
	]);

	$effect(() => {
		if (!editor) return;
		const current = editor.state.doc.toString();
		if (current === value) return;
		editor.dispatch({ changes: { from: 0, to: current.length, insert: value } });
	});

	onMount(() => {
		if (!host) return;

		editor = new EditorView({
			parent: host,
			state: EditorState.create({
				doc: value,
				extensions: [
					basicSetup,
					markdown({ codeLanguages: languages }),
					syntaxHighlighting(markdownHighlighting),
					keymap.of([...defaultKeymap, indentWithTab]),
					EditorView.lineWrapping,
					EditorState.tabSize.of(4),
					EditorView.contentAttributes.of({
						'aria-label': ariaLabel,
						'aria-multiline': 'true',
						spellcheck: 'false'
					}),
					EditorView.theme({
						'&': {
							backgroundColor: 'transparent',
							color: 'var(--content)',
							fontFamily: 'var(--font-mono)',
							fontSize: '0.9rem',
							minHeight: 'max(32rem, 70vh)'
						},
						'&.cm-focused': { outline: 'none' },
						'.cm-scroller': {
							fontFamily: 'inherit',
							lineHeight: '1.72',
							overflow: 'visible'
						},
						'.cm-content': {
							caretColor: 'var(--brand)',
							padding: '0.5rem 0 8rem'
						},
						'.cm-line': { padding: '0' },
						'.cm-gutters': { display: 'none' },
						'.cm-activeLine': {
							backgroundColor: 'color-mix(in oklch, var(--content) 3.5%, transparent)'
						},
						'&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
							backgroundColor: 'color-mix(in oklch, var(--brand) 22%, transparent) !important'
						},
						'.cm-cursor, .cm-dropCursor': {
							borderLeftColor: 'var(--brand)'
						},
						'.cm-panels, .cm-tooltip': {
							backgroundColor: 'var(--base-1)',
							borderColor: 'var(--edge)'
						}
					}),
					EditorView.updateListener.of((update) => {
						if (update.docChanged) onChange(update.state.doc.toString());
					})
				]
			})
		});

		if (autofocus) requestAnimationFrame(() => editor?.focus());

		return () => {
			editor?.destroy();
			editor = undefined;
		};
	});
</script>

<div class="source-editor" bind:this={host}></div>

<style>
	.source-editor {
		min-height: max(32rem, 70vh);
		width: 100%;
	}
</style>
