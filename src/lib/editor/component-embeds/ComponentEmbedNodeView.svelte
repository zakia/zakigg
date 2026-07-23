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
	<span
		class="embed-drag-handle"
		data-embed-drag-handle
		draggable="true"
		role="button"
		tabindex={-1}
		aria-label="Drag to move"
		title="Drag to move"
	>
		<svg viewBox="0 0 16 16" aria-hidden="true">
			<circle cx="5" cy="3" r="1.3" />
			<circle cx="11" cy="3" r="1.3" />
			<circle cx="5" cy="8" r="1.3" />
			<circle cx="11" cy="8" r="1.3" />
			<circle cx="5" cy="13" r="1.3" />
			<circle cx="11" cy="13" r="1.3" />
		</svg>
	</span>

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
		position: relative;
		vertical-align: middle;
		width: fit-content;
	}

	.embed-drag-handle {
		align-items: center;
		border-radius: var(--s-5);
		color: color-mix(in oklch, var(--content-1) 72%, transparent);
		cursor: grab;
		display: flex;
		height: 1.9rem;
		justify-content: center;
		left: -1.7rem;
		opacity: 0;
		position: absolute;
		top: 0.15rem;
		transition:
			background-color 0.16s ease,
			color 0.16s ease,
			opacity 0.16s ease;
		user-select: none;
		width: 1.4rem;
	}

	.embed-drag-handle:active {
		cursor: grabbing;
	}

	.component-embed-shell:hover .embed-drag-handle {
		opacity: 1;
	}

	.embed-drag-handle:hover {
		background: color-mix(in oklch, var(--content) 8%, transparent);
		color: var(--content);
	}

	.embed-drag-handle svg {
		fill: currentColor;
		height: 1rem;
		width: 1rem;
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
