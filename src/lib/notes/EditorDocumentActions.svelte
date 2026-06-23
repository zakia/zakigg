<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import SaveStatus from './SaveStatus.svelte';
	import type { SaveState } from './save-state';

	type DocumentAction = {
		title: string;
		icon: string;
		active?: boolean;
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
		historyOpen: boolean;
		embeds?: EmbedAction[];
		onCopyMarkdown: () => void | Promise<void>;
		onDownloadMarkdown: () => void;
		onToggleHistory: () => void;
		onInsertImage?: () => void;
		onInsertVideo?: () => void;
		onInsertEmbed?: (id: string) => void;
	};

	let {
		copied,
		saveState,
		saveLabel,
		historyOpen,
		embeds = [],
		onCopyMarkdown,
		onDownloadMarkdown,
		onToggleHistory,
		onInsertImage,
		onInsertVideo,
		onInsertEmbed
	}: Props = $props();

	function actions(): DocumentAction[] {
		const items: DocumentAction[] = [
			{
				title: historyOpen ? 'Hide History' : 'Show History',
				icon: 'mdi:history',
				active: historyOpen,
				action: onToggleHistory
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
</script>

<div class="document-actions" aria-label="Document actions">
	<SaveStatus state={saveState} label={saveLabel} />

	<div class="action-buttons" role="toolbar" aria-label="Markdown and publishing actions">
		{#each actions() as item (item.title)}
			<button
				type="button"
				class:copied={item.title === 'Copied Markdown'}
				class:active={item.active}
				title={item.title}
				aria-label={item.title}
				aria-pressed={item.active}
				onclick={() => void item.action()}
			>
				<Icon icon={item.icon} />
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

	button {
		background: transparent;
		border-radius: 999px;
		color: var(--content-1);
		height: 2rem;
		justify-content: center;
		min-width: 2rem;
		padding: 0;
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

	@media (max-width: 42rem) {
		.document-actions {
			align-items: flex-end;
			flex-direction: column-reverse;
			right: var(--s-1);
			top: var(--s-1);
		}
	}
</style>
