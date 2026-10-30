<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';

	type Props = {
		status: { state: string; label: string };
		saving: boolean;
		dirty: boolean;
		published: boolean;
		mode: 'live' | 'source';
		onToggleMode: () => void;
		onSave?: () => void;
		onSetPublished: (value: boolean) => void;
	};

	let {
		status,
		saving,
		dirty,
		published,
		mode,
		onToggleMode,
		onSave,
		onSetPublished
	}: Props = $props();

	let justSaved = $state(false);
	let saveTimeout: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		if (saving) {
			justSaved = false;
			if (saveTimeout) clearTimeout(saveTimeout);
		} else if (!dirty && status.state === 'saved') {
			justSaved = true;
			saveTimeout = setTimeout(() => {
				justSaved = false;
			}, 2000);
		}
		return () => {
			if (saveTimeout) clearTimeout(saveTimeout);
		};
	});
</script>

<div class="document-actions" role="toolbar" aria-label="Document actions">
	<div class="toolbar-capsule">
		{#if onSave}
			<button
				type="button"
				class="capsule-btn status-btn"
				class:published
				aria-pressed={published}
				aria-label={published
					? 'Status: Published. Click to mark as draft.'
					: 'Status: Draft. Click to publish.'}
				title={published ? 'Published · Click to mark as draft' : 'Draft · Click to publish'}
				onclick={() => onSetPublished(!published)}
			>
				<span class="status-dot" class:published aria-hidden="true"></span>
				<span class="btn-label">{published ? 'Published' : 'Draft'}</span>
			</button>
			<span class="capsule-divider" aria-hidden="true"></span>
		{/if}

		<button
			type="button"
			class="capsule-btn mode-btn"
			class:active={mode === 'source'}
			aria-pressed={mode === 'source'}
			aria-label={mode === 'live' ? 'Show Markdown source (</>)' : 'Show live preview'}
			title={mode === 'live' ? 'Show Markdown source (</>)' : 'Show live preview'}
			onclick={onToggleMode}
		>
			<Icon icon="mdi:code-tags" />
			<span class="sr-only">{mode === 'live' ? 'Markdown source' : 'Live preview'}</span>
		</button>

		{#if onSave && (dirty || saving || justSaved)}
			<span class="capsule-divider" aria-hidden="true"></span>
			{#if dirty || saving}
				<button
					type="button"
					class="capsule-btn save-btn dirty"
					class:saving
					disabled={saving}
					aria-label={saving ? 'Saving changes' : 'Save changes'}
					title={saving ? 'Saving…' : `${status.label} · Save (⌘S)`}
					onclick={() => void onSave()}
				>
					<Icon icon={saving ? 'mdi:loading' : 'mdi:content-save-outline'} />
					<span class="btn-label">{saving ? 'Saving…' : 'Save'}</span>
				</button>
			{:else}
				<div
					class="capsule-btn save-btn saved"
					title="All changes saved in Git"
					aria-label="All changes saved"
				>
					<Icon icon="mdi:check" />
					<span class="btn-label">Saved</span>
				</div>
			{/if}
		{/if}
	</div>

	{#if status.state === 'error'}
		<p class="save-error" role="alert">{status.label}</p>
	{/if}
</div>

<style>
	.document-actions {
		display: grid;
		gap: var(--s-3);
		justify-items: start;
		z-index: 4;
	}

	.toolbar-capsule {
		align-items: center;
		backdrop-filter: blur(16px);
		background: color-mix(in oklch, var(--base-1) 92%, var(--base));
		border: 1px solid var(--edge);
		border-radius: 999px;
		box-shadow:
			0 4px 16px rgb(0 0 0 / 0.08),
			0 1px 3px rgb(0 0 0 / 0.04);
		display: inline-flex;
		height: 2.35rem;
		padding: 0.18rem;
		transition: width 0.2s ease;
		white-space: nowrap;
	}

	.capsule-divider {
		background: var(--edge);
		flex-shrink: 0;
		height: 1.1rem;
		margin-inline: 0.15rem;
		width: 1px;
	}

	.capsule-btn {
		align-items: center;
		background: transparent;
		border: 0;
		border-radius: 999px;
		color: var(--content-1);
		cursor: pointer;
		display: inline-flex;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 600;
		gap: 0.35rem;
		height: 100%;
		justify-content: center;
		padding: 0 0.65rem;
		text-decoration: none;
		transition:
			background-color 0.16s ease,
			color 0.16s ease,
			transform 0.12s ease;
		user-select: none;
	}

	.capsule-btn:hover:not(:disabled) {
		background: color-mix(in oklch, var(--content) 8%, transparent);
		color: var(--content);
	}

	.capsule-btn:focus-visible {
		box-shadow: var(--focus-ring);
		outline: none;
	}

	.capsule-btn:disabled {
		cursor: default;
	}

	.mode-btn {
		padding: 0 0.55rem;
	}

	.mode-btn.active {
		background: color-mix(in oklch, var(--brand) 14%, transparent);
		color: var(--brand);
	}

	.status-dot {
		background: color-mix(in oklch, var(--warning) 75%, var(--content));
		border-radius: 50%;
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--warning) 25%, transparent);
		display: inline-block;
		flex-shrink: 0;
		height: 0.5rem;
		transition: background-color 0.2s ease;
		width: 0.5rem;
	}

	.status-dot.published {
		background: color-mix(in oklch, var(--success) 75%, var(--content));
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--success) 25%, transparent);
	}

	.status-btn.published {
		color: var(--content);
	}

	.save-btn.saved {
		color: var(--content-1);
		cursor: default;
		opacity: 0.85;
	}

	.save-btn.dirty {
		background: var(--brand);
		color: var(--brand-content);
		font-weight: 700;
		padding-inline: 0.75rem;
	}

	.save-btn.dirty:hover:not(:disabled) {
		background: color-mix(in oklch, var(--brand) 88%, var(--content));
		color: var(--brand-content);
	}

	.save-btn.saving {
		opacity: 0.8;
	}

	.save-btn.saving :global(svg) {
		animation: spin 0.8s linear infinite;
	}

	.capsule-btn :global(svg) {
		flex-shrink: 0;
		height: 1.05rem;
		width: 1.05rem;
	}

	.save-error {
		color: var(--error);
		font-size: var(--s-2);
		line-height: 1.35;
		margin: 0;
		max-width: 18rem;
		text-align: left;
	}

	.sr-only {
		border: 0;
		clip: rect(0, 0, 0, 0);
		height: 1px;
		margin: -1px;
		overflow: hidden;
		padding: 0;
		position: absolute;
		white-space: nowrap;
		width: 1px;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
