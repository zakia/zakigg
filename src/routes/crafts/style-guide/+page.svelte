<script module>
	export const metadata = {
		title: 'Style Guide',
		description: 'Building a style guide for the site',
		date: '2024-09-01',
		updated: '2024-10-01',
		tags: ['teaching']
	};
</script>

<script lang="ts">
	import chroma from 'chroma-js';
	import Layout from '$lib/Layout.svelte';
	import { useTheme } from '$lib/theme.svelte';

	// export let data: PageData;
	let color = $state('#000');
	let colorEls = $state<HTMLDivElement[]>([]);

	const theme = useTheme();

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

	const darkGray = {
		gray1: '#1a1a1a',
		gray2: '#1c1c1c',
		gray3: '#232323',
		gray4: '#282828',
		gray5: '#2e2e2e',
		gray6: '#343434',
		gray7: '#3e3e3e',
		gray8: '#505050',
		gray9: '#707070',
		gray10: '#7e7e7e',
		gray11: '#a0a0a0',
		gray12: '#ededed'
	};

	const lightGray = {
		gray1: '#fcfcfc',
		gray2: '#f8f8f8',
		gray3: '#f3f3f3',
		gray4: '#ededed',
		gray5: '#e8e8e8',
		gray6: '#e2e2e2',
		gray7: '#dbdbdb',
		gray8: '#c7c7c7',
		gray9: '#8f8f8f',
		gray10: '#858585',
		gray11: '#6f6f6f',
		gray12: '#171717'
	};

	const openProps = {
		gray0: 'oklch(99% 0 0)',
		gray1: 'oklch(95% 0 0)',
		gray2: 'oklch(88% 0 0)',
		gray3: 'oklch(80% 0 0)',
		gray4: 'oklch(74% 0 0)',
		gray5: 'oklch(68% 0 0)',
		gray6: 'oklch(63% 0 0)',
		gray7: 'oklch(58% 0 0)',
		gray8: 'oklch(53% 0 0)',
		gray9: 'oklch(49% 0 0)',
		gray10: 'oklch(43% 0 0)',
		gray11: 'oklch(37% 0 0)',
		gray12: 'oklch(31% 0 0)',
		gray13: 'oklch(25% 0 0)',
		gray14: 'oklch(18% 0 0)',
		gray15: 'oklch(10% 0 0)'
	};

	const lightMode = {
		bg: openProps.gray0,
		fg: openProps.gray12,
		lowContrast: openProps.gray9,
		dimmed: openProps.gray10
	};

	const darkMode = {
		bg: openProps.gray13,
		fg: openProps.gray0,
		lowContrast: openProps.gray1,
		dimmed: openProps.gray2
	};
</script>

