<script lang="ts">
	import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
	import type { Readable } from 'svelte/store';
	import type { ComponentEmbedRegistry, EmbedComponent } from './registry';

	type UpdateResult = { ok: true } | { ok: false; message: string };

	type Props = {
		node: Readable<ProseMirrorNode>;
		registry: ComponentEmbedRegistry;
		updateProps: (props: Record<string, unknown>) => UpdateResult;
	};

	let { node, registry, updateProps }: Props = $props();
	let updateError = $state('');
	let LoadedComponent = $state<EmbedComponent | null>(null);
	let loadError = $state('');

	const embed = $derived(registry.parseAttrs($node.attrs));
	// Track by id so prop edits don't re-trigger resolution.
	const embedId = $derived(embed.ok ? embed.entry.id : '');

	$effect(() => {
		if (!embedId) {
			LoadedComponent = null;
			return;
		}

		let cancelled = false;

		LoadedComponent = null;
		loadError = '';
		registry.resolveComponent(embedId).then(
			(component) => {
				if (!cancelled) LoadedComponent = component;
			},
			(error: unknown) => {
				if (!cancelled) loadError = error instanceof Error ? error.message : 'Failed to load.';
			}
		);

		return () => {
			cancelled = true;
		};
	});

	// Components persist their own state changes through this callback;
	// everything is validated against the embed's schema before it reaches
	// the document.
	function handlePropsChange(nextProps: Record<string, unknown>) {
		if (!embed.ok) return;

		const parsed = registry.parseProps(embed.entry.id, nextProps);

		if (!parsed.ok) {
			updateError = parsed.message;
			return;
		}

		const result = updateProps(parsed.props);
		updateError = result.ok ? '' : result.message;
	}
</script>

<div class="component-embed-shell" data-component-embed-controls>
	{#if embed.ok}
		{#if LoadedComponent}
			<LoadedComponent {...embed.props} updateProps={handlePropsChange} />
		{:else if loadError}
			<div class="component-embed-missing">
				<span>Component failed to load</span>
				<small>{loadError}</small>
			</div>
		{:else}
			<span class="component-embed-loading" aria-busy="true">Loading {embed.entry.label}…</span>
		{/if}

		{#if updateError}
			<p class="component-embed-error">{updateError}</p>
		{/if}
	{:else}
		<div class="component-embed-missing">
			<span>Component unavailable</span>
			<small>{embed.message}</small>
		</div>
	{/if}
</div>

<style>
	.component-embed-shell {
		display: inline-grid;
		margin-block: var(--s-3);
		max-width: 100%;
		vertical-align: middle;
		width: fit-content;
	}

	.component-embed-loading {
		color: color-mix(in oklch, var(--content-1) 78%, transparent);
		font-size: var(--s-1);
	}

	.component-embed-error,
	.component-embed-missing {
		color: var(--error);
		font-size: var(--s-1);
		margin: 0;
	}

	.component-embed-missing {
		display: grid;
		gap: var(--s-5);
	}

	.component-embed-missing small {
		color: var(--content-1);
	}
</style>
