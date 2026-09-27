<script lang="ts">
	import { onMount } from 'svelte';
	import { indentWithTab } from '@codemirror/commands';
	import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
	import { yamlFrontmatter } from '@codemirror/lang-yaml';
	import {
		HighlightStyle,
		LanguageDescription,
		indentUnit,
		syntaxHighlighting,
		syntaxTree
	} from '@codemirror/language';
	import { languages } from '@codemirror/language-data';
	import { Compartment, EditorState, Prec, StateEffect, StateField } from '@codemirror/state';
	import { EditorView, keymap } from '@codemirror/view';
	import { tags } from '@lezer/highlight';
	import type { SyntaxNode } from '@lezer/common';
	import { basicSetup } from 'codemirror';
	import { livePreview } from './live-preview';
	import {
		frontmatterExtension,
		frontmatterTheme,
		openFrontmatter,
		openFrontmatterFromBody
	} from './frontmatter';
	import { frontmatterRange } from '$lib/editor/document/frontmatter-source';
	import { codeBlockExtension, codeBlockTheme } from './code-blocks';
	import {
		exitEmptyListItem,
		indentListItem,
		insertListHardBreak,
		insertListSiblingAfterContinuation,
		outdentListItem
	} from './list-commands';
	import { linkHrefFromMarkdown } from './link-target';
	import { createMediaMarkdown } from './media-drop';

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
			frontmatterTheme,
			codeBlockTheme,
			Prec.highest(
				keymap.of([
					{ key: 'Mod-Enter', run: openLinkAtCursor },
					{ key: 'Mod-;', run: openFrontmatter },
					{ key: 'ArrowUp', run: openFrontmatterFromBody },
					{ key: 'Enter', run: exitEmptyListItem },
					{ key: 'Enter', run: insertListSiblingAfterContinuation },
					{ key: 'Shift-Enter', run: insertListHardBreak },
					{ key: 'Tab', run: indentListItem },
					{ key: 'Shift-Tab', run: outdentListItem }
				])
			),
			keymap.of([indentWithTab]),
			EditorView.lineWrapping,
			EditorState.tabSize.of(4),
			indentUnit.of('    '),
			pendingInserts,
			livePreviewCompartment.of(
				mode === 'live' ? [...livePreview, ...frontmatterExtension, ...codeBlockExtension] : []
			),
			EditorView.contentAttributes.of({
				'aria-label': ariaLabel,
				'aria-multiline': 'true',
				spellcheck: 'false'
			}),
			EditorView.domEventHandlers({
				mousedown: handleLinkMouseDown,
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
				'&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
					backgroundColor: 'color-mix(in oklch, var(--brand) 22%, transparent) !important'
				},
				'.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--brand)' },
				'.cm-panels, .cm-tooltip': {
					backgroundColor: 'var(--base-1)',
					borderColor: 'var(--edge)'
				},
				// Live preview
				'.cm-live-h1, .cm-live-h2, .cm-live-h3, .cm-live-h4, .cm-live-h5, .cm-live-h6': {
					display: 'block',
					fontWeight: '750',
					letterSpacing: '-0.04em',
					lineHeight: '1.08'
				},
				'.cm-live-h1': { fontSize: 'var(--s4)' },
				'.cm-live-h2': { fontSize: 'var(--s2)' },
				'.cm-live-h3': { fontSize: 'var(--s1)' },
				'.cm-live-strong': { fontWeight: '750' },
				'.cm-live-em': { fontStyle: 'italic' },
				'.cm-live-strike': { textDecoration: 'line-through' },
				'.cm-live-inline-code': {
					background: 'color-mix(in oklch, var(--brand) 9%, var(--base-2))',
					borderRadius: 'calc(var(--radius) * 0.45)',
					color: 'var(--brand)',
					fontFamily: 'var(--font-mono)',
					fontSize: '0.88em',
					padding: '0.1em 0.3em'
				},
				'.cm-live-link': { color: 'var(--brand)', textDecoration: 'underline' },
				'.cm-live-quote-line': {
					borderLeft: '2px solid var(--edge)',
					color: 'var(--content-1)',
					paddingLeft: 'var(--s-2)'
				},
				'.cm-live-callout-label': {
					color: 'var(--brand)',
					fontSize: '0.85em',
					fontWeight: '750',
					letterSpacing: '0.04em'
				},
				'.cm-live-list-marker': { color: 'var(--brand)', display: 'inline-block', minWidth: '1ch' },
				'.cm-live-task': { accentColor: 'var(--brand)', marginRight: '0.3em' },
				'.cm-live-attachment': {
					color: 'var(--brand)',
					textDecoration: 'underline'
				},
				'.cm-live-component': {
					alignItems: 'center',
					background: 'color-mix(in oklch, var(--brand) 10%, var(--base-2))',
					border: '1px solid color-mix(in oklch, var(--brand) 30%, var(--edge))',
					borderRadius: 'calc(var(--radius) * 0.6)',
					color: 'var(--brand)',
					display: 'inline-flex',
					fontFamily: 'var(--font-mono)',
					fontSize: 'var(--s-1)',
					fontWeight: '650',
					padding: '0.1em 0.5em'
				}
			})
		];
	}

	function linkAtPosition(view: EditorView, position: number) {
		for (const side of [-1, 1] as const) {
			for (
				let node: SyntaxNode | null = syntaxTree(view.state).resolveInner(position, side);
				node;
				node = node.parent
			) {
				if (node.name !== 'Link') continue;
				const full = view.state.doc.sliceString(
					Math.max(0, node.from - 1),
					Math.min(view.state.doc.length, node.to + 1)
				);
				return (
					linkHrefFromMarkdown(full) ??
					linkHrefFromMarkdown(view.state.doc.sliceString(node.from, node.to))
				);
			}
		}
		return null;
	}

	function openLink(href: string | null) {
		if (!href) return false;
		window.open(href, '_blank', 'noopener,noreferrer');
		return true;
	}

	function openLinkAtCursor(view: EditorView) {
		return openLink(linkAtPosition(view, view.state.selection.main.head));
	}

	function handleLinkMouseDown(event: MouseEvent, view: EditorView) {
		if (event.button !== 0 || (!event.metaKey && !event.ctrlKey)) return false;
		const target = event.target;
		const decoratedHref =
			target instanceof Element
				? target.closest<HTMLElement>('[data-cm-link-href]')?.dataset.cmLinkHref
				: undefined;
		const position = view.posAtCoords({ x: event.clientX, y: event.clientY });
		const href = decoratedHref ?? (position === null ? null : linkAtPosition(view, position));
		if (!openLink(href)) return false;
		event.preventDefault();
		event.stopPropagation();
		return true;
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
			effects: livePreviewCompartment.reconfigure(
				next === 'live' ? [...livePreview, ...frontmatterExtension, ...codeBlockExtension] : []
			)
		});
	}

	$effect(() => switchMode(mode));

	onMount(() => {
		if (!host) return;
		const state = EditorState.create({
			doc: initialMarkdown,
			selection: { anchor: frontmatterRange(initialMarkdown)?.to ?? 0 },
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

	.codemirror-editor :global(.cm-live-media) {
		background: var(--base-2);
		border-radius: var(--radius);
		display: inline-block;
		max-width: 100%;
		position: relative;
		vertical-align: middle;
	}

	.codemirror-editor :global(.cm-live-media-edit) {
		background: var(--base-1);
		border: 1px solid var(--edge);
		border-radius: var(--s-3);
		color: var(--content);
		cursor: pointer;
		font: inherit;
		font-size: var(--s-2);
		opacity: 0;
		padding: var(--s-4) var(--s-3);
		position: absolute;
		right: var(--s-3);
		top: var(--s-3);
	}

	.codemirror-editor :global(.cm-live-media:hover .cm-live-media-edit),
	.codemirror-editor :global(.cm-live-media:focus-within .cm-live-media-edit) {
		opacity: 1;
	}

	.codemirror-editor :global(.cm-live-media img),
	.codemirror-editor :global(.cm-live-media video),
	.codemirror-editor :global(.cm-live-media audio) {
		display: block;
		max-height: 70vh;
		max-width: 100%;
		object-fit: contain;
	}

	.codemirror-editor :global(.cm-live-table) {
		overflow-x: auto;
		padding-block: var(--s-2);
	}

	.codemirror-editor :global(.cm-live-rule) {
		border: 0;
		border-top: 1px solid var(--edge);
		padding-block: var(--s1);
		width: 100%;
	}

	.codemirror-editor :global(.cm-live-table table) {
		border-collapse: collapse;
		width: 100%;
	}

	.codemirror-editor :global(.cm-live-table th),
	.codemirror-editor :global(.cm-live-table td) {
		border: 1px solid var(--edge);
		padding: var(--s-2);
		text-align: left;
	}

	.insert-error {
		color: var(--error);
		margin: var(--s-2) auto;
		max-width: 680px;
	}

	.codemirror-editor :global(.cm-live-media-error) {
		background: color-mix(in oklch, var(--error) 8%, var(--base-2));
		border: 1px dashed var(--edge);
		min-height: 6rem;
		padding: var(--s1);
	}
</style>
