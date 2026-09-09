<script lang="ts">
	import type { SlashMenuState } from './slash-menu-state.svelte';
	import { filterSlashMenuItems } from './slash-menu-filter';

	export type SlashMenuItem = {
		key: string;
		label: string;
		description: string;
		group: 'Text' | 'List' | 'Advanced' | 'Components';
		keywords: string[];
	};

	let {
		viewState,
		items,
		onRun,
		onHide
	}: {
		viewState: SlashMenuState;
		items: SlashMenuItem[];
		onRun: (key: string) => void;
		onHide: () => void;
	} = $props();

	let activeIndex = $derived(Math.min(0, viewState.filter.length));
	let listRoot = $state<HTMLElement>();
	const filteredItems = $derived.by(() => {
		return filterSlashMenuItems(items, viewState.filter);
	});
	const groupedItems = $derived.by(() => {
		const groupOrder: SlashMenuItem['group'][] = ['Text', 'List', 'Advanced', 'Components'];
		return groupOrder
			.map((group) => [group, filteredItems.filter((item) => item.group === group)] as const)
			.filter(([, groupItems]) => groupItems.length > 0);
	});

	$effect(() => {
		if (!viewState.visible) return;
		const handleKeydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				onHide();
				return;
			}
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				activeIndex = Math.min(activeIndex + 1, Math.max(0, filteredItems.length - 1));
			}
			if (event.key === 'ArrowUp') {
				event.preventDefault();
				activeIndex = Math.max(0, activeIndex - 1);
			}
			if (event.key === 'Enter' && filteredItems[activeIndex]) {
				event.preventDefault();
				onRun(filteredItems[activeIndex].key);
			}
			if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
				requestAnimationFrame(() => {
					listRoot
						?.querySelector<HTMLElement>(`[data-menu-index="${activeIndex}"]`)
						?.scrollIntoView({ block: 'nearest' });
				});
			}
		};
		window.addEventListener('keydown', handleKeydown, { capture: true });
		return () => window.removeEventListener('keydown', handleKeydown, { capture: true });
	});
</script>

<div class="slash-surface" bind:this={listRoot} onpointerdown={(event) => event.preventDefault()}>
	{#if filteredItems.length}
		{#each groupedItems as [group, groupItems] (group)}
			<section>
				<h2>{group}</h2>
				{#each groupItems as item (item.key)}
					{@const index = filteredItems.indexOf(item)}
					<button
						type="button"
						class:active={index === activeIndex}
						data-menu-index={index}
						onpointerenter={() => (activeIndex = index)}
						onpointerup={() => onRun(item.key)}
					>
						<span>{item.label}</span>
						<small>{item.description}</small>
					</button>
				{/each}
			</section>
		{/each}
	{:else}
		<p>No matching blocks</p>
	{/if}
</div>

<style>
	.slash-surface {
		background: var(--base-1);
		border: 1px solid var(--edge-1);
		border-radius: var(--radius);
		box-shadow: 0 0.85rem 2.4rem rgb(0 0 0 / 0.15);
		max-height: min(28rem, 60vh);
		min-width: min(22rem, calc(100vw - 2rem));
		overflow-y: auto;
		padding: 0.45rem;
	}

	section + section {
		border-top: 1px solid var(--edge-1);
		margin-top: 0.4rem;
		padding-top: 0.4rem;
	}

	h2 {
		color: var(--content-1);
		font: 700 0.68rem/1 var(--font-body);
		letter-spacing: 0.09em;
		margin: 0;
		padding: 0.5rem 0.6rem 0.35rem;
		text-transform: uppercase;
	}

	button {
		background: transparent;
		border: 0;
		border-radius: calc(var(--radius) * 0.7);
		color: var(--content);
		cursor: pointer;
		display: grid;
		font-family: var(--font-body);
		gap: 0.15rem;
		padding: 0.55rem 0.65rem;
		text-align: left;
		width: 100%;
	}

	button.active {
		background: color-mix(in oklch, var(--brand) 12%, var(--base-1));
	}

	button span {
		font-size: 0.88rem;
		font-weight: 700;
	}

	button small,
	p {
		color: var(--content-1);
		font-size: 0.75rem;
	}

	p {
		margin: 0;
		padding: 0.8rem;
	}
</style>
