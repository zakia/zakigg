<script lang="ts">
	import type { Editor } from '@tiptap/core';
	import Icon from '$lib/components/Icon.svelte';
	import {
		deleteBlock,
		duplicateBlock,
		insertParagraphBelow,
		startBlockDrag,
		turnBlockInto,
		type BlockHandleTarget,
		type BlockTurnTarget
	} from '$lib/editor/block-handle';

	type Props = {
		editor?: Editor;
		target: BlockHandleTarget | null;
	};

	let { editor, target }: Props = $props();
	let menuOpen = $state(false);
	// The menu pins the handle to the block it opened on, so pointer moves
	// while choosing an action don't re-target it.
	let pinnedTarget = $state<BlockHandleTarget | null>(null);

	const active = $derived(menuOpen ? pinnedTarget : target);
	// Content-space coordinates: the handle is absolutely positioned inside
	// the editor surface, so it scrolls with the document natively.
	const handleStyle = $derived(
		active
			? `left: ${Math.max(4, active.position.left - 52)}px; top: ${active.position.top + 1}px;`
			: ''
	);

	const TURN_TARGETS: { id: BlockTurnTarget; label: string; icon: string }[] = [
		{ id: 'text', label: 'Text', icon: 'mdi:format-text' },
		{ id: 'heading-1', label: 'Heading 1', icon: 'mdi:format-header-1' },
		{ id: 'heading-2', label: 'Heading 2', icon: 'mdi:format-header-2' },
		{ id: 'heading-3', label: 'Heading 3', icon: 'mdi:format-header-3' },
		{ id: 'bullet-list', label: 'Bullet list', icon: 'mdi:format-list-bulleted' },
		{ id: 'ordered-list', label: 'Numbered list', icon: 'mdi:format-list-numbered' },
		{ id: 'quote', label: 'Quote', icon: 'mdi:format-quote-close' },
		{ id: 'code', label: 'Code', icon: 'mdi:code-tags' }
	];

	function openMenu() {
		if (!active) return;

		pinnedTarget = active;
		menuOpen = true;
	}

	function closeMenu() {
		menuOpen = false;
		pinnedTarget = null;
	}

	function handleDragStart(event: DragEvent) {
		if (!editor || !active) return;

		closeMenu();

		if (!startBlockDrag(editor, active.pos, event)) event.preventDefault();
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

{#if active}
	<div class="block-handle" data-block-handle-ui style={handleStyle}>
		<span class="handle-chip" title={active.label} aria-hidden="true">
			<Icon icon={active.icon} />
		</span>
		<button
			type="button"
			class="handle-grip"
			class:active={menuOpen}
			draggable="true"
			title={`${active.label} — drag to move, click for options`}
			aria-label={`${active.label} block options`}
			ondragstart={handleDragStart}
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
			<div class="handle-menu" role="menu" aria-label={`${pinnedTarget.label} options`}>
				<div class="menu-header">
					<Icon icon={pinnedTarget.icon} />
					<span>{pinnedTarget.label}</span>
				</div>

				{#if pinnedTarget.turnable}
					<div class="menu-turn-row" role="group" aria-label="Turn into">
						{#each TURN_TARGETS as turn (turn.id)}
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
	</div>
{/if}

<style>
	.block-handle {
		align-items: center;
		display: flex;
		gap: 2px;
		position: absolute;
		z-index: 7;
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

	.handle-grip:active {
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
