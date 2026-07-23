<script lang="ts">
	import { onDestroy } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { createLocalAssetSrc, getLocalAssetId } from '$lib/notes/media';
	import { resolveNoteAssetObjectUrl, saveNoteAsset } from '$lib/notes/storage';

	type Props = {
		images?: string[];
		// Provided when rendered inside an editor; enables adding/removing
		// slides, persisted straight into the embed's props.
		updateProps?: (props: Record<string, unknown>) => void;
	};

	let { images = [], updateProps }: Props = $props();
	let scroller = $state<HTMLElement>();
	let fileInput = $state<HTMLInputElement>();
	let urlDraft = $state('');
	let busy = $state(false);
	let resolvedSrcs = $state<Record<string, string>>({});
	let objectUrls: string[] = [];

	// Slides referencing the local asset store resolve to object URLs; remote
	// URLs render as-is.
	$effect(() => {
		for (const src of images) {
			const assetId = getLocalAssetId(src);

			if (!assetId || resolvedSrcs[src]) continue;

			void resolveNoteAssetObjectUrl(assetId).then((url) => {
				if (!url) return;

				objectUrls.push(url);
				resolvedSrcs[src] = url;
			});
		}
	});

	onDestroy(() => {
		for (const url of objectUrls) URL.revokeObjectURL(url);
		objectUrls = [];
	});

	function displaySrc(src: string) {
		return getLocalAssetId(src) ? resolvedSrcs[src] : src;
	}

	function commitImages(next: string[]) {
		updateProps?.({ images: next });
	}

	function addUrl() {
		const url = urlDraft.trim();

		if (!url || images.includes(url)) return;

		try {
			new URL(url);
		} catch {
			return;
		}

		commitImages([...images, url]);
		urlDraft = '';
	}

	async function addFiles(files: FileList | null) {
		const imageFiles = Array.from(files ?? []).filter((file) => file.type.startsWith('image/'));

		if (!imageFiles.length) return;

		busy = true;

		try {
			const added: string[] = [];

			for (const file of imageFiles) {
				const asset = await saveNoteAsset(file);

				added.push(createLocalAssetSrc(asset.id));
			}

			commitImages([...images, ...added]);
		} finally {
			busy = false;
		}
	}

	function removeImage(src: string) {
		commitImages(images.filter((image) => image !== src));
	}

	function scrollBySlide(direction: -1 | 1) {
		scroller?.scrollBy({ left: direction * scroller.clientWidth, behavior: 'smooth' });
	}
</script>

