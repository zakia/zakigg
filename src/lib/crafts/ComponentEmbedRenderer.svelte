<script lang="ts">
	import type { EmbedComponent } from '$lib/editor/component-embeds';
	import { componentEmbeds } from '$lib/embeds';

	let { attrs }: { attrs: unknown } = $props();
	let LoadedComponent = $state<EmbedComponent | null>(null);

	const embed = $derived(componentEmbeds.parseAttrs(attrs));
	const embedId = $derived(embed.ok ? embed.entry.id : '');

	$effect(() => {
		if (!embedId) {
			LoadedComponent = null;
			return;
		}

		let cancelled = false;

		componentEmbeds.resolveComponent(embedId).then((component) => {
			if (!cancelled) LoadedComponent = component;
		});

		return () => {
			cancelled = true;
		};
	});
</script>

<div class="component-embed-frame" data-component-embed-frame>
	{#if embed.ok}
		{#if LoadedComponent}
			<LoadedComponent {...embed.props} />
		{/if}
	{:else}
		<div class="component-embed-error" role="note">
			<strong>Component embed unavailable</strong>
			<span>{embed.message}</span>
		</div>
	{/if}
</div>

<style>
	.component-embed-frame {
		min-width: 0;
		width: 100%;
	}

	.component-embed-error {
		background: color-mix(in oklch, var(--error, crimson) 9%, transparent);
		border: 1px solid color-mix(in oklch, var(--error, crimson) 34%, transparent);
		border-radius: var(--s-3);
		color: var(--content);
		display: grid;
		gap: var(--s-5);
		margin: 0;
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
