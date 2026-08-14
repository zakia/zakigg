<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';

	let {
		href,
		label = 'Back',
		onclick
	}: {
		href: string;
		label?: string;
		onclick?: (event: MouseEvent) => void;
	} = $props();
</script>

<a class="craft-back-link" {href} {onclick}>
	<Icon icon="ep:top-left" />
	<span>{label}</span>
</a>

<style>
	.craft-back-link {
		align-items: center;
		color: var(--brand);
		display: inline-flex;
		font-weight: 500;
		gap: var(--s-2);
		justify-content: center;
		padding: 0;
		text-decoration: none;
		transition:
			color 0.2s ease,
			transform 0.3s ease;
		width: fit-content;
	}

	.craft-back-link:hover {
		transform: translateY(-2px);
	}

	.craft-back-link:focus-visible {
		border-radius: var(--s-4);
		box-shadow: var(--focus-ring);
		outline: none;
	}

	.craft-back-link :global(svg) {
		flex: 0 0 auto;
	}
</style>
