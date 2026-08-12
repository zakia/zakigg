<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import ActionTooltip from './ActionTooltip.svelte';
	import {
		getEditorShortcut,
		isAppleShortcutPlatform,
		shortcutTitle,
		type EditorShortcut
	} from './keyboard-shortcuts';
	import SaveStatus from './SaveStatus.svelte';
	import type { SaveState, SyncLabelStatus } from './save-state';

	type DocumentAction = {
		title: string;
		icon: string;
		active?: boolean;
		shortcut?: EditorShortcut;
		action: () => void | Promise<void>;
	};

	type EmbedAction = {
		id: string;
		label: string;
		icon?: string;
	};

	type Props = {
		copied: boolean;
		saveState: SaveState;
		saveLabel: string;
		syncStatus?: SyncLabelStatus;
		historyOpen: boolean;
		embeds?: EmbedAction[];
		publicationState?: 'loading' | 'unpublished' | 'published' | 'working' | 'error';
		publicHref?: string;
		onCopyMarkdown: () => void | Promise<void>;
		onDownloadMarkdown: () => void;
		onOpenShortcuts: () => void;
		onToggleHistory: () => void;
		onInsertImage?: () => void;
		onInsertVideo?: () => void;
		onInsertEmbed?: (id: string) => void;
		onTogglePublication?: () => void | Promise<void>;
	};

	let {
		copied,
		saveState,
		saveLabel,
		syncStatus = 'disabled',
		historyOpen,
		embeds = [],
		publicationState = 'loading',
		publicHref,
		onCopyMarkdown,
		onDownloadMarkdown,
		onOpenShortcuts,
		onToggleHistory,
		onInsertImage,
		onInsertVideo,
		onInsertEmbed,
		onTogglePublication
	}: Props = $props();

	let useAppleKeys = $state(false);

	function actions(): DocumentAction[] {
		const items: DocumentAction[] = [
			{
				title: historyOpen ? 'Hide History' : 'Show History',
				icon: 'mdi:history',
				active: historyOpen,
				action: onToggleHistory
			},
			{
				title: 'Keyboard Shortcuts',
				icon: 'mdi:keyboard-outline',
				shortcut: getEditorShortcut('openShortcuts'),
				action: onOpenShortcuts
			},
			{
				title: copied ? 'Copied Markdown' : 'Copy Markdown',
				icon: copied ? 'mdi:check' : 'mdi:content-copy',
				action: onCopyMarkdown
			},
			{
				title: 'Download Markdown',
				icon: 'mdi:download-outline',
				action: onDownloadMarkdown
			}
		];

		if (onInsertVideo) {
			items.unshift({
				title: 'Insert Video',
				icon: 'mdi:video-outline',
				action: onInsertVideo
			});
		}

		if (onInsertImage) {
			items.unshift({
				title: 'Insert Image',
				icon: 'mdi:image-outline',
				action: onInsertImage
			});
		}

		if (onInsertEmbed && embeds.length) {
			items.unshift(
				...embeds.map((embed) => ({
					title: `Insert ${embed.label}`,
					icon: embed.icon ?? 'mdi:application-braces-outline',
					action: () => onInsertEmbed(embed.id)
				}))
			);
		}

		return items;
	}

	function publicationActionTitle(state: Props['publicationState']) {
		if (state === 'published') return 'View public craft';
		if (state === 'working') return 'Updating public craft…';
		if (state === 'error') return 'Public update failed · Click to retry';
		if (state === 'loading') return 'Checking Publication…';
		return 'Publish as Craft';
	}

	function publicationActionLabel(state: Props['publicationState']) {
		if (state === 'published') return 'Published';
		if (state === 'working') return 'Updating…';
		if (state === 'error') return 'Retry update';
		if (state === 'loading') return 'Checking…';
		return 'Publish';
	}

	function publicationActionIcon(state: Props['publicationState']) {
		if (state === 'published') return 'mdi:earth';
		if (state === 'working' || state === 'loading') return 'mdi:loading';
		if (state === 'error') return 'mdi:alert-circle-outline';
		return 'mdi:publish';
	}

	function actionTitle(item: DocumentAction) {
		return shortcutTitle(item.title, item.shortcut, useAppleKeys);
	}

	onMount(() => {
		useAppleKeys = isAppleShortcutPlatform();
	});
</script>

