<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';

	let {
		visible,
		canIndent,
		canOutdent,
		onIndent,
		onOutdent
	}: {
		visible: boolean;
		canIndent: boolean;
		canOutdent: boolean;
		onIndent: () => void;
		onOutdent: () => void;
	} = $props();

	let keyboardInset = $state(0);

	onMount(() => {
		const viewport = window.visualViewport;

		function updateInset() {
			keyboardInset = viewport
				? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
				: 0;
		}

		updateInset();
		viewport?.addEventListener('resize', updateInset);
		viewport?.addEventListener('scroll', updateInset);
		window.addEventListener('resize', updateInset);

		return () => {
			viewport?.removeEventListener('resize', updateInset);
			viewport?.removeEventListener('scroll', updateInset);
			window.removeEventListener('resize', updateInset);
		};
	});
</script>

{#if visible}
	<div
		class="mobile-list-toolbar"
		role="toolbar"
		aria-label="List item actions"
		style={`--keyboard-inset: ${keyboardInset}px;`}
		onpointerdown={(event) => event.preventDefault()}
	>
		<button type="button" disabled={!canOutdent} aria-label="Outdent list item" onclick={onOutdent}>
			<Icon icon="mdi:format-indent-decrease" />
		</button>
		<span>List item</span>
		<button type="button" disabled={!canIndent} aria-label="Indent list item" onclick={onIndent}>
			<Icon icon="mdi:format-indent-increase" />
		</button>
	</div>
{/if}

<style>
	.mobile-list-toolbar {
		display: none;
	}

	@media (hover: none), (pointer: coarse) {
		.mobile-list-toolbar {
			align-items: center;
			backdrop-filter: blur(16px);
			background: color-mix(in oklch, var(--base-1) 90%, transparent);
			border: 1px solid color-mix(in oklch, var(--edge) 78%, transparent);
			border-radius: 999px;
			bottom: calc(max(4.75rem, var(--keyboard-inset) + var(--s-2)) + env(safe-area-inset-bottom));
			box-shadow: 0 0.8rem 2rem rgb(0 0 0 / 0.12);
			display: flex;
			gap: var(--s-3);
			left: 0;
			margin-inline: auto;
			padding: var(--s-4);
			position: fixed;
			right: 0;
			width: fit-content;
			z-index: 11;
		}

		span {
			color: var(--content-1);
			font-size: var(--s-2);
			font-weight: 700;
			white-space: nowrap;
		}

		button {
			align-items: center;
			appearance: none;
			background: transparent;
			border: 0;
			border-radius: 999px;
			color: var(--content);
			display: flex;
			height: 2rem;
			justify-content: center;
			padding: 0;
			width: 2rem;
		}

		button:active:not(:disabled) {
			background: color-mix(in oklch, var(--brand) 16%, transparent);
		}

		button:disabled {
			opacity: 0.3;
		}

		button :global(svg) {
			height: 1.2rem;
			width: 1.2rem;
		}
	}
</style>
