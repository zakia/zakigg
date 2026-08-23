<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { timeSince } from '$lib/utils';
	import { createEditorHistoryDiff, type EditorHistoryEntry } from './history';

	type Props = {
		entries: EditorHistoryEntry[];
		activeId: string;
		previewId: string;
		visible: boolean;
		onClose: () => void;
		onRestore: (entry: EditorHistoryEntry) => void;
		onPreview: (entry: EditorHistoryEntry) => void;
		onClearPreview: () => void;
	};

	let {
		entries,
		activeId,
		previewId,
		visible,
		onClose,
		onRestore,
		onPreview,
		onClearPreview
	}: Props = $props();
	let relativeNow = $state(Date.now());

	const orderedEntries = $derived(entries);

	$effect(() => {
		if (!visible) return;

		relativeNow = Date.now();

		const timer = window.setInterval(() => {
			relativeNow = Date.now();
		}, 30_000);

		return () => {
			window.clearInterval(timer);
		};
	});

	function formatRelativeTimestamp(timestamp: number) {
		return timeSince(timestamp, relativeNow);
	}

	function formatTimestampTitle(timestamp: number) {
		return new Intl.DateTimeFormat(undefined, {
			dateStyle: 'medium',
			timeStyle: 'medium'
		}).format(new Date(timestamp));
	}

	function formatCounts(entry: EditorHistoryEntry) {
		const wordLabel = entry.wordCount === 1 ? 'word' : 'words';
		const characterLabel = entry.characterCount === 1 ? 'char' : 'chars';

		return `${entry.wordCount} ${wordLabel} / ${entry.characterCount} ${characterLabel}`;
	}

	function markerFor(type: 'added' | 'removed' | 'context') {
		if (type === 'added') return '+';
		if (type === 'removed') return '-';
		return ' ';
	}
</script>

