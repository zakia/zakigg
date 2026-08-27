<script lang="ts">
	import { onDestroy } from 'svelte';
	import { CODE_BLOCK_CLASS_NAMES, CODE_BLOCK_LANGUAGES, normalizeLanguage } from './config';
	import { highlightCodeToHtml } from './highlighter';

	type Props = {
		title?: string;
		header?: string;
		language?: string;
		code?: string;
	};

	let { title, header, language = '', code = '' }: Props = $props();
	let copyState = $state<'idle' | 'copied' | 'failed'>('idle');
	let highlighted = $state<string>();
	let copyResetTimer: number | undefined;
	let highlightRequest = 0;

	const normalizedLanguage = $derived(normalizeLanguage(language));
	const displayTitle = $derived(String(title ?? header ?? ''));
	const renderedCode = $derived(highlighted ?? escapeHtml(code));
	const lineNumbers = $derived(
		Array.from({ length: Math.max(1, code.split('\n').length) }, (_, index) => index + 1)
	);
	const copyLabel = $derived(
		copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Failed' : 'Copy'
	);

	$effect(() => {
		const currentRequest = (highlightRequest += 1);
		highlighted = escapeHtml(code);

		void highlightCodeToHtml(code, normalizedLanguage).then((html) => {
			if (currentRequest === highlightRequest) highlighted = html;
		});
	});

	function getLanguageLabel(value: string) {
		return (
			CODE_BLOCK_LANGUAGES.find((codeLanguage) => codeLanguage.value === value)?.label ??
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

	function scheduleCopyReset() {
		if (copyResetTimer) window.clearTimeout(copyResetTimer);

		copyResetTimer = window.setTimeout(() => {
			copyState = 'idle';
			copyResetTimer = undefined;
		}, 1300);
	}

	async function copyCode() {
		try {
			await navigator.clipboard.writeText(code);
			copyState = 'copied';
		} catch {
			copyState = 'failed';
		}

		scheduleCopyReset();
	}

	onDestroy(() => {
		if (copyResetTimer) window.clearTimeout(copyResetTimer);
	});
</script>

<figure
	class={CODE_BLOCK_CLASS_NAMES.root}
	data-code-block
	data-code-language={normalizedLanguage}
	data-title={displayTitle || undefined}
>
	<div class={CODE_BLOCK_CLASS_NAMES.header}>
		<span class={CODE_BLOCK_CLASS_NAMES.title}>
			{displayTitle || getLanguageLabel(normalizedLanguage)}
		</span>
		<div class={CODE_BLOCK_CLASS_NAMES.controls}>
			<span class={CODE_BLOCK_CLASS_NAMES.language}>{getLanguageLabel(normalizedLanguage)}</span>
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
		<span class={CODE_BLOCK_CLASS_NAMES.lineNumbers} aria-hidden="true">
			{#each lineNumbers as line (line)}
				<span>{line}</span>
			{/each}
		</span>
		<pre class={CODE_BLOCK_CLASS_NAMES.pre}>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<code class={CODE_BLOCK_CLASS_NAMES.content}>{@html renderedCode}</code>
		</pre>
	</div>
</figure>
