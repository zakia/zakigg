<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { createLocalAssetSrc, getLocalAssetId } from '$lib/editor/document/persistence/assets';
	import {
		resolveNoteAssetObjectUrl,
		saveNoteAsset
	} from '$lib/editor/document/persistence/storage';
	import {
		carouselAspectRatios,
		carouselNavigationOptions,
		carouselObjectPositions,
		type CarouselProps,
		type CarouselSlide
	} from './embed';

	type Props = CarouselProps & {
		editing?: boolean;
		updateProps?: (props: Record<string, unknown>) => void;
		setEditing?: (editing: boolean) => void;
	};

	let {
		slides,
		aspectRatio,
		navigation,
		arrows,
		loop,
		editing = false,
		updateProps,
		setEditing
	}: Props = $props();

	let track = $state<HTMLElement>();
	let fileInput = $state<HTMLInputElement>();
	let activeIndex = $state(0);
	let urlDraft = $state('');
	let uploading = $state(false);
	let resolvedSources = $state<Record<string, string>>({});
	let scrollFrame = 0;
	const ownedObjectUrls = new Set<string>();
	const activeSlide = $derived(slides[activeIndex]);

	$effect(() => {
		if (activeIndex >= slides.length) activeIndex = Math.max(0, slides.length - 1);
	});

	$effect(() => {
		for (const slide of slides) {
			const assetId = getLocalAssetId(slide.src);
			if (!assetId || resolvedSources[slide.id]) continue;

			void resolveNoteAssetObjectUrl(assetId).then((url) => {
				if (!url) return;
				ownedObjectUrls.add(url);
				resolvedSources = { ...resolvedSources, [slide.id]: url };
			});
		}
	});

	onDestroy(() => {
		for (const url of ownedObjectUrls) URL.revokeObjectURL(url);
		if (scrollFrame) cancelAnimationFrame(scrollFrame);
	});

	function sourceFor(slide: CarouselSlide) {
		return getLocalAssetId(slide.src) ? resolvedSources[slide.id] || '' : slide.src;
	}

	function commit(patch: Partial<CarouselProps>) {
		updateProps?.({ slides, aspectRatio, navigation, arrows, loop, ...patch });
	}

	function slideElements() {
		return track
			? Array.from(track.children).filter(
					(child): child is HTMLElement => child instanceof HTMLElement
				)
			: [];
	}

	function goToSlide(index: number, behavior: ScrollBehavior = 'smooth') {
		const elements = slideElements();
		if (!elements.length) return;
		const next = loop
			? (index + elements.length) % elements.length
			: Math.min(Math.max(index, 0), elements.length - 1);
		activeIndex = next;
		elements[next].scrollIntoView({ behavior, block: 'nearest', inline: 'center' });
	}

	function handleScroll() {
		if (!track || scrollFrame) return;
		scrollFrame = requestAnimationFrame(() => {
			scrollFrame = 0;
			if (!track) return;
			const center = track.scrollLeft + track.clientWidth / 2;
			let closest = 0;
			let distance = Infinity;
			for (const [index, slide] of slideElements().entries()) {
				const nextDistance = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - center);
				if (nextDistance < distance) {
					distance = nextDistance;
					closest = index;
				}
			}
			activeIndex = closest;
		});
	}

	function makeSlide(src: string, alt = ''): CarouselSlide {
		return {
			id: crypto.randomUUID(),
			src,
			title: '',
			caption: '',
			alt,
			objectPosition: 'center'
		};
	}

	async function addFiles(files: FileList | null) {
		if (!files?.length || !updateProps) return;
		uploading = true;
		try {
			const additions: CarouselSlide[] = [];
			for (const file of Array.from(files)) {
				if (!file.type.startsWith('image/')) continue;
				const asset = await saveNoteAsset(file);
				additions.push(makeSlide(createLocalAssetSrc(asset.id), file.name.replace(/\.[^.]+$/, '')));
			}
			if (!additions.length) return;
			const nextSlides = [...slides, ...additions];
			activeIndex = slides.length;
			commit({ slides: nextSlides });
			await tick();
			goToSlide(activeIndex, 'auto');
		} finally {
			uploading = false;
		}
	}

	async function addUrl() {
		const src = urlDraft.trim();
		if (!src) return;
		const nextSlides = [...slides, makeSlide(src)];
		activeIndex = slides.length;
		urlDraft = '';
		commit({ slides: nextSlides });
		await tick();
		goToSlide(activeIndex, 'auto');
	}

	function updateActive(patch: Partial<CarouselSlide>) {
		if (!activeSlide) return;
		commit({
			slides: slides.map((slide, index) => (index === activeIndex ? { ...slide, ...patch } : slide))
		});
	}

	async function moveActive(offset: -1 | 1) {
		const destination = activeIndex + offset;
		if (destination < 0 || destination >= slides.length) return;
		const nextSlides = [...slides];
		[nextSlides[activeIndex], nextSlides[destination]] = [
			nextSlides[destination],
			nextSlides[activeIndex]
		];
		activeIndex = destination;
		commit({ slides: nextSlides });
		await tick();
		goToSlide(destination, 'auto');
	}

	function removeActive() {
		if (!activeSlide) return;
		commit({ slides: slides.filter((_, index) => index !== activeIndex) });
	}
