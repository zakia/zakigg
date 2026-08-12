<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { quotes } from '$lib/crafts/quotes/quotes';
	import { fade } from 'svelte/transition';

	let quoteIndex = $state(Math.floor(Math.random() * quotes.length));

	function nextQuote() {
		quoteIndex = (quoteIndex + 1 + Math.floor(Math.random() * (quotes.length - 1))) % quotes.length;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== ' ' || isTypingTarget(event.target)) return;

		event.preventDefault();
		nextQuote();
	}

	function isTypingTarget(target: EventTarget | null) {
		return (
			target instanceof HTMLElement &&
			(Boolean(target.closest('input, textarea, select')) || target.isContentEditable)
		);
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<section class="quote-shuffle" aria-live="polite">
	{#key quoteIndex}
		<blockquote in:fade={{ duration: 280 }}>{quotes[quoteIndex]}</blockquote>
	{/key}
	<button type="button" onclick={nextQuote}>
		<Icon icon="mdi:refresh" />
		<span>Another quote</span>
		<kbd>Space</kbd>
	</button>
</section>

<style>
	.quote-shuffle {
		align-items: center;
		display: grid;
		gap: var(--s1);
		justify-items: center;
		margin-block: var(--s1);
		min-height: 20rem;
		padding: var(--s1);
	}

	blockquote {
		border: 0;
		color: var(--content);
		font-size: clamp(1.25rem, 3vw, 1.8rem);
		font-style: normal;
		font-weight: 560;
		line-height: 1.35;
		margin: 0;
		max-width: 34rem;
		padding: 0;
		text-align: center;
		text-wrap: balance;
	}

	button {
		align-items: center;
		background: transparent;
		border: 0;
		border-radius: 999px;
		color: var(--content-1);
		display: inline-flex;
		font: inherit;
		font-size: var(--s-1);
		gap: var(--s-2);
		padding: var(--s-2) var(--s0);
	}

	button:hover,
	button:focus-visible {
		background: color-mix(in oklch, var(--brand) 9%, transparent);
		color: var(--content);
		outline: none;
	}

	button :global(svg) {
		height: 1rem;
		width: 1rem;
	}

	kbd {
		border: 1px solid var(--edge);
		border-radius: var(--s-4);
		font-size: var(--s-2);
		padding: 0.1rem 0.35rem;
	}
</style>
