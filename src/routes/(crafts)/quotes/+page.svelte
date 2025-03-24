<script module>
	import Layout from '$lib/Layout.svelte';
	import Icon from '@iconify/svelte';

	export const metadata = {
		title: 'Quotes',
		description: 'A collection of quotes',
		date: '2025-02-18',
		draft: false,
		tags: ['quotes']
	};
</script>

<script lang="ts">
	import { quotes } from './quotes';
	import { fade } from 'svelte/transition';

	const shuffledQuotes = quotes.sort(() => Math.random() - 0.5);
	let quoteIndex = $state(0);
</script>

<svelte:window
	onkeydown={(e) => {
		e.preventDefault();
		e.stopPropagation();
		if (e.key === ' ') {
			quoteIndex = (quoteIndex + 1) % shuffledQuotes.length;
		}
	}}
/>

<Layout {...metadata}>
	{#key quoteIndex}
		<div class="flex min-h-80 items-center justify-center gap-2" in:fade={{ duration: 500 }}>
			<div class="text-content-0 text-center text-lg font-medium text-balance">
				{shuffledQuotes[quoteIndex]}
			</div>
		</div>
	{/key}
	<button
		class="btn flex-col justify-self-center"
		onclick={() => (quoteIndex = (quoteIndex + 1) % shuffledQuotes.length)}
	>
		<Icon icon="mdi:refresh" class="h-8 w-8" />

		<div>
			Press <kbd>Space</kbd>
		</div>
	</button>
</Layout>
