<script lang="ts">
	import { onDestroy } from 'svelte';
	import {
		normalizeMediaBlockAttrs,
		type MediaBlockKind
	} from '$lib/editor/presentation/media-block/config';

	type Props = {
		kind: MediaBlockKind;
		src?: string;
		assetId?: string;
		alt?: string;
		title?: string;
		caption?: string;
		width?: number;
		align?: 'left' | 'center' | 'right';
		controls?: boolean;
		autoplay?: boolean;
		loop?: boolean;
		muted?: boolean;
		editing?: boolean;
		updateProps?: (props: Record<string, unknown>) => void;
	};

	let {
		kind,
		src = '',
		assetId = '',
		alt = '',
		title = '',
		caption = '',
		width = 100,
		align = 'center',
		controls,
		autoplay = false,
		loop = false,
		muted = false,
		editing = false,
		updateProps
	}: Props = $props();

	let resolvedSrc = $state('');
	let objectUrl = '';
	const attrs = $derived(
		normalizeMediaBlockAttrs({
			kind,
			src,
			assetId,
			alt,
			title,
			caption,
			width,
			align,
			controls,
			autoplay,
			loop,
			muted
		})
	);
	const displaySrc = $derived(resolvedSrc || attrs.src);

	$effect(() => {
		if (!attrs.assetId) {
			setResolvedSrc('');
			return;
		}

		let cancelled = false;
		void import('$lib/editor/document/persistence/storage')
			.then(({ resolveNoteAssetObjectUrl }) => resolveNoteAssetObjectUrl(attrs.assetId))
			.then((value) => {
				if (cancelled) {
					if (value?.startsWith('blob:')) URL.revokeObjectURL(value);
					return;
				}
				setResolvedSrc(value ?? '');
			});

		return () => {
			cancelled = true;
		};
	});

	onDestroy(() => setResolvedSrc(''));

	function setResolvedSrc(value: string) {
		if (objectUrl && objectUrl !== value) URL.revokeObjectURL(objectUrl);
		objectUrl = value.startsWith('blob:') ? value : '';
		resolvedSrc = value;
	}

	function update(patch: Record<string, unknown>) {
		updateProps?.({ ...attrs, ...patch });
	}
</script>

<figure
	class="media-embed"
	class:media-left={attrs.align === 'left'}
	class:media-right={attrs.align === 'right'}
	style:width={`${attrs.width}%`}
>
	{#if displaySrc}
		{#if kind === 'video'}
			<video
				src={displaySrc}
				aria-label={attrs.alt || attrs.title || 'Video'}
				controls={attrs.controls}
				autoplay={attrs.autoplay}
				loop={attrs.loop}
				muted={attrs.muted}
				playsinline
			></video>
		{:else}
			<img src={displaySrc} alt={attrs.alt} title={attrs.title || undefined} />
		{/if}
	{:else}
		<div class="media-empty">Add {kind === 'image' ? 'an' : 'a'} {kind} source</div>
	{/if}

	{#if attrs.caption}<figcaption>{attrs.caption}</figcaption>{/if}

	{#if editing && updateProps}
		<div class="media-fields" aria-label={`${kind} settings`}>
			<label
				>Source URL <input
					value={attrs.src}
					onchange={(event) => update({ src: event.currentTarget.value, assetId: '' })}
				/></label
			>
			<label
				>{kind === 'image' ? 'Alt text' : 'Accessible label'}
				<input
					value={attrs.alt}
					onchange={(event) => update({ alt: event.currentTarget.value })}
				/></label
			>
			<label
				>Caption <input
					value={attrs.caption}
					onchange={(event) => update({ caption: event.currentTarget.value })}
				/></label
			>
			<label
				>Width <input
					type="range"
					min="24"
					max="100"
					value={attrs.width}
					oninput={(event) => update({ width: Number(event.currentTarget.value) })}
				/></label
			>
			<label
				>Alignment <select
					value={attrs.align}
					onchange={(event) => update({ align: event.currentTarget.value })}
					><option value="left">Left</option><option value="center">Center</option><option
						value="right">Right</option
					></select
				></label
			>
			{#if kind === 'video'}
				<div class="media-toggles">
					<label
						><input
							type="checkbox"
							checked={attrs.controls}
							onchange={(event) => update({ controls: event.currentTarget.checked })}
						/> Controls</label
					>
					<label
						><input
							type="checkbox"
							checked={attrs.autoplay}
							onchange={(event) => update({ autoplay: event.currentTarget.checked })}
						/> Autoplay</label
					>
					<label
						><input
							type="checkbox"
							checked={attrs.loop}
							onchange={(event) => update({ loop: event.currentTarget.checked })}
						/> Loop</label
					>
					<label
						><input
							type="checkbox"
							checked={attrs.muted}
							onchange={(event) => update({ muted: event.currentTarget.checked })}
						/> Muted</label
					>
				</div>
			{/if}
		</div>
	{/if}
</figure>

<style>
	.media-embed {
		display: grid;
		gap: var(--s-3);
		margin: var(--s0) auto;
		max-width: 100%;
	}
	.media-left {
		margin-left: 0;
		margin-right: auto;
	}
	.media-right {
		margin-left: auto;
		margin-right: 0;
	}
	img,
	video {
		background: var(--base-2);
		border-radius: var(--radius);
		display: block;
		height: auto;
		max-height: 80vh;
		object-fit: contain;
		width: 100%;
	}
	.media-empty {
		background: var(--base-2);
		border: 1px dashed var(--edge);
		border-radius: var(--radius);
		color: var(--content-1);
		padding: var(--s2);
		text-align: center;
	}
	figcaption {
		color: var(--content-1);
		font-size: var(--s-1);
		text-align: center;
	}
	.media-fields {
		background: var(--base-1);
		border: 1px solid var(--edge);
		border-radius: var(--radius);
		display: grid;
		gap: var(--s-3);
		padding: var(--s-1);
	}
	.media-fields > label {
		display: grid;
		gap: var(--s-5);
	}
	.media-fields input:not([type='checkbox']):not([type='range']),
	.media-fields select {
		background: var(--base);
		border: 1px solid var(--edge);
		border-radius: var(--s-5);
		color: var(--content);
		font: inherit;
		padding: var(--s-3);
	}
	.media-toggles {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1);
	}
</style>
