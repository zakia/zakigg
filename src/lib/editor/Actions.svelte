<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';

	type Props = {
		status: { state: string; label: string };
		saving: boolean;
		dirty: boolean;
		published: boolean;
		publicHref?: string;
		mode: 'live' | 'source';
		onToggleMode: () => void;
		onDownloadMarkdown: () => void;
		onSave?: () => void;
		onSetPublished: (value: boolean) => void;
	};

	let {
		status,
		saving,
		dirty,
		published,
		publicHref,
		mode,
		onToggleMode,
		onDownloadMarkdown,
		onSave,
		onSetPublished
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
		class:error={status.state === 'error'}
		class:working={status.state === 'saving' || status.state === 'dirty'}
		role="status"
		aria-label={status.label}
		title={status.label}>{status.label}</span
	>
	{#if onSave}
		<button
			type="button"
			class="commit-action"
			disabled={saving || !dirty}
			title="Save Markdown to Git"
			onclick={() => void onSave()}
		>
			<Icon icon={saving ? 'mdi:loading' : 'mdi:content-save-outline'} />
			<span>{saving ? 'Saving…' : 'Save to Git'}</span>
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
			{#if publicHref}
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a href={publicHref} onclick={closeMenu}>
					<Icon icon="mdi:open-in-new" />
					<span>View site page</span>
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
			<label class="publication-setting">
				<input
					type="checkbox"
					checked={published}
					onchange={(event) => onSetPublished(event.currentTarget.checked)}
				/>
				<span>Published</span>
			</label>
			<p class="publication-hint">Takes effect after Save to Git and the next site build.</p>
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
		flex-wrap: wrap;
		justify-content: flex-end;
		align-items: center;
		display: flex;
		gap: var(--s-2);
		z-index: 4;
	}
	.save-indicator {
		color: var(--content-1);
		font-size: var(--s-2);
		max-width: 24rem;
	}
	.save-indicator.working {
		color: var(--content-1);
	}
	.save-indicator.error {
		color: var(--error);
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
	.more-menu a,
	.publication-setting {
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
	.publication-hint {
		margin: 0;
		padding: 0 var(--s-2) var(--s-2);
		color: var(--content-1);
		font-size: var(--s-2);
		max-width: 17rem;
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