{#if visible}
	<section class="history-panel" aria-label="Editor history">
		<header class="history-header">
			<div>
				<h2>History</h2>
				<span>{entries.length}</span>
			</div>
			<button type="button" title="Close History" aria-label="Close History" onclick={onClose}>
				<Icon icon="mdi:close" />
			</button>
		</header>

		<ol class="history-list list-reset">
			{#each orderedEntries as entry, index (entry.id)}
				{@const diff = createEditorHistoryDiff(entry.content, orderedEntries[index + 1]?.content)}
				<li>
					<button
						type="button"
						class:active={entry.id === activeId}
						class:previewing={entry.id === previewId}
						aria-current={entry.id === activeId ? 'step' : undefined}
						onpointerenter={() => onPreview(entry)}
						onpointerleave={onClearPreview}
						onfocus={() => onPreview(entry)}
						onblur={onClearPreview}
						onclick={() => onRestore(entry)}
					>
						<span class="history-row-top">
							<time
								class="history-time"
								datetime={new Date(entry.createdAt).toISOString()}
								title={formatTimestampTitle(entry.createdAt)}
							>
								{formatRelativeTimestamp(entry.createdAt)}
							</time>
							<span class="diff-stats" aria-hidden="true">
								<span class="diff-stat added">+{diff.added}</span>
								<span class="diff-stat removed">-{diff.removed}</span>
							</span>
						</span>
						<span class="history-preview">{entry.preview}</span>
						<span class="diff-lines" aria-label="Checkpoint diff">
							{#each diff.lines as line (line.id)}
								<span class={`diff-line ${line.type}`}>
									<span class="diff-marker">{markerFor(line.type)}</span>
									<span class="diff-text">{line.text}</span>
								</span>
							{/each}
							{#if diff.overflow}
								<span class="diff-overflow">+{diff.overflow} more</span>
							{/if}
						</span>
						<span class="history-meta">{formatCounts(entry)}</span>
					</button>
				</li>
			{/each}
		</ol>
	</section>
{/if}

<style>
	.history-panel {
		backdrop-filter: blur(18px);
		background: color-mix(in oklch, var(--base-1) 88%, transparent);
		border: 1px solid color-mix(in oklch, var(--edge) 78%, transparent);
		border-radius: var(--s-2);
		box-shadow: 0 18px 44px rgb(0 0 0 / 0.14);
		color: var(--content);
		display: grid;
		gap: var(--s-3);
		grid-template-rows: auto minmax(0, 1fr);
		max-height: min(32rem, calc(100vh - var(--s4)));
		overflow: hidden;
		padding: var(--s-2);
		position: absolute;
		right: calc(var(--s0) + env(safe-area-inset-right));
		top: calc(var(--s3) + 2.75rem + env(safe-area-inset-top));
		width: min(22rem, calc(100vw - var(--s1)));
		z-index: 4;
	}

	.history-header {
		align-items: center;
		display: flex;
		justify-content: space-between;
		gap: var(--s-2);
		padding: var(--s-3) var(--s-3) 0;
	}

	.history-header div {
		align-items: center;
		display: flex;
		gap: var(--s-3);
		min-width: 0;
	}

	h2 {
		font-size: var(--s0);
		font-weight: 650;
		line-height: 1.1;
		margin: 0;
	}

	.history-header span {
		align-items: center;
		background: color-mix(in oklch, var(--brand) 14%, transparent);
		border-radius: 999px;
		color: var(--content-1);
		display: inline-flex;
		font-size: var(--s-1);
		height: 1.35rem;
		justify-content: center;
		min-width: 1.35rem;
		padding-inline: var(--s-3);
	}

	.history-header button {
		align-items: center;
		background: transparent;
		border-radius: var(--s-4);
		color: var(--content-1);
		display: flex;
		height: 2rem;
		justify-content: center;
		min-width: 2rem;
		padding: 0;
		transition:
			background-color 0.2s,
			color 0.2s;
	}

	.history-header button:hover,
	.history-header button:focus-visible {
		background: color-mix(in oklch, var(--brand) 14%, transparent);
		color: var(--content);
	}

	.history-header button :global(svg) {
		height: 1.1rem;
		width: 1.1rem;
	}

	.history-list {
		display: grid;
		gap: var(--s-4);
		min-height: 0;
		overflow: auto;
		padding: var(--s-4);
	}

	.history-list li {
		min-width: 0;
	}

	.history-list button {
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--s-3);
		color: var(--content);
		display: grid;
		gap: var(--s-4);
		min-width: 0;
		padding: var(--s-2);
		text-align: left;
		transition:
			background-color 0.2s,
			border-color 0.2s,
			transform 0.2s;
		width: 100%;
	}

	.history-list button:hover,
	.history-list button:focus-visible {
		background: color-mix(in oklch, var(--base-2) 86%, transparent);
		border-color: color-mix(in oklch, var(--edge-1) 76%, transparent);
		transform: translateY(-1px);
	}

	.history-list button.active {
		background: color-mix(in oklch, var(--brand) 13%, var(--base-1));
		border-color: color-mix(in oklch, var(--brand) 32%, var(--edge));
	}

	.history-list button.previewing:not(.active) {
		background: color-mix(in oklch, var(--info) 10%, var(--base-1));
		border-color: color-mix(in oklch, var(--info) 34%, var(--edge));
	}

	.history-row-top,
	.diff-stats {
		align-items: center;
		display: flex;
		gap: var(--s-3);
		min-width: 0;
	}

	.history-row-top {
		justify-content: space-between;
	}

	.history-time,
	.history-meta {
		color: var(--content-1);
		font-size: var(--s-1);
		line-height: 1.1;
	}

	.history-time {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.history-preview {
		font-size: var(--s-1);
		font-weight: 560;
		line-height: 1.35;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.diff-stats {
		flex: 0 0 auto;
		font-family: var(--font-mono);
		font-size: var(--s-1);
	}

	.diff-stat {
		border-radius: var(--s-4);
		display: inline-flex;
		line-height: 1;
		padding: var(--s-5) var(--s-3);
	}

	.diff-stat.added {
		background: color-mix(in oklch, var(--success) 16%, transparent);
		color: color-mix(in oklch, var(--success) 72%, var(--content));
	}

	.diff-stat.removed {
		background: color-mix(in oklch, var(--error) 13%, transparent);
		color: color-mix(in oklch, var(--error) 76%, var(--content));
	}

	.diff-lines {
		display: grid;
		gap: var(--s-5);
		min-width: 0;
	}

	.diff-line {
		align-items: center;
		border-radius: var(--s-4);
		display: grid;
		font-family: var(--font-mono);
		font-size: var(--s-1);
		grid-template-columns: 1.15rem minmax(0, 1fr);
		line-height: 1.25;
		min-width: 0;
		overflow: hidden;
		padding: var(--s-5) var(--s-3);
	}

	.diff-line.added {
		background: color-mix(in oklch, var(--success) 13%, transparent);
		color: color-mix(in oklch, var(--success) 76%, var(--content));
	}

	.diff-line.removed {
		background: color-mix(in oklch, var(--error) 11%, transparent);
		color: color-mix(in oklch, var(--error) 80%, var(--content));
	}

	.diff-line.context {
		background: color-mix(in oklch, var(--base-2) 78%, transparent);
		color: var(--content-1);
	}

	.diff-marker {
		font-weight: 700;
		line-height: 1;
	}

	.diff-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.diff-overflow {
		color: var(--content-1);
		font-family: var(--font-mono);
		font-size: var(--s-1);
		line-height: 1.1;
		padding-inline: var(--s-3);
	}

	@media (max-width: 42rem) {
		.history-panel {
			left: var(--s-1);
			max-height: min(28rem, calc(100vh - var(--s3)));
			right: var(--s-1);
			top: calc(var(--s3) + 2.75rem + env(safe-area-inset-top));
			width: auto;
		}
	}
</style>
