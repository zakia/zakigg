<script lang="ts">
	import type { Editor } from '@tiptap/core';
	import Icon from '$lib/components/Icon.svelte';
	import {
		deleteBlock,
		duplicateBlock,
		insertParagraphBelow,
		lockBlockHandle,
		openBlockEditMode,
		turnBlockInto,
		unlockBlockHandle,
		type BlockHandleTarget
	} from '$lib/editor/block-handle';
	import { BLOCK_TURN_TARGETS, type BlockTurnTarget } from '$lib/editor/blocks';

	type Props = {
		editor?: Editor;
		target: BlockHandleTarget | null;
		// Hands the handle's root element to the editor so the drag-handle
		// extension can position it and bind native drag to it.
		onElement?: (element?: HTMLElement) => void;
	};

	let { editor, target, onElement }: Props = $props();
	let root = $state<HTMLElement>();
	let menuOpen = $state(false);
	// While the menu is open the drag-handle is locked in place, so freeze the
	// block it points at too — pointer moves must not re-target it.
	let pinnedTarget = $state<BlockHandleTarget | null>(null);

	const active = $derived(menuOpen ? pinnedTarget : target);

	$effect(() => {
		onElement?.(root);

		return () => onElement?.(undefined);
	});

	function openMenu() {
		if (!target || !editor) return;

		pinnedTarget = target;
		menuOpen = true;
		lockBlockHandle(editor);
	}

	function closeMenu() {
		if (!menuOpen) return;

		menuOpen = false;
		pinnedTarget = null;
		if (editor) unlockBlockHandle(editor);
	}

	function runAction(action: (editor: Editor, pos: number) => void) {
		if (!editor || !pinnedTarget) return;

		action(editor, pinnedTarget.pos);
		closeMenu();
	}

	function runTurnInto(turnTarget: BlockTurnTarget) {
		if (!editor || !pinnedTarget) return;

		turnBlockInto(editor, pinnedTarget.pos, turnTarget);
		closeMenu();
	}

	function handleWindowPointerDown(event: PointerEvent) {
		if (!menuOpen) return;

		const targetElement = event.target as Element | null;

		if (targetElement?.closest('[data-block-handle-ui]')) return;

		closeMenu();
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (!menuOpen || event.key !== 'Escape') return;

		event.preventDefault();
		closeMenu();
	}
</script>

<svelte:window onpointerdown={handleWindowPointerDown} onkeydown={handleWindowKeydown} />

<!-- Always rendered: the drag-handle extension holds a reference to this
     element and toggles its visibility; it must not be conditionally removed. -->
