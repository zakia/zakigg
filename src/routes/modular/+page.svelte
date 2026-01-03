<script lang="ts">
	import { browser } from '$app/environment';
	import Highlight from '$lib/Highlight.svelte';

	const generateFluidScale = ({
		minWidth = 320, // Mobile viewport width (px)
		maxWidth = 1140, // Desktop viewport width (px)
		minRatio = 1.25, // Mobile Scale Ratio (Major Third)
		maxRatio = 1.414, // Desktop Scale Ratio (Augmented Fourth)
		steps = 5, // How many steps up/down
		baseRem = 1 // Your base size (usually 1rem)
	}) => {
		const output = [];

		// Loop from negative steps to positive steps
		for (let i = -steps; i <= steps; i++) {
			// 1. Calculate exact target sizes in REM
			// We round to 3 decimal places to keep CSS clean
			let minSize = baseRem * Math.pow(minRatio, i);
			let maxSize = baseRem * Math.pow(maxRatio, i);

			// 2. Calculate the Slope (The VW part)
			// Formula: (MaxREM - MinREM) / (MaxWidth - MinWidth)
			// We convert REM to PX for the width calculation (assuming 16px root)
			let slope = (maxSize - minSize) / ((maxWidth - minWidth) / 16);

			// 3. Calculate the Intercept (The fixed REM part)
			// Formula: MinSize - (Slope * MinWidth)
			let intercept = minSize - slope * (minWidth / 16);

			// 4. Clean up the numbers for CSS
			// Multiply slope by 100 to get VW units
			const slopeVW = slope * 100;
			const interceptREM = intercept;

			// 5. Handle the "Sign" for the + symbol
			const sign = slopeVW >= 0 ? '+' : '';

			// 6. Generate the CSS string
			const cssString = `--s${i}: clamp(${minSize.toFixed(2)}rem, ${interceptREM.toFixed(2)}rem ${sign} ${slopeVW.toFixed(2)}vw, ${maxSize.toFixed(2)}rem);`;

			output.push(cssString);
		}

		return output.join('\n');
	};

	let sizeEl = $state<HTMLDivElement | null>(null);
</script>

<section>
	<h1>Modular</h1>
	<Highlight
		header="fluid-scale.css"
		language="css"
		code={generateFluidScale({
			minRatio: 1.25, // Mobile
			maxRatio: Math.SQRT2, // Desktop (The "Root 2" you asked for)
			steps: 5
		})}
	></Highlight>

	<div bind:this={sizeEl} style="width: var(--s-1); height: var(--s-1);">
		{JSON.stringify(sizeEl?.getBoundingClientRect())}
	</div>
</section>