<Layout {...metadata}>
	<!-- <input type="color" bind:value={color} />a -->
	<div class="grid w-full grid-cols-3">
		<div>
			{#each Object.entries(darkGray) as [name, color], i}
				<div
					class:text-black={chroma.contrast(color, '#000') > 4}
					class:text-white={chroma.contrast(color, '#000') < 4}
					style="background-color: {color}"
				>
					{i + 1} -
					{chroma(color)
						.oklch()
						.map((v) => v.toFixed(2))
						.join(', ')}
				</div>
			{/each}
		</div>
		<div>
			{#each Object.entries(lightGray) as [name, color], i}
				<div
					class:text-black={chroma.contrast(color, '#000') > 4}
					class:text-white={chroma.contrast(color, '#000') < 4}
					style="background-color: {color}"
				>
					{i + 1} -
					{chroma(color)
						.oklch()
						.map((v) => v.toFixed(2))
						.join(', ')}
				</div>
			{/each}
		</div>
		<div>
			{#each Object.entries(openProps) as [name, color], i}
				<div
					class:text-black={chroma.contrast(color, '#000') > 4}
					class:text-white={chroma.contrast(color, '#000') < 4}
					style="background-color: {color}"
				>
					{i + 1} -
					{color.match(/(\d+)%/)?.[1]}%
				</div>
			{/each}
		</div>
	</div>

	<div class="stack p-8">
		<section class="stack">
			<h1 class="heading-1">Design System Components</h1>
			<p class="text-text-muted">A showcase of available components and utilities</p>
		</section>

		<!-- Theme Controls -->
		<section class="card stack">
			<h2 class="heading-2">Theme Controls</h2>
			<div class="cluster">
				<button class="btn-primary" on:click={theme.toggle}>
					Toggle Theme ({theme.theme})
				</button>
				<button class="btn-secondary" on:click={theme.toggleHue}> Change Color </button>
			</div>
		</section>

		<!-- Typography -->
		<section class="card stack">
			<h2 class="heading-2">Typography</h2>
			<div class="stack">
				<h1 class="heading-1">Heading 1 - Major Section</h1>
				<h2 class="heading-2">Heading 2 - Sub Section</h2>
				<h3 class="heading-3">Heading 3 - Content Block</h3>
				<h4 class="heading-4">Heading 4 - Minor Section</h4>

				<div class="prose">
					<p>
						Regular paragraph text with <a href="#" class="text-link">inline link</a> for content.
					</p>
					<p class="text-text-muted">Secondary text for less emphasis</p>
					<p class="text-text-subtle">Subtle text for tertiary information</p>
				</div>
			</div>
		</section>

		<!-- Buttons -->
		<section class="card stack">
			<h2 class="heading-2">Buttons</h2>
			<div class="stack gap-8">
				<!-- Main Button Variants -->
				<div class="stack gap-2">
					<h3 class="heading-3">Button Variants</h3>
					<div class="cluster">
						<button class="btn-primary">Primary Action</button>
						<button class="btn-secondary">Secondary Action</button>
						<button class="btn-outline">Outline Button</button>
						<button class="btn-ghost">Ghost Button</button>
					</div>
				</div>

				<!-- Button States -->
				<div class="stack gap-2">
					<h3 class="heading-3">Button States</h3>
					<div class="cluster">
						<button class="btn-primary" disabled>Disabled Primary</button>
						<button class="btn-secondary" disabled>Disabled Secondary</button>
						<button class="btn-primary">
							<span>With Icon</span>
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 5l7 7-7 7"
								/>
							</svg>
						</button>
					</div>
				</div>
			</div>
		</section>

		<!-- Form Elements -->
		<section class="card stack">
			<h2 class="heading-2">Form Elements</h2>
			<div class="grid-list">
				<!-- Text Inputs -->
				<div class="stack gap-2">
					<label for="name" class="font-medium">Text Input</label>
					<input id="name" class="input" placeholder="Enter your name" />
				</div>

				<!-- Textarea -->
				<div class="stack gap-2">
					<label for="message" class="font-medium">Textarea</label>
					<textarea id="message" class="input" rows="3" placeholder="Enter your message"></textarea>
				</div>
			</div>
		</section>

		<!-- Cards -->
		<section class="stack">
			<h2 class="heading-2">Card Examples</h2>
			<div class="grid-list">
				<!-- Basic Card -->
				<div class="card interactive">
					<h3 class="heading-3">Basic Card</h3>
					<p class="text-text-muted">A simple card with some content.</p>
				</div>

				<!-- Content Card -->
				<div class="card stack">
					<img
						src="https://placehold.co/400x200"
						alt="placeholder"
						class="rounded-md w-full object-cover"
					/>
					<div class="stack">
						<h3 class="heading-3">Media Card</h3>
						<p class="text-text-muted">A card with media and additional content below.</p>
						<div class="cluster">
							<button class="btn-primary">Read More</button>
							<button class="btn-ghost">Share</button>
						</div>
					</div>
				</div>

				<!-- Interactive Card -->
				<div class="card interactive stack">
					<div class="flex justify-between items-start">
						<div class="stack gap-1">
							<h3 class="heading-3">Interactive Card</h3>
							<p class="text-text-muted">Hover to see the interaction</p>
						</div>
						<span class="bg-bg-subtle px-2 py-1 rounded-md text-sm">New</span>
					</div>
					<div class="cluster">
						<span class="text-text-subtle">Updated 2h ago</span>
						<button class="btn-ghost">Details →</button>
					</div>
				</div>
			</div>
		</section>

		<!-- Utility Examples -->
		<section class="card stack">
			<h2 class="heading-2">Utility Examples</h2>
			<div class="grid-list">
				<!-- Scrollable -->
				<div class="card stack">
					<h3 class="heading-3">Scrollable Content</h3>
					<div class="scrollable h-40 bg-bg-sunken rounded p-4">
						<div class="stack">
							{#each Array(10) as _, i}
								<p>Scrollable content item {i + 1}</p>
							{/each}
						</div>
					</div>
				</div>

				<!-- Truncate -->
				<div class="card stack">
					<h3 class="heading-3">Truncated Text</h3>
					<p class="truncate">
						This is a very long text that will be truncated when it reaches the end of its container
						using the truncate utility class which is very useful for long content that needs to fit
						in a single line.
					</p>
				</div>
			</div>
		</section>
	</div>
</Layout>
