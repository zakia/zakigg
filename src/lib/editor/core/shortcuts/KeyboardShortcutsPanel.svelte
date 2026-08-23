<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { EDITOR_SHORTCUT_GROUPS } from './registry';
	import ShortcutKeys from './ShortcutKeys.svelte';

	let {
		visible,
		onClose
	}: {
		visible: boolean;
		onClose: () => void;
	} = $props();

	let dialog = $state<HTMLDialogElement>();

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === dialog) onClose();
	}

	function handleCancel(event: Event) {
		event.preventDefault();
		onClose();
	}

	$effect(() => {
		if (!dialog) return;

		if (visible && !dialog.open) {
			dialog.showModal();
		}

		if (!visible && dialog.open) {
			dialog.close();
		}
	});
</script>

<dialog
	bind:this={dialog}
	class="shortcuts-dialog"
	aria-labelledby="keyboard-shortcuts-title"
	oncancel={handleCancel}
	onclick={handleBackdropClick}
>
	<section class="shortcuts-panel">
		<header class="shortcuts-header">
			<div>
				<p class="shortcuts-eyebrow">Editor</p>
				<h2 id="keyboard-shortcuts-title">Keyboard Shortcuts</h2>
			</div>
			<button type="button" class="close-button" aria-label="Close shortcuts" onclick={onClose}>
				<Icon icon="mdi:close" />
			</button>
		</header>

		<div class="shortcut-groups">
			{#each EDITOR_SHORTCUT_GROUPS as group (group.title)}
				<section class="shortcut-group" aria-labelledby={`shortcut-group-${group.title}`}>
					<h3 id={`shortcut-group-${group.title}`}>{group.title}</h3>
					<ul class="list-reset">
						{#each group.shortcuts as shortcut (shortcut.id)}
							<li>
								<span class="shortcut-action">
									<Icon icon={shortcut.icon} />
									<span>
										<span class="shortcut-title">{shortcut.title}</span>
										{#if shortcut.description}
											<span class="shortcut-description">{shortcut.description}</span>
										{/if}
									</span>
								</span>
								<ShortcutKeys keys={shortcut.keys} />
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	</section>
</dialog>

<style>
	.shortcuts-dialog {
		background: transparent;
		border: 0;
		color: var(--content);
		margin: auto;
		max-height: min(42rem, calc(100vh - 2rem));
		max-width: min(38rem, calc(100vw - 2rem));
		padding: 0;
		width: 100%;
	}

	.shortcuts-dialog::backdrop {
		background: rgb(0 0 0 / 0.34);
		backdrop-filter: blur(8px);
	}

	.shortcuts-panel {
		background: color-mix(in oklch, var(--base) 95%, var(--base-1));
		border: 1px solid color-mix(in oklch, var(--edge) 82%, transparent);
		border-radius: var(--s-2);
		box-shadow: 0 28px 80px rgb(0 0 0 / 0.24);
		display: grid;
		gap: var(--s1);
		overflow: hidden;
		padding: var(--s1);
	}

	.shortcuts-header,
	.shortcut-action,
	.shortcut-group li {
		align-items: center;
		display: flex;
	}

	.shortcuts-header {
		justify-content: space-between;
		gap: var(--s0);
	}

	.shortcuts-eyebrow {
		color: var(--content-1);
		font-size: var(--s-1);
		margin: 0 0 var(--s-4);
	}

	h2,
	h3,
	ul {
		margin: 0;
	}

	h2 {
		font-size: var(--s2);
		font-weight: 720;
		line-height: 1.05;
	}

	h3 {
		color: var(--content-1);
		font-size: var(--s-1);
		font-weight: 720;
		margin-bottom: var(--s-2);
	}

	.close-button {
		align-items: center;
		background: transparent;
		border-radius: 999px;
		color: var(--content-1);
		display: flex;
		height: 2.25rem;
		justify-content: center;
		width: 2.25rem;
	}

	.close-button:hover,
	.close-button:focus-visible {
		background: color-mix(in oklch, var(--brand) 15%, transparent);
		color: var(--content);
	}

	.close-button :global(svg) {
		height: 1.18rem;
		width: 1.18rem;
	}

	.shortcut-groups {
		display: grid;
		gap: var(--s0);
	}

	ul {
		display: grid;
		gap: var(--s-3);
	}

	.shortcut-group li {
		background: color-mix(in oklch, var(--base-1) 56%, transparent);
		border: 1px solid color-mix(in oklch, var(--edge) 54%, transparent);
		border-radius: var(--s-4);
		gap: var(--s0);
		justify-content: space-between;
		min-height: 3rem;
		padding: var(--s-2) var(--s-1);
	}

	.shortcut-action {
		gap: var(--s-2);
		min-width: 0;
	}

	.shortcut-action :global(svg) {
		color: var(--brand);
		flex: 0 0 auto;
		height: 1.18rem;
		width: 1.18rem;
	}

	.shortcut-title,
	.shortcut-description {
		display: block;
	}

	.shortcut-title {
		font-size: var(--s0);
		font-weight: 650;
		line-height: 1.15;
	}

	.shortcut-description {
		color: var(--content-1);
		font-size: var(--s-1);
		margin-top: 0.16rem;
	}

	@media (max-width: 34rem) {
		.shortcuts-panel {
			border-radius: var(--s-3);
			padding: var(--s0);
		}

		.shortcut-group li {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
