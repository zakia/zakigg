<script lang="ts">
	import { converter } from 'culori';
	const colors = [
		'#dc221f',
		'#e8571b',
		'#f0831a',
		'#f9bc10',
		'#f4e61d',
		'#b1cc10',
		'#69b42b',
		'#00a8aa',
		'#0a6ab2',
		'#244184',
		'#463a7d',
		'#ba4e84'
	];

	// Calculate position for each color (12 positions = 30 degrees apart)
	function getClockPosition(index: number) {
		const angle = index * 30 - 90; // Start at 12 o'clock (-90 degrees)
		const radius = 200; // Distance from center
		const x = Math.cos((angle * Math.PI) / 180) * radius;
		const y = Math.sin((angle * Math.PI) / 180) * radius;
		return { x, y, angle };
	}

	const toOklch = converter('oklch');

	const lchColors = colors.map((color) => ({ ...toOklch(color), hex: color }));

	const evenColors = Array.from({ length: 12 }, (_, i) => {
		return { l: 0.6, c: 0.2, h: i * 30 };
	});
</script>

<h1>Colors</h1>

<div class="clock-container">
	<div class="clock-center"></div>
	{#each colors as color, index}
		{@const position = getClockPosition(index)}
		<div
			class="absolute top-1/2 left-1/2 h-20 w-20 rounded-md"
			style="background-color: {color}; transform: translate(calc({position.x}px - 50%), calc({position.y}px - 50%)) rotate({position.angle +
				90}deg);"
		>
			<div class="color-text">{color}</div>
			{#key color}
				{@const oklch = toOklch(color)}
				<div class="color-text">
					{oklch?.l.toFixed(2)}, {oklch?.c.toFixed(2)}, {oklch?.h?.toFixed(2)}
				</div>
			{/key}
		</div>
	{/each}
</div>

<div>
	{#each lchColors as color}
		<div class="h-20 w-20 rounded-md" style="background-color: {color.hex}">
			<div>l: {color?.l?.toFixed(2)}</div>
			<div>c: {color?.c?.toFixed(2)}</div>
			<div>h: {color?.h?.toFixed(2)}</div>
		</div>
	{/each}
</div>

<div class="flex">
	{#each evenColors as color}
		<div
			class="h-20 w-20 rounded-md"
			style="background-color: oklch({color.l} {color.c} {color.h})"
		>
			<div>l: {color?.l?.toFixed(2)}</div>
			<div>c: {color?.c?.toFixed(2)}</div>
			<div>h: {color?.h?.toFixed(2)}</div>
		</div>
	{/each}
</div>

<style>
	.clock-container {
		position: relative;
		width: 500px;
		height: 500px;
		margin: 2rem auto;
		border: 2px solid #e5e7eb;
		border-radius: 50%;
		background: #f9fafb;
	}

	.color-text {
		font-size: 0.75rem;
		font-weight: 600;
		color: white;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
		writing-mode: horizontal-tb;
		text-align: center;
	}
</style>