<div class="document-actions" aria-label="Document actions">
	<SaveStatus state={saveState} label={saveLabel} sync={syncStatus} />
	{#if onTogglePublication}
		{#if publicationState === 'published' && publicHref}
			<div class="publication-controls">
				<a
					class="publication-status active"
					href={publicHref}
					title={publicationActionTitle(publicationState)}
				>
					<Icon icon={publicationActionIcon(publicationState)} />
					<span>{publicationActionLabel(publicationState)}</span>
				</a>
				<button
					type="button"
					class="unpublish-action"
					title="Unpublish craft"
					aria-label="Unpublish craft"
					onclick={() => void onTogglePublication()}
				>
					<Icon icon="mdi:publish-off" />
				</button>
			</div>
		{:else}
			<button
				type="button"
				class="publication-status"
				class:error={publicationState === 'error'}
				title={publicationActionTitle(publicationState)}
				aria-label={publicationActionTitle(publicationState)}
				disabled={publicationState === 'working' || publicationState === 'loading'}
				onclick={() => void onTogglePublication()}
			>
				<Icon icon={publicationActionIcon(publicationState)} />
				<span>{publicationActionLabel(publicationState)}</span>
			</button>
		{/if}
	{/if}

	<div class="action-buttons" role="toolbar" aria-label="Markdown and publishing actions">
		{#each actions() as item (item.title)}
			<button
				type="button"
				class:copied={item.title === 'Copied Markdown'}
				class:active={item.active}
				title={actionTitle(item)}
				aria-label={actionTitle(item)}
				aria-pressed={item.active}
				onclick={() => void item.action()}
			>
				<Icon icon={item.icon} />
				<ActionTooltip title={item.title} shortcut={item.shortcut} />
			</button>
		{/each}
	</div>
</div>

<style>
	.document-actions,
	.action-buttons,
	button {
		align-items: center;
		display: flex;
	}

	.document-actions {
		gap: var(--s-3);
		position: absolute;
		right: calc(var(--s0) + env(safe-area-inset-right));
		top: calc(var(--s0) + env(safe-area-inset-top));
		z-index: 4;
	}

	.action-buttons {
		backdrop-filter: blur(16px);
		background: color-mix(in oklch, var(--base-1) 76%, transparent);
		border: 1px solid color-mix(in oklch, var(--edge) 72%, transparent);
		border-radius: 999px;
		box-shadow: 0 12px 30px rgb(0 0 0 / 0.08);
		gap: var(--s-4);
		padding: var(--s-4);
	}

	.publication-status {
		align-items: center;
		backdrop-filter: blur(10px);
		background: color-mix(in oklch, var(--base-1) 72%, transparent);
		border: 1px solid color-mix(in oklch, var(--edge) 70%, transparent);
		border-radius: 999px;
		font-size: var(--s-1);
		gap: var(--s-3);
		height: auto;
		display: inline-flex;
		min-height: 2rem;
		padding: var(--s-4) var(--s-2);
	}

	.publication-controls {
		align-items: center;
		display: flex;
		gap: var(--s-5);
	}

	.unpublish-action {
		backdrop-filter: blur(10px);
		background: color-mix(in oklch, var(--base-1) 72%, transparent);
		border: 1px solid color-mix(in oklch, var(--edge) 70%, transparent);
	}

	.unpublish-action:hover,
	.unpublish-action:focus-visible {
		background: color-mix(in oklch, var(--error) 12%, var(--base-1));
		color: var(--error);
	}

	.publication-status.active {
		background: color-mix(in oklch, var(--brand) 15%, var(--base-1));
		color: var(--content);
	}

	.publication-status.error {
		color: var(--error);
	}

	.publication-status:disabled {
		cursor: wait;
		opacity: 0.78;
	}

	button {
		background: transparent;
		border-radius: 999px;
		color: var(--content-1);
		height: 2rem;
		justify-content: center;
		min-width: 2rem;
		padding: 0;
		position: relative;
		transition:
			background-color 0.2s,
			color 0.2s,
			transform 0.2s;
	}

	button:hover,
	button:focus-visible,
	button.copied,
	button.active {
		background: color-mix(in oklch, var(--brand) 15%, transparent);
		color: var(--content);
	}

	button:hover {
		transform: translateY(-1px);
	}

	button :global(svg) {
		height: 1.1rem;
		width: 1.1rem;
	}

	button[aria-label='Updating public craft…'] :global(svg),
	button[aria-label='Checking Publication…'] :global(svg) {
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(1turn);
		}
	}

	@media (max-width: 42rem) {
		.document-actions {
			align-items: flex-end;
			flex-direction: column-reverse;
			right: var(--s-1);
			top: var(--s-1);
		}

		.publication-status span {
			display: none;
		}
	}
</style>
