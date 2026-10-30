<script lang="ts">
	import type { ComponentEmbedRegistry } from './registry';
	let { attrs, registry }: { attrs: unknown; registry: ComponentEmbedRegistry } = $props();
	const embed = $derived(registry.parseAttrs(attrs));
</script>

<svelte:boundary>
	{#if embed.ok}
		{@const Loaded = await registry.resolveComponent(embed.entry.id)}
		<Loaded {...embed.props} />
	{:else}
		<p class="component-embed-error" role="note">{embed.message}</p>
	{/if}
	{#snippet failed(error, reset)}
		<div class="component-embed-error" role="note">
			<p>{error instanceof Error ? error.message : 'Embed preview unavailable.'}</p>
			<button type="button" onclick={reset}>Retry preview</button>
		</div>
	{/snippet}
</svelte:boundary>

<style>
	.component-embed-error {
		background: color-mix(in oklch, var(--error, crimson) 9%, transparent);
		border: 1px solid color-mix(in oklch, var(--error, crimson) 34%, transparent);
		border-radius: var(--s-3);
		padding: var(--s-1);
		color: var(--content-1);
		overflow-wrap: anywhere;
	}
	.component-embed-error button {
		cursor: pointer;
		text-decoration: underline;
	}
</style>
