<script lang="ts">
	import { onDestroy } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { getLocalAssetId } from '$lib/notes/media';
	import { resolveNoteAssetObjectUrl } from '$lib/notes/storage';

	let {
		src,
		name,
		mediaType,
		size
	}: { src: string; name: string; mediaType: string; size: number } = $props();

	let localUrl = $state('');
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
</script>

<a class="attachment" class:loading={!href} href={href || undefined} download={name}>
	<span class="attachment-icon"><Icon icon="mdi:file-outline" /></span>
	<span class="attachment-copy">
		<strong>{name}</strong>
		<span>{[mediaType, formatSize(size)].filter(Boolean).join(' · ')}</span>
	</span>
	<Icon icon="mdi:download-outline" class="download-icon" />
</a>

<style>
	.attachment {
		align-items: center;
		background: color-mix(in oklch, var(--content) 4%, transparent);
		border: 1px solid color-mix(in oklch, var(--content) 12%, transparent);
		border-radius: var(--s-2);
		color: var(--content);
		display: flex;
		gap: var(--s-1);
		margin-block: var(--s0);
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