</script>

<section class="image-carousel" aria-roledescription="carousel" aria-label="Image carousel">
	<div class="stage" style:aspect-ratio={aspectRatio.replace(':', ' / ')}>
		<div class="track" bind:this={track} onscroll={handleScroll}>
			{#each slides as slide, index (slide.id)}
				<figure aria-label={`${index + 1} of ${slides.length}`} aria-roledescription="slide">
					{#if sourceFor(slide)}
						<img
							src={sourceFor(slide)}
							alt={slide.alt}
							style:object-position={slide.objectPosition}
						/>
					{:else}
						<div class="loading-image">Loading image…</div>
					{/if}
					{#if slide.title || slide.caption}
						<figcaption>
							{#if slide.title}<strong>{slide.title}</strong>{/if}
							{#if slide.caption}<span>{slide.caption}</span>{/if}
						</figcaption>
					{/if}
				</figure>
			{/each}
			{#if slides.length === 0}
				<div class="empty">
					<Icon icon="mdi:image-multiple-outline" />
					<strong>Add images to this carousel</strong>
					<span>Open the drag handle menu and choose Edit carousel.</span>
				</div>
			{/if}
		</div>

		{#if arrows && slides.length > 1}
			<div class="arrows" contenteditable="false">
				<button
					type="button"
					aria-label="Previous image"
					disabled={!loop && activeIndex === 0}
					onclick={() => goToSlide(activeIndex - 1)}><Icon icon="mdi:chevron-left" /></button
				>
				<button
					type="button"
					aria-label="Next image"
					disabled={!loop && activeIndex === slides.length - 1}
					onclick={() => goToSlide(activeIndex + 1)}><Icon icon="mdi:chevron-right" /></button
				>
			</div>
		{/if}
	</div>

	{#if navigation === 'dots' && slides.length > 1}
		<nav class="dots" aria-label="Carousel images" contenteditable="false">
			{#each slides as slide, index (slide.id)}
				<button
					type="button"
					aria-label={`Show image ${index + 1}`}
					aria-current={activeIndex === index ? 'true' : undefined}
					onclick={() => goToSlide(index)}
				></button>
			{/each}
		</nav>
	{/if}

	{#if editing && updateProps}
		<section class="editor" contenteditable="false" aria-label="Carousel editor">
			<header>
				<div>
					<strong>Edit carousel</strong><span
						>{slides.length} {slides.length === 1 ? 'image' : 'images'}</span
					>
				</div>
				<button class="done" type="button" onclick={() => setEditing?.(false)}>Done</button>
			</header>

			<div class="add-row">
				<input
					bind:this={fileInput}
					class="file-input"
					type="file"
					accept="image/*"
					multiple
					onchange={(event) => {
						void addFiles(event.currentTarget.files);
						event.currentTarget.value = '';
					}}
				/>
				<button type="button" disabled={uploading} onclick={() => fileInput?.click()}
					><Icon icon="mdi:image-plus-outline" />{uploading
						? 'Uploading…'
						: 'Upload images'}</button
				>
				<div class="url-field">
					<input
						bind:value={urlDraft}
						type="url"
						placeholder="Paste image URL"
						onkeydown={(event) => {
							if (event.key === 'Enter') void addUrl();
						}}
					/><button
						type="button"
						aria-label="Add image URL"
						disabled={!urlDraft.trim()}
						onclick={() => void addUrl()}><Icon icon="mdi:plus" /></button
					>
				</div>
			</div>

			{#if slides.length > 0}
				<div class="thumbnails" aria-label="Reorder and select images">
					{#each slides as slide, index (slide.id)}
						<button
							class:active={index === activeIndex}
							type="button"
							onclick={() => goToSlide(index)}
							aria-label={`Edit image ${index + 1}`}
						>
							{#if sourceFor(slide)}<img src={sourceFor(slide)} alt="" />{:else}<Icon
									icon="mdi:image-outline"
								/>{/if}
							<span>{index + 1}</span>
						</button>
					{/each}
				</div>

				<div class="image-actions">
					<strong>Image {activeIndex + 1}</strong>
					<span></span>
					<button
						type="button"
						disabled={activeIndex === 0}
						aria-label="Move image left"
						onclick={() => void moveActive(-1)}><Icon icon="mdi:arrow-left" /></button
					>
					<button
						type="button"
						disabled={activeIndex === slides.length - 1}
						aria-label="Move image right"
						onclick={() => void moveActive(1)}><Icon icon="mdi:arrow-right" /></button
					>
					<button class="remove" type="button" onclick={removeActive}
						><Icon icon="mdi:trash-can-outline" />Remove</button
					>
				</div>

				<div class="fields">
					<label
						><span>Title</span><input
							value={activeSlide?.title ?? ''}
							placeholder="Optional title"
							oninput={(event) => updateActive({ title: event.currentTarget.value })}
						/></label
					>
					<label
						><span>Caption</span><input
							value={activeSlide?.caption ?? ''}
							placeholder="Optional caption"
							oninput={(event) => updateActive({ caption: event.currentTarget.value })}
						/></label
					>
					<label class="wide"
						><span>Alt text</span><input
							value={activeSlide?.alt ?? ''}
							placeholder="Describe this image"
							oninput={(event) => updateActive({ alt: event.currentTarget.value })}
						/></label
					>
					<label
						><span>Focal point</span><select
							value={activeSlide?.objectPosition ?? 'center'}
							onchange={(event) =>
								updateActive({
									objectPosition: event.currentTarget.value as CarouselSlide['objectPosition']
								})}
							>{#each carouselObjectPositions as position}<option value={position}
									>{position}</option
								>{/each}</select
						></label
					>
				</div>
			{/if}

			<div class="options">
				<label
					><span>Ratio</span><select
						value={aspectRatio}
						onchange={(event) =>
							commit({ aspectRatio: event.currentTarget.value as CarouselProps['aspectRatio'] })}
						>{#each carouselAspectRatios as ratio}<option value={ratio}>{ratio}</option
							>{/each}</select
					></label
				>
				<label
					><span>Navigation</span><select
						value={navigation}
						onchange={(event) =>
							commit({ navigation: event.currentTarget.value as CarouselProps['navigation'] })}
						>{#each carouselNavigationOptions as option}<option value={option}>{option}</option
							>{/each}</select
					></label
				>
				<label class="toggle"
					><input
						type="checkbox"
						checked={arrows}
						onchange={(event) => commit({ arrows: event.currentTarget.checked })}
					/><span>Arrows</span></label
				>
				<label class="toggle"
					><input
						type="checkbox"
						checked={loop}
						onchange={(event) => commit({ loop: event.currentTarget.checked })}
					/><span>Loop</span></label
				>
			</div>
		</section>
	{/if}
</section>

<style>
	.image-carousel {
		margin: 0;
		width: 100%;
	}
	.stage {
		background: color-mix(in oklch, var(--content) 5%, var(--base));
		border-radius: var(--s-1);
		overflow: hidden;
		position: relative;
		width: 100%;
	}
	.track {
		display: flex;
		height: 100%;
		overflow: auto hidden;
		scroll-behavior: smooth;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
	}
	.track::-webkit-scrollbar {
		display: none;
	}
	figure,
	.empty {
		flex: 0 0 100%;
		height: 100%;
		margin: 0;
		scroll-snap-align: center;
	}
	figure {
		overflow: hidden;
		position: relative;
	}
	figure img {
		border: 0;
		border-radius: 0;
		display: block;
		height: 100%;
		margin: 0;
		max-width: none;
		object-fit: cover;
		width: 100%;
	}
	.loading-image,
	.empty {
		align-items: center;
		color: var(--content-1);
		display: flex;
		justify-content: center;
	}
	.empty {
		flex-direction: column;
		gap: var(--s-3);
		text-align: center;
	}
	.empty :global(svg) {
		height: 2rem;
		width: 2rem;
	}
	.empty strong {
		color: var(--content);
	}
	.empty span {
		font-size: var(--s-1);
	}
	figcaption {
		background: linear-gradient(transparent, rgb(0 0 0 / 0.82));
		bottom: 0;
		color: white;
		display: grid;
		gap: 0.2rem;
		left: 0;
		padding: 4rem var(--s0) var(--s0);
		position: absolute;
		right: 0;
	}
	figcaption strong {
		font-size: clamp(1.15rem, 3vw, 1.75rem);
		line-height: 1.1;
	}
	figcaption span {
		color: rgb(255 255 255 / 0.8);
		font-size: 0.9rem;
	}
	.arrows {
		display: flex;
		inset: 50% var(--s-2) auto;
		justify-content: space-between;
		pointer-events: none;
		position: absolute;
		transform: translateY(-50%);
	}
	.arrows button,
	.dots button {
		pointer-events: auto;
	}
	.arrows button {
		align-items: center;
		backdrop-filter: blur(8px);
		background: rgb(0 0 0 / 0.48);
		border: 0;
		border-radius: 999px;
		color: white;
		display: flex;
		height: 2.35rem;
		justify-content: center;
		width: 2.35rem;
	}
	.arrows button:disabled {
		opacity: 0.3;
	}
	.dots {
		display: flex;
		gap: 0.4rem;
		justify-content: center;
		padding-top: var(--s-2);
	}
	.dots button {
		background: color-mix(in oklch, var(--content) 20%, transparent);
		border: 0;
		border-radius: 999px;
		height: 0.45rem;
		padding: 0;
		transition: 0.15s ease;
		width: 0.45rem;
	}
	.dots button[aria-current='true'] {
		background: var(--brand);
		width: 1.25rem;
	}
	.editor {
		background: color-mix(in oklch, var(--content) 3%, var(--base));
		border: 1px solid color-mix(in oklch, var(--content) 12%, transparent);
		border-radius: var(--s-1);
		display: grid;
		gap: var(--s-1);
		margin-top: var(--s-1);
		padding: var(--s-1);
	}
	.editor header,
	.add-row,
	.image-actions,
	.options {
		align-items: center;
		display: flex;
		gap: var(--s-2);
	}
	.editor header {
		justify-content: space-between;
	}
	.editor header div {
		display: grid;
		gap: 0.1rem;
	}
	.editor header span {
		color: var(--content-1);
		font-size: var(--s-1);
	}
	button,
	input,
	select {
		font: inherit;
	}
	.editor button,
	.editor input,
	.editor select {
		border: 1px solid color-mix(in oklch, var(--content) 14%, transparent);
		border-radius: var(--s-3);
	}
	.editor button {
		align-items: center;
		background: var(--base);
		color: var(--content);
		display: inline-flex;
		gap: 0.35rem;
		min-height: 2.35rem;
		padding: 0.45rem 0.7rem;
	}
	.editor button:hover:not(:disabled) {
		border-color: color-mix(in oklch, var(--brand) 55%, transparent);
	}
	.editor button:disabled {
		opacity: 0.4;
	}
	.editor .done {
		background: var(--brand);
		border-color: var(--brand);
		color: var(--base);
		font-weight: 650;
	}
	.file-input {
		display: none;
	}
	.add-row {
		flex-wrap: wrap;
	}
	.url-field {
		display: flex;
		flex: 1 1 15rem;
	}
	.url-field input {
		border-radius: var(--s-3) 0 0 var(--s-3);
		flex: 1;
		min-width: 8rem;
	}
	.url-field button {
		border-radius: 0 var(--s-3) var(--s-3) 0;
		margin-left: -1px;
	}
	.editor input,
	.editor select {
		background: var(--base);
		color: var(--content);
		min-height: 2.35rem;
		padding: 0.45rem 0.6rem;
		width: 100%;
	}
	.thumbnails {
		display: flex;
		gap: var(--s-3);
		overflow-x: auto;
		padding: 0.15rem;
	}
	.thumbnails button {
		flex: 0 0 4.5rem;
		height: 3.2rem;
		overflow: hidden;
		padding: 0;
		position: relative;
	}
	.thumbnails button.active {
		border-color: var(--brand);
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--brand) 28%, transparent);
	}
	.thumbnails img {
		border: 0;
		border-radius: 0;
		height: 100%;
		margin: 0;
		object-fit: cover;
		width: 100%;
	}
	.thumbnails button > span {
		background: rgb(0 0 0 / 0.65);
		border-radius: 999px;
		bottom: 0.2rem;
		color: white;
		font-size: 0.68rem;
		min-width: 1.2rem;
		padding: 0.1rem 0.3rem;
		position: absolute;
		right: 0.2rem;
	}
	.image-actions > span {
		flex: 1;
	}
	.image-actions .remove {
		color: var(--failure, #c33);
	}
	.fields {
		display: grid;
		gap: var(--s-2);
		grid-template-columns: 1fr 1fr;
	}
	.fields label,
	.options > label:not(.toggle) {
		display: grid;
		gap: 0.25rem;
	}
	.fields label > span,
	.options label > span {
		color: var(--content-1);
		font-size: var(--s-1);
	}
	.fields .wide {
		grid-column: 1 / -1;
	}
	.options {
		border-top: 1px solid color-mix(in oklch, var(--content) 10%, transparent);
		flex-wrap: wrap;
		padding-top: var(--s-1);
	}
	.options > label:not(.toggle) {
		min-width: 7rem;
	}
	.toggle {
		align-items: center;
		display: flex;
		gap: 0.4rem;
	}
	.toggle input {
		min-height: auto;
		width: auto;
	}
	.editor :global(svg) {
		height: 1.1rem;
		width: 1.1rem;
	}
	@media (max-width: 42rem) {
		.fields {
			grid-template-columns: 1fr;
		}
		.fields .wide {
			grid-column: auto;
		}
		.image-actions {
			flex-wrap: wrap;
		}
	}
</style>
