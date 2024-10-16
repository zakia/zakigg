<script module>
	export const metadata = {
		title: 'Style Guide',
		description: 'Building a style guide for the site',
		date: '2024-09-01',
		updates: '2024-10-01',
		tags: ['teaching']
	};
</script>

<script lang="ts">
	// export let data: PageData;
	let color = $state('#000');
	let colorEls = $state<HTMLDivElement[]>([]);

	const generatePalette = $derived.by((levels = 5, delta = 0.1) => {
		const colors = [];
		for (let i = -levels; i <= levels; i++) {
			const l = `calc(l + ${i * delta})`;
			const c = `calc(c * (1 - (2 * l - 1)))`;
			// baseC * (1 - Math.abs(2 * l - 1))

			colors.push({ level: i, color: `oklch(from ${color} ${l} ${c} h)` });
		}

		return colors;
	});
</script>

<div class="grid">
	<input type="color" bind:value={color} />
	<div class="grid w-full h-50">
		{#each generatePalette as { color, level }, index}
			<div class="text-white" style="background-color: {color}" bind:this={colorEls[index]}>
				{colorEls[index]?.style.backgroundColor}
			</div>
		{/each}
	</div>
</div>