<div class="block-handle" bind:this={root} data-block-handle-ui>
	{#if active}
		<span class="handle-chip" title={active.label} aria-hidden="true">
			<Icon icon={active.icon} />
		</span>
		<button
			type="button"
			class="handle-grip"
			class:active={menuOpen}
			title={`${active.label} — drag to move, click for options`}
			aria-label={`${active.label} block options`}
			onclick={() => (menuOpen ? closeMenu() : openMenu())}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true">
				<circle cx="5" cy="3" r="1.3" />
				<circle cx="11" cy="3" r="1.3" />
				<circle cx="5" cy="8" r="1.3" />
				<circle cx="11" cy="8" r="1.3" />
				<circle cx="5" cy="13" r="1.3" />
				<circle cx="11" cy="13" r="1.3" />
			</svg>
		</button>

		{#if menuOpen && pinnedTarget}
			<!-- draggable=false so interacting with the menu never starts a drag
			     from the (draggable) handle root. -->
			<div
				class="handle-menu"
				role="menu"
				draggable="false"
				aria-label={`${pinnedTarget.label} options`}
			>
				<div class="menu-header">
					<Icon icon={pinnedTarget.icon} />
					<span>{pinnedTarget.label}</span>
				</div>

				{#if pinnedTarget.turnable}
					<div class="menu-turn-row" role="group" aria-label="Turn into">
						{#each BLOCK_TURN_TARGETS as turn (turn.id)}
							<button
								type="button"
								class="turn-button"
								role="menuitem"
								title={turn.label}
								aria-label={`Turn into ${turn.label}`}
								onclick={() => runTurnInto(turn.id)}
							>
								<Icon icon={turn.icon} />
							</button>
						{/each}
					</div>
				{/if}

				{#if pinnedTarget.editLabel}
					<button
						type="button"
						class="menu-item"
						role="menuitem"
						onclick={() => runAction(openBlockEditMode)}
					>
						<Icon icon="mdi:pencil-outline" />
						{pinnedTarget.editLabel}
					</button>
				{/if}

				<button
					type="button"
					class="menu-item"
					role="menuitem"
					onclick={() => runAction(duplicateBlock)}
				>
					<Icon icon="mdi:content-duplicate" />
					Duplicate
				</button>
				<button
					type="button"
					class="menu-item"
					role="menuitem"
					onclick={() => runAction(insertParagraphBelow)}
				>
					<Icon icon="mdi:plus-box-outline" />
					Insert below
				</button>
				<button
					type="button"
					class="menu-item danger"
					role="menuitem"
					onclick={() => runAction(deleteBlock)}
				>
					<Icon icon="mdi:trash-can-outline" />
					Delete
				</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.block-handle {
		align-items: center;
		display: flex;
		gap: 2px;
		/* position/left/top and visibility are written by the drag-handle
		   extension (floating-ui). Before the first hover `target` is null, so
		   the element renders empty (zero-size) and nothing shows. */
		position: absolute;
		top: 0;
		left: 0;
		z-index: 7;
	}

	/* Keep pointer continuity across floating-ui's gutter offset. Without this
	   bridge, leaving the editor for the small gap hides the handle before the
	   pointer can reach it. */
	.block-handle::after {
		content: '';
		inset-block: -0.2rem;
		position: absolute;
		right: -0.5rem;
		width: 0.65rem;
	}

	.handle-chip,
	.handle-grip {
		align-items: center;
		border-radius: var(--s-5);
		color: color-mix(in oklch, var(--content-1) 78%, transparent);
		display: flex;
		height: 1.6rem;
		justify-content: center;
	}

	.handle-chip {
		background: color-mix(in oklch, var(--base-1) 88%, transparent);
		border: 1px solid color-mix(in oklch, var(--edge) 62%, transparent);
		width: 1.6rem;
	}

	.handle-chip :global(svg) {
		height: 0.95rem;
		width: 0.95rem;
	}

	.handle-grip {
		appearance: none;
		background: transparent;
		border: 0;
		cursor: grab;
		padding: 0;
		transition:
			background-color 0.14s ease,
			color 0.14s ease;
		width: 1.15rem;
	}

	/* data-dragging is set on the root by the drag-handle extension, so the
	   attribute selector must be global for Svelte not to prune it. */
	:global(.block-handle[data-dragging='true']) .handle-grip {
		cursor: grabbing;
	}

	.handle-grip:hover,
	.handle-grip:focus-visible,
	.handle-grip.active {
		background: color-mix(in oklch, var(--content) 9%, transparent);
		color: var(--content);
		outline: none;
	}

	.handle-grip svg {
		fill: currentColor;
		height: 1rem;
		width: 0.9rem;
	}

	.handle-menu {
		background: var(--base-1);
		border: 1px solid color-mix(in oklch, var(--edge) 78%, transparent);
		border-radius: var(--s-3);
		box-shadow: 0 1rem 2.4rem color-mix(in oklch, black 18%, transparent);
		display: grid;
		gap: var(--s-5);
		left: 0;
		min-width: 13rem;
		padding: var(--s-4);
		position: absolute;
		top: calc(100% + var(--s-4));
	}

	.menu-header {
		align-items: center;
		border-bottom: 1px solid color-mix(in oklch, var(--edge) 55%, transparent);
		color: var(--content-1);
		display: flex;
		font-size: var(--s-2);
		font-weight: 700;
		gap: var(--s-4);
		padding: var(--s-4) var(--s-3) var(--s-3);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.menu-header :global(svg) {
		height: 0.95rem;
		width: 0.95rem;
	}

	.menu-turn-row {
		border-bottom: 1px solid color-mix(in oklch, var(--edge) 55%, transparent);
		display: flex;
		gap: var(--s-5);
		padding: var(--s-4) var(--s-5);
	}

	.turn-button,
	.menu-item {
		appearance: none;
		background: transparent;
		border: 0;
		border-radius: var(--s-5);
		color: var(--content);
		cursor: pointer;
		font: inherit;
		transition:
			background-color 0.14s ease,
			color 0.14s ease;
	}

	.turn-button {
		align-items: center;
		display: grid;
		height: 1.9rem;
		place-items: center;
		width: 1.9rem;
	}

	.turn-button :global(svg) {
		height: 1.1rem;
		width: 1.1rem;
	}

	.menu-item {
		align-items: center;
		display: flex;
		font-size: var(--s-1);
		gap: var(--s-3);
		min-height: 2rem;
		padding: 0 var(--s-3);
		text-align: start;
	}

	.menu-item :global(svg) {
		color: var(--content-1);
		height: 1.05rem;
		width: 1.05rem;
	}

	.turn-button:hover,
	.turn-button:focus-visible,
	.menu-item:hover,
	.menu-item:focus-visible {
		background: color-mix(in oklch, var(--content) 7%, transparent);
		outline: none;
	}

	.menu-item.danger:hover,
	.menu-item.danger:focus-visible {
		background: color-mix(in oklch, var(--error) 11%, transparent);
		color: var(--error);
	}

	.menu-item.danger:hover :global(svg) {
		color: var(--error);
	}
</style>
