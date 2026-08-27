<script lang="ts">
	import { clampColumnWidth, serializeColumnWidths } from './column-widths';
	import type { ColumnsViewState } from './columns-view-state.svelte';

	let {
		contentDOM,
		shell,
		viewState,
		onCommit
	}: {
		contentDOM: HTMLElement;
		shell: HTMLElement;
		viewState: ColumnsViewState;
		onCommit: (widths: string) => void;
	} = $props();

	let dragBounds = $state<DOMRect | null>(null);
	let previewLeft = $state<number | null>(null);
	let divider = $state<HTMLElement>();
	const left = $derived(previewLeft ?? viewState.left);

	$effect(() => {
		// The variables live on ProseMirror's contentDOM so its child columns inherit them.
		contentDOM.style.setProperty('--column-left', `${left}%`);
		contentDOM.style.setProperty('--column-right', `${100 - left}%`);
	});

	function widthFromPointer(event: MouseEvent) {
		if (!dragBounds) return left;
		return clampColumnWidth(((event.clientX - dragBounds.left) / dragBounds.width) * 100);
	}

	function beginResize(event: PointerEvent) {
		if (event.button !== 0 || !shell) return;
		event.preventDefault();
		dragBounds = shell.getBoundingClientRect();
		previewLeft = widthFromPointer(event);
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function previewResize(event: PointerEvent) {
		if (!dragBounds) return;
		previewLeft = widthFromPointer(event);
	}

	function finishResize(event: PointerEvent | MouseEvent) {
		if (!dragBounds) return;
		const nextWidth = widthFromPointer(event);
		previewLeft = null;
		dragBounds = null;
		if ('pointerId' in event && divider?.hasPointerCapture(event.pointerId)) {
			divider.releasePointerCapture(event.pointerId);
		}
		onCommit(serializeColumnWidths(nextWidth));
	}

	function cancelResize(event: PointerEvent) {
		if (!dragBounds) return;
		previewLeft = null;
		dragBounds = null;
		(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
	}

	function finishLostPointerCapture() {
		if (!dragBounds || previewLeft === null) return;
		const nextWidth = previewLeft;
		previewLeft = null;
		dragBounds = null;
		onCommit(serializeColumnWidths(nextWidth));
	}

	function resizeWithKeyboard(event: KeyboardEvent) {
		const step = event.shiftKey ? 10 : 5;
		let nextLeft: number | null = null;

		if (event.key === 'ArrowLeft') nextLeft = left - step;
		if (event.key === 'ArrowRight') nextLeft = left + step;
		if (event.key === 'Home') nextLeft = 20;
		if (event.key === 'End') nextLeft = 80;
		if (nextLeft === null) return;

		event.preventDefault();
		onCommit(serializeColumnWidths(nextLeft));
	}
</script>

<svelte:window onmouseup={finishResize} />

<!-- A focusable ARIA separator is the prescribed pattern for a keyboard-resizable divider. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class="columns-divider"
	class:is-resizing={dragBounds !== null}
	style:left={`${left}%`}
	bind:this={divider}
	role="separator"
	aria-label="Resize columns"
	aria-orientation="vertical"
	aria-valuemin="20"
	aria-valuemax="80"
	aria-valuenow={Math.round(left)}
	title="Drag to resize columns"
	tabindex="0"
	contenteditable="false"
	onpointerdown={beginResize}
	onpointermove={previewResize}
	onpointerup={finishResize}
	onpointercancel={cancelResize}
	onlostpointercapture={finishLostPointerCapture}
	onkeydown={resizeWithKeyboard}
>
	<span aria-hidden="true"></span>
</div>

<style>
	:global(.columns-shell) {
		--column-divider-color: color-mix(in oklch, var(--edge-1) 78%, transparent);
		margin-block: var(--s2);
		position: relative;
	}

	:global(.columns-content) {
		display: grid;
		grid-template-columns: minmax(0, var(--column-left)) minmax(0, var(--column-right));
	}

	:global(.columns-content > [data-column]) {
		box-sizing: border-box;
		min-width: 0;
		padding-inline: var(--s1);
	}

	:global(.columns-content > [data-column]:first-child) {
		padding-left: 0;
	}

	:global(.columns-content > [data-column]:last-child) {
		padding-right: 0;
	}

	.columns-divider {
		align-items: center;
		cursor: col-resize;
		display: flex;
		inset-block: 0;
		justify-content: center;
		left: var(--column-left);
		outline: none;
		position: absolute;
		touch-action: none;
		transform: translateX(-50%);
		width: var(--s1);
		z-index: 2;
	}

	.columns-divider span {
		background: var(--column-divider-color);
		border-radius: 999px;
		height: 100%;
		transition:
			background-color 120ms ease,
			width 120ms ease;
		width: 1px;
	}

	.columns-divider:hover span,
	.columns-divider:focus-visible span,
	.columns-divider.is-resizing span {
		background: var(--brand);
		width: 3px;
	}

	.columns-divider:focus-visible {
		border-radius: var(--radius);
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--brand) 22%, transparent);
	}

	@media (max-width: 48rem) {
		:global(.columns-content) {
			gap: var(--s2);
			grid-template-columns: minmax(0, 1fr);
		}

		:global(.columns-content > [data-column]) {
			padding-inline: 0;
		}

		.columns-divider {
			display: none;
		}
	}
</style>
