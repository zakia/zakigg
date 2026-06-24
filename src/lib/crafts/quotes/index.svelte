<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
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

{#key quoteIndex}
	<div class="gap-s-2 flex min-h-80 items-center justify-center" in:fade={{ duration: 500 }}>
		<div class="text-content text-s1 text-center font-medium text-balance">
			{shuffledQuotes[quoteIndex]}
		</div>
	</div>
{/key}
<button
	class="btn flex-col text-center"
	onclick={() => (quoteIndex = (quoteIndex + 1) % shuffledQuotes.length)}
>
	<Icon icon="mdi:refresh" class="h-8 w-8" />

	<div>
		Press <kbd>Space</kbd>
	</div>
</button>
