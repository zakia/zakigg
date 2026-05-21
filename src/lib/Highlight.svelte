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

<div class="bg-base relative overflow-hidden rounded-md shadow-lg" data-theme="dark">
	<div class="bg-base-2 p-s-1 flex items-center justify-between">
		{#if header}
			<div class="text-s0 font-bold">{header}</div>
		{/if}
		<button class="btn" onclick={copyToClipboard} disabled={isCopied}>
			{#if isCopied}
				Copied!
			{:else}
				<Icon icon="solar:copy-linear" class="h-6 w-6" />
			{/if}
		</button>
	</div>
	<pre class="p-s-1"><code class="language-{language}">{@html codeHTML}</code></pre>
</div>
