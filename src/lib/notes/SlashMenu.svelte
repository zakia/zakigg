<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import type { BlockPaletteItem } from '$lib/editor/blocks';

	let {
		visible,
		items,
		activeIndex,
		left,
		top,
		onSelect
	}: {
		visible: boolean;
		items: BlockPaletteItem[];
		activeIndex: number;
		left: number;
		top: number;
		onSelect: (id: string) => void;
	} = $props();
</script>

{#if visible && items.length}
	<div
		class="slash-menu"
		role="listbox"
		aria-label="Insert block"
		style={`--slash-left: ${left}px; --slash-top: ${top}px;`}
		onpointerdown={(event) => event.preventDefault()}
	>
		<header>
			<span>Insert</span>
			<kbd>/</kbd>
		</header>
		<div class="slash-options">
			{#each items as item, index (item.id)}
				<button
					type="button"
					role="option"
					aria-selected={index === activeIndex}
					class:active={index === activeIndex}
					onclick={() => onSelect(item.id)}
				>
					<span class="item-icon"><Icon icon={item.icon} /></span>
					<span class="item-copy">
						<strong>{item.label}</strong>
						<small>{item.description}</small>
					</span>
				</button>
			{/each}
		</div>
	</div>
{/if}

<style>
	.slash-menu {
		background: color-mix(in oklch, var(--base-1) 94%, transparent);
		border: 1px solid color-mix(in oklch, var(--edge) 76%, transparent);
		border-radius: var(--s-3);
		box-shadow: 0 1.2rem 3rem rgb(0 0 0 / 0.16);
		left: clamp(var(--s-2), var(--slash-left), calc(100vw - min(21rem, 94vw) - var(--s-2)));
		max-height: min(24rem, calc(100dvh - var(--slash-top) - var(--s0)));
		overflow: hidden;
		position: fixed;
		top: var(--slash-top);
		width: min(21rem, 94vw);
		z-index: 12;
	}

	header {
		align-items: center;
		color: var(--content-1);
		display: flex;
		font-size: var(--s-2);
		font-weight: 720;
		justify-content: space-between;
		padding: var(--s-3) var(--s-1);
		text-transform: uppercase;
	}

	kbd {
		background: var(--base-2);
		border: 1px solid var(--edge);
		border-radius: var(--s-5);
		font: inherit;
		padding: 0.08rem 0.35rem;
	}

	.slash-options {
		display: grid;
		overflow-y: auto;
		padding: 0 var(--s-4) var(--s-4);
	}

	button {
		align-items: center;
		appearance: none;
		background: transparent;
		border: 0;
		border-radius: var(--s-4);
		color: var(--content);
		cursor: pointer;
		display: flex;
		font: inherit;
		gap: var(--s-2);
		min-width: 0;
		padding: var(--s-3);
		text-align: left;
		width: 100%;
	}

	button:hover,
	button.active {
		background: color-mix(in oklch, var(--brand) 13%, transparent);
	}

	.item-icon {
		align-items: center;
		background: var(--base-2);
		border: 1px solid var(--edge);
		border-radius: var(--s-4);
		display: flex;
		flex: 0 0 auto;
		height: 2.2rem;
		justify-content: center;
		width: 2.2rem;
	}

	.item-icon :global(svg) {
		height: 1.15rem;
		width: 1.15rem;
	}

	.item-copy {
		display: grid;
		min-width: 0;
	}

	strong,
	small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	strong {
		font-size: var(--s-1);
	}

	small {
		color: var(--content-1);
		font-size: var(--s-2);
	}
</style>
