<script lang="ts">
	import { onDestroy } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { createLocalAssetSrc, getLocalAssetId } from '$lib/notes/media';
	import { resolveNoteAssetObjectUrl, saveNoteAsset } from '$lib/notes/storage';

	let {
		src,
		name,
		mediaType,
		size,
		updateProps
	}: {
		src: string;
		name: string;
		mediaType: string;
		size: number;
		updateProps?: (props: Record<string, unknown>) => void;
	} = $props();

	let localUrl = $state('');
	let fileInput = $state<HTMLInputElement>();
	let uploading = $state(false);
	let ownedObjectUrl = '';
	const href = $derived(getLocalAssetId(src) ? localUrl : src);

	$effect(() => {
		const assetId = getLocalAssetId(src);
		if (!assetId) return;

		let cancelled = false;
		void resolveNoteAssetObjectUrl(assetId).then((url) => {
			if (!url || cancelled) return;
			ownedObjectUrl = url;
			localUrl = url;
		});

		return () => {
			cancelled = true;
		};
	});

	onDestroy(() => {
		if (ownedObjectUrl) URL.revokeObjectURL(ownedObjectUrl);
	});

	function formatSize(bytes: number) {
		if (!Number.isFinite(bytes) || bytes < 1) return '';
		const units = ['B', 'KB', 'MB', 'GB'];
		const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
		const value = bytes / 1024 ** exponent;
		return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
	}

	async function attach(file?: File) {
		if (!file || !updateProps) return;

		uploading = true;
		try {
			const asset = await saveNoteAsset(file);
			updateProps({
				src: createLocalAssetSrc(asset.id),
				name: asset.name,
				mediaType: asset.mediaType,
				size: asset.size
			});
		} finally {
			uploading = false;
		}
	}
</script>

{#if src}
	<!-- This is an authored file URL or a local object URL, not an app route. -->
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a class="attachment" class:loading={!href} href={href || undefined} download={name}>
		<span class="attachment-icon"><Icon icon="mdi:file-outline" /></span>
		<span class="attachment-copy">
			<strong>{name || 'Attachment'}</strong>
			<span>{[mediaType, formatSize(size)].filter(Boolean).join(' · ')}</span>
		</span>
		<Icon icon="mdi:download-outline" class="download-icon" />
	</a>
{:else if updateProps}
	<div class="attachment attachment-empty">
		<input
			bind:this={fileInput}
			type="file"
			onchange={(event) => {
				void attach(event.currentTarget.files?.[0]);
				event.currentTarget.value = '';
			}}
		/>
		<span class="attachment-icon"><Icon icon="mdi:file-plus-outline" /></span>
		<span class="attachment-copy">
			<strong>Add an attachment</strong>
			<span>Select any file to store with this craft.</span>
		</span>
		<button type="button" disabled={uploading} onclick={() => fileInput?.click()}>
			{uploading ? 'Uploading…' : 'Choose file'}
		</button>
	</div>
{:else}
	<div class="attachment attachment-empty">
		<span class="attachment-icon"><Icon icon="mdi:file-alert-outline" /></span>
		<span class="attachment-copy"><strong>Attachment unavailable</strong></span>
	</div>
{/if}

<style>
	.attachment {
		align-items: center;
		background: color-mix(in oklch, var(--content) 4%, transparent);
		border: 1px solid color-mix(in oklch, var(--content) 12%, transparent);
		border-radius: var(--s-2);
		color: var(--content);
		display: flex;
		gap: var(--s-1);
		margin: 0;
		padding: var(--s-1) var(--s0);
		text-decoration: none;
		transition: 0.16s ease;
	}

	.attachment:hover,
	.attachment:focus-visible {
		background: color-mix(in oklch, var(--brand) 8%, transparent);
		border-color: color-mix(in oklch, var(--brand) 32%, transparent);
		outline: none;
		transform: translateY(-1px);
	}

	.attachment.loading {
		cursor: wait;
		opacity: 0.65;
		pointer-events: none;
	}

	.attachment-empty input {
		display: none;
	}

	.attachment-empty button {
		background: var(--brand);
		border: 0;
		border-radius: var(--s-3);
		color: var(--base);
		font: inherit;
		padding: var(--s-3) var(--s-1);
	}

	.attachment-icon {
		align-items: center;
		background: color-mix(in oklch, var(--brand) 12%, transparent);
		border-radius: var(--s-3);
		color: var(--brand);
		display: flex;
		height: 2.25rem;
		justify-content: center;
		width: 2.25rem;
	}

	.attachment-copy {
		display: grid;
		flex: 1;
		gap: var(--s-5);
		min-width: 0;
	}

	.attachment-copy strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.attachment-copy span {
		color: var(--content-1);
		font-size: var(--s-1);
	}

	.attachment :global(svg) {
		height: 1.15rem;
		width: 1.15rem;
	}

	.attachment :global(.download-icon) {
		color: var(--content-1);
		flex: 0 0 auto;
	}
</style>
