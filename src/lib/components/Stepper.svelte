<script lang="ts">
	import { type Snippet } from 'svelte';
	import { tick } from 'svelte';

	interface Props {
		children: Snippet;
		title?: string;
	}

	let { children, title }: Props = $props();

	let container = $state<HTMLDivElement>();
	let current = $state(0);
	let total = $state(0);

	$effect(() => {
		if (!container) return;
		void current;
		tick().then(() => {
			const steps = Array.from(
				container!.querySelectorAll(':scope > .preview-block')
			) as HTMLElement[];
			total = steps.length;
			steps.forEach((step, i) => {
				step.hidden = i !== current;
			});
		});
	});

	function prev() {
		current = Math.max(0, current - 1);
	}

	function next() {
		current = Math.min(total - 1, current + 1);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') prev();
		else if (e.key === 'ArrowRight') next();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="stepper">
	{#if title}
		<h1 class="stepper-title">{title}</h1>
	{/if}

	<div bind:this={container} class="stepper-content">
		{@render children()}
	</div>

	<nav class="stepper-nav">
		<button class="btn variant-ghost" disabled={current === 0} onclick={prev}> ← Prev </button>
		<span class="stepper-counter">
			{current + 1} / {total}
		</span>
		<button class="btn variant-ghost" disabled={current >= total - 1} onclick={next}>
			Next →
		</button>
	</nav>
</div>

<style>
	.stepper {
		display: flex;
		flex-direction: column;
		gap: var(--s0);
	}

	.stepper-title {
		font-size: var(--s3);
		font-weight: 700;
	}

	.stepper-nav {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--s1);
	}

	.stepper-counter {
		font-family: var(--font-mono);
		font-size: var(--s-1);
		color: var(--content-1);
		min-width: 4ch;
		text-align: center;
	}
</style>
