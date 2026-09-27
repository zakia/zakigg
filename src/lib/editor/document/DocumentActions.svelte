<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import type { CommitStatus, SaveState } from './save-state';

	type Props = {
		saveState: SaveState;
		saveLabel: string;
		commitStatus?: CommitStatus;
		publicationState?: 'loading' | 'unpublished' | 'published' | 'working' | 'error';
		publicHref?: string;
		mode: 'live' | 'source';
		onToggleMode: () => void;
		onDownloadMarkdown: () => void;
		onCommit?: () => void | Promise<void>;
		onTogglePublication?: () => void | Promise<void>;
	};

	let {
		saveState,
		saveLabel,
		commitStatus = 'disabled',
		publicationState = 'loading',
		publicHref,
		mode,
		onToggleMode,
		onDownloadMarkdown,
		onCommit,
		onTogglePublication
	}: Props = $props();
	let menu = $state<HTMLDetailsElement>();

	function closeMenu() {
		menu?.removeAttribute('open');
	}

	onMount(() => {
		function closeOutside(event: PointerEvent) {
			if (menu && event.target instanceof Node && !menu.contains(event.target)) closeMenu();
		}
		function closeOnEscape(event: KeyboardEvent) {
			if (event.key === 'Escape') closeMenu();
		}
		document.addEventListener('pointerdown', closeOutside);
		document.addEventListener('keydown', closeOnEscape);
		return () => {
			document.removeEventListener('pointerdown', closeOutside);
			document.removeEventListener('keydown', closeOnEscape);
		};
	});
</script>

<div class="document-actions" aria-label="Document actions">
	<span
		class="save-indicator"
		class:error={saveState === 'error' || commitStatus === 'error'}
		class:working={saveState === 'saving' || commitStatus === 'committing'}
		role="status"
		aria-label={saveLabel}
		title={saveLabel}
	></span>
	{#if onCommit}
		<button
			type="button"
			class="commit-action"
			disabled={commitStatus === 'committing'}
			title="Save Markdown to Git"
			onclick={() => void onCommit()}
		>
			<Icon icon={commitStatus === 'committing' ? 'mdi:loading' : 'mdi:content-save-outline'} />
			<span>{commitStatus === 'committing' ? 'Saving…' : 'Save'}</span>
		</button>
	{/if}
	<details class="more-actions" bind:this={menu}>
		<summary aria-label="More document actions" title="More document actions">
			<Icon icon="mdi:dots-horizontal" />
		</summary>
		<div class="more-menu" role="group" aria-label="More document actions">
			<button
				type="button"
				onclick={() => {
					onToggleMode();
					closeMenu();
				}}
			>
				<Icon icon="mdi:language-markdown-outline" />
				<span>{mode === 'live' ? 'Show Markdown source' : 'Show Live Preview'}</span>
			</button>
			{#if publicationState === 'published' && publicHref}
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a href={publicHref} onclick={closeMenu}>
					<Icon icon="mdi:open-in-new" />
					<span>View published page</span>
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
			{#if onTogglePublication}
				<button
					type="button"
					disabled={publicationState === 'working' || publicationState === 'loading'}
					onclick={() => {
						void onTogglePublication();
						closeMenu();
					}}
				>
					<Icon icon={publicationState === 'published' ? 'mdi:publish-off' : 'mdi:publish'} />
					<span>{publicationState === 'published' ? 'Unpublish' : 'Publish'}</span>
				</button>
			{/if}
			<button
				type="button"
				onclick={() => {
					onDownloadMarkdown();
					closeMenu();
				}}
			>
				<Icon icon="mdi:download-outline" />
				<span>Download Markdown</span>
			</button>
		</div>
	</details>
</div>

<style>
	.document-actions {
		align-items: center;
		display: flex;
		gap: var(--s-2);
		z-index: 4;
	}
	.save-indicator {
		background: var(--success, #7ca96e);
		border-radius: 50%;
		height: 0.45rem;
		width: 0.45rem;
	}
	.save-indicator.working {
		background: var(--warning, #d8a344);
	}
	.save-indicator.error {
		background: var(--error);
	}
	.commit-action,
	.more-actions summary {
		align-items: center;
		backdrop-filter: blur(14px);
		border: 1px solid var(--edge);
		border-radius: 999px;
		cursor: pointer;
		display: inline-flex;
		gap: var(--s-3);
		justify-content: center;
		min-height: 2.1rem;
	}
	.commit-action {
		background: var(--brand);
		color: var(--brand-content);
		font: inherit;
		font-size: var(--s-1);
		font-weight: 700;
		padding: 0 var(--s-2);
	}
	.commit-action:disabled {
		opacity: 0.7;
	}
	.more-actions {
		position: relative;
	}
	.more-actions summary {
		background: var(--base-1);
		color: var(--content);
		list-style: none;
		width: 2.1rem;
	}
	.more-actions summary::-webkit-details-marker {
		display: none;
	}
	.more-menu {
		background: var(--base-1);
		border: 1px solid var(--edge);
		border-radius: var(--radius);
		box-shadow: 0 16px 38px rgb(0 0 0 / 0.14);
		display: grid;
		min-width: 13rem;
		padding: var(--s-3);
		position: absolute;
		right: 0;
		top: calc(100% + var(--s-3));
	}
	.more-menu button,
	.more-menu a {
		align-items: center;
		background: transparent;
		border: 0;
		border-radius: calc(var(--radius) * 0.5);
		color: var(--content);
		cursor: pointer;
		display: flex;
		font: inherit;
		font-size: var(--s-1);
		gap: var(--s-2);
		padding: var(--s-2);
		text-align: left;
		text-decoration: none;
	}
	.more-menu button:hover,
	.more-menu a:hover {
		background: var(--base-2);
	}
	.more-menu button:disabled {
		cursor: wait;
		opacity: 0.5;
	}
	.more-menu :global(svg),
	.commit-action :global(svg),
	.more-actions summary :global(svg) {
		height: 1rem;
		width: 1rem;
	}
</style>