<figure class="image-carousel">
	{#if images.length}
		<div class="carousel-frame">
			<ul class="carousel-track" bind:this={scroller}>
				{#each images as src (src)}
					<li class="carousel-slide">
						{#if displaySrc(src)}
							<img src={displaySrc(src)} alt="" loading="lazy" decoding="async" />
						{/if}
						{#if updateProps}
							<button
								type="button"
								class="slide-remove"
								title="Remove image"
								aria-label="Remove image"
								onclick={() => removeImage(src)}
							>
								<Icon icon="mdi:close" />
							</button>
						{/if}
					</li>
				{/each}
			</ul>

			{#if images.length > 1}
				<button
					type="button"
					class="carousel-arrow is-previous"
					aria-label="Previous image"
					onclick={() => scrollBySlide(-1)}
				>
					<Icon icon="mdi:chevron-left" />
				</button>
				<button
					type="button"
					class="carousel-arrow is-next"
					aria-label="Next image"
					onclick={() => scrollBySlide(1)}
				>
					<Icon icon="mdi:chevron-right" />
				</button>
			{/if}
		</div>
	{/if}

	{#if updateProps}
		<div class="carousel-editor">
			<input
				bind:this={fileInput}
				class="carousel-file-input"
				type="file"
				accept="image/*"
				multiple
				onchange={(event) => {
					void addFiles(event.currentTarget.files);
					event.currentTarget.value = '';
				}}
			/>
			<button
				type="button"
				class="editor-action"
				disabled={busy}
				onclick={() => fileInput?.click()}
			>
				<Icon icon="mdi:image-plus-outline" />
				{busy ? 'Adding…' : 'Upload'}
			</button>
			<input
				class="url-input"
				type="url"
				placeholder="Paste image URL"
				aria-label="Image URL"
				value={urlDraft}
				oninput={(event) => (urlDraft = event.currentTarget.value)}
				onkeydown={(event) => {
					if (event.key !== 'Enter') return;
					event.preventDefault();
					addUrl();
				}}
			/>
		</div>
	{/if}
</figure>

<style>
	.image-carousel {
		display: grid;
		gap: var(--s-3);
		margin: 0;
		max-width: min(38rem, 100%);
		width: 100%;
	}

	.carousel-frame {
		position: relative;
	}

	.carousel-track {
		border-radius: var(--s-2);
		display: flex;
		list-style: none;
		margin: 0;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		padding: 0;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
	}

	.carousel-track::-webkit-scrollbar {
		display: none;
	}

	.carousel-slide {
		flex: 0 0 100%;
		position: relative;
		scroll-snap-align: center;
	}

	.carousel-slide img {
		aspect-ratio: 3 / 2;
		display: block;
		height: 100%;
		object-fit: cover;
		width: 100%;
	}

	.slide-remove,
	.carousel-arrow {
		align-items: center;
		appearance: none;
		backdrop-filter: blur(6px);
		background: color-mix(in oklch, var(--base) 72%, transparent);
		border: 1px solid color-mix(in oklch, var(--edge) 60%, transparent);
		border-radius: 999px;
		color: var(--content);
		cursor: pointer;
		display: inline-flex;
		justify-content: center;
		padding: 0;
		position: absolute;
		transition:
			background-color 0.16s ease,
			opacity 0.16s ease;
	}

	.slide-remove {
		height: 1.8rem;
		opacity: 0;
		right: var(--s-3);
		top: var(--s-3);
		width: 1.8rem;
	}

	.carousel-slide:hover .slide-remove,
	.slide-remove:focus-visible {
		opacity: 1;
	}

	.carousel-arrow {
		height: 2.2rem;
		top: 50%;
		translate: 0 -50%;
		width: 2.2rem;
	}

	.carousel-arrow.is-previous {
		left: var(--s-3);
	}

	.carousel-arrow.is-next {
		right: var(--s-3);
	}

	.slide-remove:hover,
	.carousel-arrow:hover,
	.slide-remove:focus-visible,
	.carousel-arrow:focus-visible {
		background: color-mix(in oklch, var(--base) 92%, transparent);
		outline: none;
	}

	.slide-remove :global(svg) {
		height: 1rem;
		width: 1rem;
	}

	.carousel-arrow :global(svg) {
		height: 1.3rem;
		width: 1.3rem;
	}

	.carousel-editor {
		align-items: center;
		display: flex;
		gap: var(--s-3);
	}

	.carousel-file-input {
		display: none;
	}

	.editor-action {
		align-items: center;
		appearance: none;
		background: var(--base-1);
		border: 1px solid color-mix(in oklch, var(--edge) 82%, transparent);
		border-radius: var(--s-3);
		color: var(--content-1);
		cursor: pointer;
		display: inline-flex;
		font: inherit;
		font-size: var(--s-1);
		font-weight: 650;
		gap: var(--s-4);
		min-height: 2rem;
		padding: 0 var(--s-2);
		transition:
			background-color 0.16s ease,
			color 0.16s ease;
		white-space: nowrap;
	}

	.editor-action:hover:not(:disabled),
	.editor-action:focus-visible {
		background: color-mix(in oklch, var(--brand) 12%, var(--base-1));
		color: var(--content);
		outline: none;
	}

	.editor-action:disabled {
		cursor: default;
		opacity: 0.6;
	}

	.editor-action :global(svg) {
		height: 1.05rem;
		width: 1.05rem;
	}

	.url-input {
		background: transparent;
		border: 1px solid color-mix(in oklch, var(--edge) 76%, transparent);
		border-radius: var(--s-3);
		color: var(--content);
		flex: 1;
		font: inherit;
		font-size: var(--s-1);
		min-height: 2rem;
		min-width: 0;
		padding: 0 var(--s-2);
	}

	.url-input::placeholder {
		color: color-mix(in oklch, var(--content-1) 62%, transparent);
	}

	.url-input:focus {
		border-color: color-mix(in oklch, var(--brand) 52%, var(--edge));
		outline: none;
	}
</style>
