<script lang="ts">
	import { onMount } from 'svelte';
	import { indentWithTab } from '@codemirror/commands';
	import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
	import { yamlFrontmatter } from '@codemirror/lang-yaml';
	import {
		HighlightStyle,
		LanguageDescription,
		indentUnit,
		syntaxHighlighting
	} from '@codemirror/language';
	import { languages } from '@codemirror/language-data';
	import { Compartment, EditorState, StateEffect, StateField } from '@codemirror/state';
	import { EditorView, keymap } from '@codemirror/view';
	import { tags } from '@lezer/highlight';
	import { basicSetup } from 'codemirror';
	import { preview, editing } from './features';
	import { frontmatterRange } from './features/frontmatter/source';
	import { createMediaMarkdown } from './features/media/insert';

	let {
		initialMarkdown,
		ariaLabel = 'Markdown document editor',
		autofocus = false,
		mode = 'live',
		onMarkdownChange,
		onReady
	}: {
		initialMarkdown: string;
		ariaLabel?: string;
		autofocus?: boolean;
		mode?: 'live' | 'source';
		onMarkdownChange?: (markdown: string) => void;
		onReady?: (view: EditorView) => void;
	} = $props();

	let host = $state<HTMLDivElement>();
	let editor = $state.raw<EditorView>();
	let configuredMode: 'live' | 'source' = 'live';
	let insertError = $state('');
	const livePreviewCompartment = new Compartment();
	let nextInsertId = 0;
	type PendingInsert = { from: number; to: number; original: string };
	const addPendingInsert = StateEffect.define<{ id: number; range: PendingInsert }>();
	const removePendingInsert = StateEffect.define<number>();
	const pendingInserts = StateField.define<Record<number, PendingInsert>>({
		create: () => ({}),
		update(value, transaction) {
			const next: Record<number, PendingInsert> = {};
			for (const [id, range] of Object.entries(value)) {
				const collapsed = range.from === range.to;
				next[Number(id)] = {
					from: transaction.changes.mapPos(range.from, collapsed ? 1 : -1),
					to: transaction.changes.mapPos(range.to, 1),
					original: range.original
				};
			}
			for (const effect of transaction.effects) {
				if (effect.is(addPendingInsert)) next[effect.value.id] = effect.value.range;
				if (effect.is(removePendingInsert)) delete next[effect.value];
			}
			return next;
		}
	});

	const highlightStyle = HighlightStyle.define([
		{ tag: tags.heading, color: 'var(--content)', fontWeight: '750' },
		{ tag: tags.strong, color: 'var(--content)', fontWeight: '750' },
		{ tag: tags.emphasis, fontStyle: 'italic' },
		{ tag: tags.keyword, color: 'var(--brand)', fontWeight: '650' },
		{ tag: tags.string, color: 'color-mix(in oklch, var(--brand) 66%, var(--content))' },
		{ tag: [tags.variableName, tags.propertyName], color: 'var(--content)' },
		{ tag: [tags.function(tags.variableName), tags.typeName], color: 'var(--brand)' },
		{ tag: [tags.link, tags.url], color: 'var(--brand)', textDecoration: 'underline' },
		{ tag: [tags.meta, tags.processingInstruction], color: 'var(--content-1)' },
		{ tag: [tags.quote, tags.comment], color: 'var(--content-1)' },
		{ tag: [tags.monospace, tags.contentSeparator], color: 'var(--brand)' },
		{
			tag: [tags.bool, tags.number],
			color: 'color-mix(in oklch, var(--brand) 72%, var(--content))'
		}
	]);
	const codeLanguages = [
		LanguageDescription.of({
			name: 'Svelte',
			alias: ['svelte'],
			load: () => import('@codemirror/lang-html').then((module) => module.html())
		}),
		...languages
	];

	function extensions() {
		return [
			basicSetup,
			yamlFrontmatter({ content: markdown({ base: markdownLanguage, codeLanguages }) }),
			syntaxHighlighting(highlightStyle),
			editing,
			keymap.of([indentWithTab]),
			EditorView.lineWrapping,
			EditorState.tabSize.of(4),
			indentUnit.of('    '),
			pendingInserts,
			livePreviewCompartment.of(mode === 'live' ? preview : []),
			EditorView.contentAttributes.of({
				'aria-label': ariaLabel,
				'aria-multiline': 'true',
				spellcheck: 'false'
			}),
			EditorView.domEventHandlers({
				dragover: handleDragOver,
				drop: handleDrop,
				paste: handlePaste
			}),
			EditorView.updateListener.of((update) => {
				if (update.docChanged) onMarkdownChange?.(update.state.doc.toString());
			}),
			EditorView.theme({
				'&': {
					backgroundColor: 'transparent',
					color: 'var(--content)',
					fontFamily: 'var(--font-body)',
					fontSize: 'var(--s0)',
					minHeight: '100%'
				},
				'&.cm-focused': { outline: 'none' },
				'.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.65', overflow: 'visible' },
				'.cm-content': { caretColor: 'var(--brand)', padding: '0 0 8rem' },
				'.cm-line': { padding: '0' },
				'.cm-gutters': { display: 'none' },
				'.cm-activeLine': { backgroundColor: 'transparent' },
				// Code lines have an opaque background, so the selection layer must paint over them.
				'.cm-selectionLayer': { zIndex: '1 !important' },
				'&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
					backgroundColor: 'color-mix(in oklch, var(--brand) 22%, transparent) !important'
				},
				'.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--brand)' },
				'.cm-panels, .cm-tooltip': {
					backgroundColor: 'var(--base-1)',
					borderColor: 'var(--edge)'
				}
			})
		];
	}

	function handleDragOver(event: DragEvent) {
		if (!event.dataTransfer?.types.includes('Files')) return false;
		event.preventDefault();
		return true;
	}

	function handleDrop(event: DragEvent) {
		const files = event.dataTransfer?.files;
		if (!files?.length) return false;
		event.preventDefault();
		const position = editor?.posAtCoords({ x: event.clientX, y: event.clientY });
		void insertFiles(
			Array.from(files),
			position == null ? undefined : { from: position, to: position }
		);
		return true;
	}

	function handlePaste(event: ClipboardEvent) {
		const files = event.clipboardData?.files;
		if (!files?.length) return false;
		event.preventDefault();
		void insertFiles(Array.from(files));
		return true;
	}

	async function insertFiles(files: File[], target?: { from: number; to: number }) {
		const current = editor;
		if (!current) return;
		const id = ++nextInsertId;
		const range = target ?? current.state.selection.main;
		current.dispatch({
			effects: addPendingInsert.of({
				id,
				range: {
					from: range.from,
					to: range.to,
					original: current.state.doc.sliceString(range.from, range.to)
				}
			})
		});
		const results = await Promise.allSettled(files.map(createMediaMarkdown));
		if (editor !== current) return;
		const pending = current.state.field(pendingInserts)[id];
		if (!pending) return;
		const markdown = results
			.filter(
				(
					result
				): result is PromiseFulfilledResult<Awaited<ReturnType<typeof createMediaMarkdown>>> =>
					result.status === 'fulfilled'
			)
			.map((result) => result.value.markdown)
			.join('\n\n');
		const selectionUnchanged =
			current.state.doc.sliceString(pending.from, pending.to) === pending.original;
		current.dispatch({
			...(markdown
				? {
						changes: {
							from: selectionUnchanged ? pending.from : pending.to,
							to: pending.to,
							insert: markdown
						}
					}
				: {}),
			effects: removePendingInsert.of(id)
		});
		const failed = results.filter((result) => result.status === 'rejected').length;
		insertError = failed ? `Could not add ${failed} ${failed === 1 ? 'file' : 'files'}.` : '';
	}

	function switchMode(next: 'live' | 'source') {
		if (configuredMode === next || !editor) return;
		configuredMode = next;
		editor.dispatch({
			effects: livePreviewCompartment.reconfigure(next === 'live' ? preview : [])
		});
	}

	$effect(() => switchMode(mode));

	onMount(() => {
		if (!host) return;
		const state = EditorState.create({
			doc: initialMarkdown,
			selection: { anchor: frontmatterRange(initialMarkdown)?.bodyFrom ?? 0 },
			extensions: extensions()
		});
		editor = new EditorView({ parent: host, state });
		configuredMode = mode;
		if (autofocus) requestAnimationFrame(() => editor?.focus());
		onReady?.(editor);

		return () => {
			editor?.destroy();
			editor = undefined;
		};
	});
</script>

<section class="markdown-editor-surface">
	<div class="codemirror-editor" bind:this={host}></div>
	{#if insertError}<p class="insert-error" role="alert">{insertError}</p>{/if}
</section>

<style>
	.markdown-editor-surface {
		min-height: 100%;
		position: relative;
		width: 100%;
	}
	.codemirror-editor {
		min-height: 100%;
		width: 100%;
	}
	.insert-error {
		color: var(--error);
		margin: var(--s-2) auto;
		max-width: 680px;
	}
</style>
