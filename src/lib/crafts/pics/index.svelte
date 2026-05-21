<script lang="ts">
	import { onMount } from 'svelte';

	interface Photo {
		name: string;
		default: any;
		vertical: boolean;
		date: string;
	}

	type Image = {
		sources: {
			avif: string;
			webp: string;
			png: string;
		};
		img: {
			src: string;
			w: number;
			h: number;
		};
	};

	let photos = $state<Photo[]>([]);
	let loading = $state(true);

	onMount(async () => {
		// Import all images from all 2025 date directories
		const images = import.meta.glob<Image>('$lib/images/2025/**/*.{jpg,jpeg,png}', {
			import: 'default',
			query: {
				enhanced: true
			}
		});

		// Create an array of promises for all image modules
		const imagePromises = Object.entries(images).map(async ([path, modulePromise]) => {
			const module = await modulePromise();
			const dateMatch = path.match(/\/2025\/(\d{4}-\d{2}-\d{2})\//);

			if (dateMatch) {
				const date = dateMatch[1];
				const fileName = path.split('/').pop() || '';

				const photo = {
					name: fileName,
					default: module,
					vertical: module.img.h > module.img.w,
					date: date
				};

				return photo;
			}
			return null;
		});

		// Wait for all promises to resolve in parallel (no waterfalling)
		const loadedPhotos = await Promise.all(imagePromises);
		photos = loadedPhotos
			.filter((photo): photo is Photo => photo !== null)
			.sort((a, b) => {
				// Sort by date (newest first), then by filename
				const dateCompare = b.date.localeCompare(a.date);
				return dateCompare !== 0 ? dateCompare : a.name.localeCompare(b.name);
			});

		loading = false;
	});

	let displayLimit = $state(10);

	onMount(() => {
		const handleScroll = () => {
			if (
				window.innerHeight + document.documentElement.scrollTop ===
				document.documentElement.offsetHeight
			) {
				displayLimit += 10;
			}
		};

		window.addEventListener('scroll', handleScroll);

		return () => {
			window.removeEventListener('scroll', handleScroll);
		};
	});
</script>

<!-- <img src={dng} />
<img src={raw} /> -->

{#if loading}
	<div class="flex h-64 items-center justify-center">
		<div class="text-lg">Loading photos...</div>
	</div>
{:else}
	<div class="grid grid-flow-row-dense grid-cols-4">
		{#each photos.slice(0, displayLimit) as photo}
			<div class="relative {photo.vertical ? '' : 'col-span-2'}">
				<enhanced:img src={photo.default} alt={photo.name} class="h-full object-cover" />
			</div>
		{/each}
	</div>
{/if}
