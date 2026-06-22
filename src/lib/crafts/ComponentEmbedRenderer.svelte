<script lang="ts">
	import { craftComponentEmbeds } from './component-embeds';

	let { attrs }: { attrs: unknown } = $props();

	const embed = $derived(craftComponentEmbeds.parseAttrs(attrs));
</script>

{#if embed.ok}
	{@const Component = embed.entry.component}
	<Component {...embed.props} />
{:else}
	<div class="component-embed-error" role="note">
		<strong>Component embed unavailable</strong>
		<span>{embed.message}</span>
	</div>
{/if}

<style>
	.component-embed-error {
		background: color-mix(in oklch, var(--error, crimson) 9%, transparent);
		border: 1px solid color-mix(in oklch, var(--error, crimson) 34%, transparent);
		border-radius: var(--s-3);
		color: var(--content);
		display: grid;
		gap: var(--s-5);
		margin-block: var(--s0);
		padding: var(--s-1);
	}

	.component-embed-error strong {
		font-size: var(--s-1);
	}

	.component-embed-error span {
		color: var(--content-1);
		font-size: var(--s-1);
	}
</style>
