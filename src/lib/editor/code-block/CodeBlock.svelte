<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
	import type { Readable } from 'svelte/store';
	import {
		CODE_BLOCK_CLASS_NAMES,
		CODE_BLOCK_LANGUAGES,
		type CodeBlockAttributes,
		normalizeLanguage
	} from './config';
	import { highlightCodeToHtml } from './highlighter';

	type Props = {
		title?: string;
		header?: string;
		language?: string;
		code?: string;
		node?: Readable<ProseMirrorNode>;
		contentDOM?: HTMLElement;
		updateAttributes?: (attributes: CodeBlockAttributes) => void;
		titleEditable?: boolean;
		languageEditable?: boolean;
	};

	let {
		title,
		header,
		language = '',
		code = '',
		node,
		contentDOM,
		updateAttributes,
		titleEditable,
		languageEditable
	}: Props = $props();

	let currentNode = $state<ProseMirrorNode>();
	let copyState = $state<'idle' | 'copied' | 'failed'>('idle');
	let highlighted = $state('');
	let copyResetTimer: number | undefined;
	let highlightRequest = 0;

	const codeText = $derived(currentNode?.textContent ?? code);
	const normalizedLanguage = $derived(normalizeLanguage(currentNode?.attrs.language ?? language));
	const displayTitle = $derived(String(currentNode?.attrs.title ?? title ?? header ?? ''));
	const canEditTitle = $derived(titleEditable ?? Boolean(updateAttributes && currentNode));
	const canEditLanguage = $derived(languageEditable ?? Boolean(updateAttributes && currentNode));
	const lineNumbers = $derived(
		Array.from({ length: Math.max(1, codeText.split('\n').length) }, (_, index) => index + 1)
	);
	const copyLabel = $derived(
		copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Failed' : 'Copy'
	);

	$effect(() => {
		if (!node) {
			currentNode = undefined;
			return;
		}

		return node.subscribe((value) => {
			currentNode = value;
		});
	});

	$effect(() => {
		if (contentDOM) return;

		const currentRequest = (highlightRequest += 1);
		highlighted = escapeHtml(codeText);

		void highlightCodeToHtml(codeText, normalizedLanguage).then((html) => {
			if (currentRequest === highlightRequest) {
				highlighted = html;
			}
		});
	});

	const attachContentDOM: Attachment<HTMLElement> = (pre) => {
		if (!contentDOM) return;

		pre.append(contentDOM);

		return () => {
			contentDOM.remove();
		};
	};

	function scheduleCopyReset() {
		if (copyResetTimer) {
			window.clearTimeout(copyResetTimer);
		}

		copyResetTimer = window.setTimeout(() => {
			copyState = 'idle';
			copyResetTimer = undefined;
		}, 1300);
	}

	function updateTitle(event: Event) {
		const nextTitle = (event.currentTarget as HTMLInputElement).value;

		if (nextTitle !== displayTitle) {
			updateAttributes?.({ title: nextTitle });
		}
	}

	function updateLanguage(event: Event) {
		const nextLanguage = (event.currentTarget as HTMLSelectElement).value;

		if (nextLanguage !== normalizedLanguage) {
			updateAttributes?.({ language: nextLanguage });
		}
	}

	function getLanguageLabel(language: string) {
		return (
			CODE_BLOCK_LANGUAGES.find((codeLanguage) => codeLanguage.value === language)?.label ??
			'Plain Text'
		);
	}

	function escapeHtml(value: string) {
		return value
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	async function copyCode() {
		try {
			await navigator.clipboard.writeText(codeText);
			copyState = 'copied';
		} catch {
			copyState = 'failed';
		}

		scheduleCopyReset();
	}

	onDestroy(() => {
		if (copyResetTimer) {
			window.clearTimeout(copyResetTimer);
		}
	});
</script>

{#snippet codeBlockContent()}
	<div class={CODE_BLOCK_CLASS_NAMES.header} contenteditable="false">
		{#if canEditTitle}
			<input
				class={CODE_BLOCK_CLASS_NAMES.title}
				placeholder="Code block"
				title="Code block title"
				aria-label="Code block title"
				value={displayTitle}
				oninput={updateTitle}
			/>
		{:else if displayTitle}
			<span class={CODE_BLOCK_CLASS_NAMES.title}>{displayTitle}</span>
		{:else}
			<span class={CODE_BLOCK_CLASS_NAMES.title}>{getLanguageLabel(normalizedLanguage)}</span>
		{/if}

		<div class={CODE_BLOCK_CLASS_NAMES.controls}>
			{#if canEditLanguage}
				<select
					class={CODE_BLOCK_CLASS_NAMES.language}
					title="Code language"
					aria-label="Code language"
					value={normalizedLanguage}
					onchange={updateLanguage}
				>
					{#each CODE_BLOCK_LANGUAGES as codeLanguage (codeLanguage.value)}
						<option value={codeLanguage.value}>{codeLanguage.label}</option>
					{/each}
				</select>
			{:else}
				<span class={CODE_BLOCK_CLASS_NAMES.language}>{getLanguageLabel(normalizedLanguage)}</span>
			{/if}

			<button
				class={CODE_BLOCK_CLASS_NAMES.copy}
				type="button"
				title="Copy code"
				aria-label="Copy code"
				onclick={copyCode}
			>
				<span class={CODE_BLOCK_CLASS_NAMES.copyIcon}>⧉</span>
				<span>{copyLabel}</span>
			</button>
		</div>
	</div>

	<div class={CODE_BLOCK_CLASS_NAMES.body}>
		<span class={CODE_BLOCK_CLASS_NAMES.lineNumbers} contenteditable="false" aria-hidden="true">
			{#each lineNumbers as line}
				<span>{line}</span>
			{/each}
		</span>

		{#if contentDOM}
			<pre class={CODE_BLOCK_CLASS_NAMES.pre} {@attach attachContentDOM}></pre>
		{:else}
			<pre class={CODE_BLOCK_CLASS_NAMES.pre}>
				<code class={CODE_BLOCK_CLASS_NAMES.content}>{@html highlighted}</code>
			</pre>
		{/if}
	</div>
{/snippet}

{#if contentDOM}
	{@render codeBlockContent()}
{:else}
	<figure
		class={CODE_BLOCK_CLASS_NAMES.root}
		data-code-block
		data-code-language={normalizedLanguage}
		data-title={displayTitle || undefined}
	>
		{@render codeBlockContent()}
	</figure>
{/if}
