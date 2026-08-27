<script lang="ts">
	import type { ComponentEmbedRegistry, EmbedComponent } from '$lib/editor/components/registry';
	import type { ComponentEmbedViewState } from './component-embed-state.svelte';

	let {
		viewState,
		registry,
		onUpdateProps
	}: {
		viewState: ComponentEmbedViewState;
		registry: ComponentEmbedRegistry;
		onUpdateProps: (props: Record<string, unknown>) => void;
	} = $props();
	let LoadedComponent = $state<EmbedComponent | null>(null);
	let loadError = $state('');
	let updateError = $state('');
	const embed = $derived(registry.parseAttrs(viewState.attrs));
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

	function updateProps(props: Record<string, unknown>) {
		if (!embed.ok) return;
		const parsed = registry.parseProps(embed.entry.id, props);
		if (!parsed.ok) {
			updateError = parsed.message;
			return;
		}

		updateError = '';
		onUpdateProps(parsed.props);
	}
</script>

<div class="component-embed-shell" contenteditable="false">
	{#if embed.ok}
		{#if embed.entry.editLabel}
			<button
				type="button"
				class:active={viewState.editing}
				onclick={() => (viewState.editing = !viewState.editing)}
			>
				{viewState.editing ? 'Done' : embed.entry.editLabel}
			</button>
		{/if}
		{#if LoadedComponent}
			<LoadedComponent
				{...embed.props}
				{updateProps}
				editing={viewState.editing}
				setEditing={(editing: boolean) => (viewState.editing = editing)}
			/>
		{:else if loadError}
			<p class="error">Component failed to load: {loadError}</p>
		{:else}
			<p class="loading" aria-busy="true">Loading {embed.entry.label}…</p>
		{/if}
		{#if updateError}<p class="error">{updateError}</p>{/if}
	{:else}
		<div class="missing" role="note">
			<strong>Component unavailable</strong>
			<span>{embed.message}</span>
		</div>
	{/if}
</div>

<style>
	.component-embed-shell {
		display: grid;
		margin-block: var(--s0);
		min-width: 0;
		position: relative;
		width: 100%;
	}

	button {
		background: color-mix(in oklch, var(--base-1) 92%, transparent);
		border: 1px solid var(--edge);
		border-radius: var(--s-3);
		color: var(--content-1);
		cursor: pointer;
		font: inherit;
		font-size: var(--s-2);
		opacity: 0;
		padding: var(--s-4) var(--s-2);
		position: absolute;
		right: var(--s-2);
		top: var(--s-2);
		transition: opacity 0.15s ease;
		z-index: 2;
	}

	.component-embed-shell:hover button,
	button:focus-visible,
	button.active {
		opacity: 1;
	}

	p {
		margin: 0;
	}

	.loading {
		color: var(--content-1);
	}

	.error,
	.missing {
		color: var(--error);
		font-size: var(--s-1);
	}

	.missing {
		background: color-mix(in oklch, var(--error) 8%, var(--base-1));
		border: 1px solid color-mix(in oklch, var(--error) 32%, var(--edge));
		border-radius: var(--s-3);
		display: grid;
		gap: var(--s-5);
		padding: var(--s-1);
	}

	.missing span {
		color: var(--content-1);
	}
</style>
