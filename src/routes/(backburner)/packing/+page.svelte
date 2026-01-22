<script lang="ts">
	import { onMount } from 'svelte';

	let tripDetails = {
		destination: '',
		startDate: '',
		endDate: '',
		hasLaundry: false,
		weather: null as any
	};

	let packingList = {
		toiletries: [
			{ item: 'Toothbrush', checked: false },
			{ item: 'Toothpaste', checked: false },
			{ item: 'Deodorant', checked: false },
			{ item: 'Shampoo', checked: false },
			{ item: 'Conditioner', checked: false },
			{ item: 'Body wash', checked: false },
			{ item: 'Face wash', checked: false },
			{ item: 'Moisturizer', checked: false },
			{ item: 'Sunscreen', checked: false },
			{ item: 'Hand sanitizer', checked: false }
		],
		clothing: [] as { item: string; checked: boolean }[],
		electronics: [
			{ item: 'Phone', checked: false },
			{ item: 'Phone charger', checked: false },
			{ item: 'Power bank', checked: false },
			{ item: 'Camera (if needed)', checked: false },
			{ item: 'Camera charger (if needed)', checked: false }
		],
		documents: [
			{ item: 'Passport (if international)', checked: false },
			{ item: 'Travel insurance', checked: false },
			{ item: 'Boarding passes', checked: false },
			{ item: 'Hotel reservations', checked: false },
			{ item: 'Credit cards', checked: false },
			{ item: 'Cash', checked: false }
		],
		other: [
			{ item: 'Water bottle', checked: false },
			{ item: 'First aid kit', checked: false },
			{ item: 'Medications', checked: false },
			{ item: 'Sunglasses', checked: false },
			{ item: 'Umbrella', checked: false },
			{ item: 'Backpack/day bag', checked: false }
		]
	};

	async function getWeather() {
		if (!tripDetails.destination) return;
		try {
			const response = await fetch(
				`https://api.openweathermap.org/data/2.5/weather?q=${tripDetails.destination}&appid=YOUR_API_KEY`
			);
			const data = await response.json();
			tripDetails.weather = data;
		} catch (error) {
			console.error('Error fetching weather:', error);
		}
	}

	function generateClothingList() {
		const start = new Date(tripDetails.startDate);
		const end = new Date(tripDetails.endDate);
		const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

		let clothingItems: { item: string; checked: boolean }[] = [];

		// Calculate number of outfits based on trip duration and laundry access
		const outfitsPerWeek = tripDetails.hasLaundry ? 7 : 14;
		const weeks = Math.ceil(days / 7);
		const totalOutfits = Math.min(outfitsPerWeek * weeks, days);

		// Add basic clothing items
		clothingItems.push(
			{ item: `${totalOutfits} pairs of underwear`, checked: false },
			{ item: `${totalOutfits} pairs of socks`, checked: false },
			{ item: `${Math.ceil(totalOutfits / 2)} pairs of pants/shorts`, checked: false },
			{ item: `${totalOutfits} shirts/tops`, checked: false },
			{ item: '1-2 pajamas', checked: false },
			{ item: '1 jacket/sweater', checked: false }
		);

		// Add weather-specific items
		if (tripDetails.weather && tripDetails.weather.main) {
			const temp = tripDetails.weather.main.temp - 273.15; // Convert Kelvin to Celsius
			if (temp < 10) {
				clothingItems.push(
					{ item: 'Winter coat', checked: false },
					{ item: 'Gloves', checked: false },
					{ item: 'Scarf', checked: false },
					{ item: 'Warm hat', checked: false }
				);
			} else if (temp > 25) {
				clothingItems.push(
					{ item: 'Swimwear', checked: false },
					{ item: 'Light, breathable clothing', checked: false }
				);
			}
		}

		packingList.clothing = clothingItems;
	}

	function handleSubmit() {
		getWeather();
		generateClothingList();
	}
</script>

<div class="container mx-auto max-w-2xl p-4">
	<h1 class="mb-6 text-3xl font-bold">Universal Packing List Generator</h1>

	<form on:submit|preventDefault={handleSubmit} class="mb-8 space-y-4">
		<div>
			<label for="destination" class="mb-1 block text-sm font-medium">Destination</label>
			<input
				type="text"
				id="destination"
				bind:value={tripDetails.destination}
				class="w-full rounded border p-2"
				required
			/>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div>
				<label for="startDate" class="mb-1 block text-sm font-medium">Start Date</label>
				<input
					type="date"
					id="startDate"
					bind:value={tripDetails.startDate}
					class="w-full rounded border p-2"
					required
				/>
			</div>
			<div>
				<label for="endDate" class="mb-1 block text-sm font-medium">End Date</label>
				<input
					type="date"
					id="endDate"
					bind:value={tripDetails.endDate}
					class="w-full rounded border p-2"
					required
				/>
			</div>
		</div>

		<div class="flex items-center">
			<input type="checkbox" id="hasLaundry" bind:checked={tripDetails.hasLaundry} class="mr-2" />
			<label for="hasLaundry" class="text-sm font-medium">Will have access to laundry</label>
		</div>

		<button
			type="submit"
			class="w-full rounded bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
		>
			Generate Packing List
		</button>
	</form>

	{#if packingList.clothing.length > 0}
		<div class="space-y-6">
			{#each Object.entries(packingList) as [category, items]}
				<div class="rounded-lg border p-4">
					<h2 class="mb-3 text-xl font-semibold capitalize">{category}</h2>
					<ul class="space-y-2">
						{#each items as item}
							<li class="flex items-center">
								<input type="checkbox" bind:checked={item.checked} class="mr-2" />
								<span class={item.checked ? 'text-gray-500 line-through' : ''}>
									{item.item}
								</span>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	/* Add any additional styles here */
</style>
