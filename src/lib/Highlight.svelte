<script lang="ts">
	import '$lib/prism.css';
	import Icon from '@iconify/svelte';
	import Prism from 'prismjs';

	type Props = {
		language: string;
		code: string;
		header: string;
	};
	const { language, code, header }: Props = $props();

	let isCopied = $state(false);

	const codeHTML = $derived(Prism.highlight(code, Prism.languages[language], 'css'));

	const copyToClipboard = () => {
		if (isCopied) return;
		navigator.clipboard.writeText(code);
		isCopied = true;
		setTimeout(() => {
			isCopied = false;
		}, 2000);
	};
</script>

<div
	class="bg-bg text- relative overflow-hidden rounded-lg shadow-lg"
	data-theme="dark"
>
	<div class="bg-bg-dark flex items-center justify-between p-3">
		{#if header}
			<div class="text-lg font-bold">{header}</div>
		{/if}
		<button class="btn" onclick={copyToClipboard} disabled={isCopied}>
			{#if isCopied}
				Copied!
			{:else}
				<Icon icon="solar:copy-linear" class="h-6 w-6" />
			{/if}
		</button>
	</div>
	<pre class="p-3"><code class="language-{language}">{@html codeHTML}</code></pre>
</div>
