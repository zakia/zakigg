<script lang="ts">
	import { onMount } from 'svelte';

	interface Photo {
		name: string;
		default: any;
		vertical: boolean;
		date: string;
	}

	interface PhotoGroup {
		date: string;
		photos: Photo[];
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

	let photoGroups: PhotoGroup[] = [];
	let photos = $state<Photo[]>([]);

	onMount(async () => {
		// Import all images from the 2025 directory
		const images = import.meta.glob<Image>('$lib/images/2025/**/*.{jpg,jpeg,png}', {
			import: 'default',
			query: {
				enhanced: true
			}
		});

		// Group photos by date
		const groupedPhotos = new Map<string, Photo[]>();

		// Create an array of promises for all image modules
		const imagePromises = Object.entries(images).map(async ([path, modulePromise]) => {
			const module = await modulePromise();
			const dateMatch = path.match(/\/2025\/(\d{4}-\d{2}-\d{2})\//);

			if (dateMatch) {
				const date = dateMatch[1];
				const fileName = path.split('/').pop() || '';

				if (!groupedPhotos.has(date)) {
					groupedPhotos.set(date, []);
				}

				const photo = {
					name: fileName,
					default: module,
					vertical: module.img.h > module.img.w,
					date: date
				};

				groupedPhotos.get(date)?.push(photo);
				return photo;
			}
			return null;
		});

		// Wait for all promises to resolve
		const loadedPhotos = await Promise.all(imagePromises);
		photos = loadedPhotos.filter((photo): photo is Photo => photo !== null);

		// Convert to array and sort by date
		photoGroups = Array.from(groupedPhotos.entries())
			.map(([date, photos]) => ({ date, photos }))
			.sort((a, b) => b.date.localeCompare(a.date));
	});
</script>

<!-- <img src={dng} />
<img src={raw} /> -->

<div class="grid grid-flow-row-dense grid-cols-4">
	{#each photos as photo}
		<div class={`${photo.vertical ? '' : 'col-span-2'}`}>
			<enhanced:img src={photo.default} alt={photo.name} class="h-full object-cover" />
		</div>
	{/each}
</div>
