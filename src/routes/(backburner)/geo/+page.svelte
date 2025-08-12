<script lang="ts">
	import World from './world.svelte';

	// City type definition
	type City = {
		name: string;
		coordinates: {
			lat: number;
			lng: number;
		};
	};

	// Sample cities data
	const cities: City[] = [
		{
			name: 'ORIGIN',
			coordinates: {
				lat: 0,
				lng: 0
			}
		}

		// Add more cities as needed
	];

	let currentCity = $state<City>();
	let score = $state(0);
	let resultMarker: { x: number; y: number } | null = $state(null);

	// Convert geographic coordinates to SVG coordinates
	function geoToSvgCoords(lat: number, lng: number) {
		// Assuming your SVG viewBox is "0 0 1000 500" (typical for world maps)
		const x = (lng + 180) * (2000 / 360);
		const y = (90 - lat) * (857 / 180);
		console.log(x, y);
		return { x, y };
	}

	// Calculate distance between two points (in pixels)
	function calculateDistance(x1: number, y1: number, x2: number, y2: number) {
		return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
	}

	// Handle click on map
	function handleMapClick(event: MouseEvent) {
		if (!currentCity) return;

		const svgElement = event.currentTarget as SVGSVGElement;
		const rect = svgElement.getBoundingClientRect();
		const clickX = event.clientX - rect.left;
		const clickY = event.clientY - rect.top;

		const cityCoords = geoToSvgCoords(currentCity.coordinates.lat, currentCity.coordinates.lng);

		const distance = calculateDistance(clickX, clickY, cityCoords.x, cityCoords.y);

		// Calculate score based on distance (you can adjust the formula)
		const maxScore = 1000;
		const maxDistance = 500; // maximum pixel distance for scoring
		score = Math.max(0, Math.round(maxScore * (1 - distance / maxDistance)));

		// Show the correct location
		showResult(cityCoords);
	}

	// Show the correct location
	function showResult(coords: { x: number; y: number }) {
		resultMarker = coords;
	}

	// Start new round
	function newRound() {
		resultMarker = null;
		currentCity = cities[Math.floor(Math.random() * cities.length)];
	}

	// Initialize game
	newRound();
</script>

<div class="game-container">
	<div class="info">
		<h2>Find: {currentCity?.name}</h2>
		<p>Score: {score}</p>
	</div>

	<World onclick={handleMapClick} {resultMarker} />

	<button onclick={newRound}>Next City</button>
</div>

<style>
	.game-container {
		max-width: 1000px;
		width: 100%;
		margin: 0 auto;
	}

	.info {
		text-align: center;
		margin: 1rem 0;
	}
</style>
