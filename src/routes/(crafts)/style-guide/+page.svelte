<script module>
	export const metadata = {
		title: 'Style Guide',
		description: 'Building a style guide for the site',
		date: '2024-09-01',
		tags: ['teaching']
	};
</script>

<script lang="ts">
	import typographyMD from './typography.md?raw';
	import Layout from '$lib/Layout.svelte';
	// import chroma from 'chroma-js';
	// import Layout from '$lib/Layout.svelte';
	// import { useTheme } from '$lib/theme.svelte';
	import Icon from '@iconify/svelte';
	import MarkdownIt from 'markdown-it';

	// // export let data: PageData;
	// let color = $state('#000');
	// let colorEls = $state<HTMLDivElement[]>([]);

	// const theme = useTheme();

	// const generatePalette = $derived.by((levels = 5, delta = 0.1) => {
	// 	const colors = [];
	// 	for (let i = -levels; i <= levels; i++) {
	// 		const l = `calc(l + ${i * delta})`;
	// 		const c = `calc(c * (1 - (2 * l - 1)))`;
	// 		// baseC * (1 - Math.abs(2 * l - 1))

	// 		colors.push({ level: i, color: `oklch(from ${color} ${l} ${c} h)` });
	// 	}

	// 	return colors;
	// });

	// const darkGray = {
	// 	gray1: '#1a1a1a',
	// 	gray2: '#1c1c1c',
	// 	gray3: '#232323',
	// 	gray4: '#282828',
	// 	gray5: '#2e2e2e',
	// 	gray6: '#343434',
	// 	gray7: '#3e3e3e',
	// 	gray8: '#505050',
	// 	gray9: '#707070',
	// 	gray10: '#7e7e7e',
	// 	gray11: '#a0a0a0',
	// 	gray12: '#ededed'
	// };

	// const lightGray = {
	// 	gray1: '#fcfcfc',
	// 	gray2: '#f8f8f8',
	// 	gray3: '#f3f3f3',
	// 	gray4: '#ededed',
	// 	gray5: '#e8e8e8',
	// 	gray6: '#e2e2e2',
	// 	gray7: '#dbdbdb',
	// 	gray8: '#c7c7c7',
	// 	gray9: '#8f8f8f',
	// 	gray10: '#858585',
	// 	gray11: '#6f6f6f',
	// 	gray12: '#171717'
	// };

	// const openProps = {
	// 	gray0: 'oklch(99% 0 0)',
	// 	gray1: 'oklch(95% 0 0)',
	// 	gray2: 'oklch(88% 0 0)',
	// 	gray3: 'oklch(80% 0 0)',
	// 	gray4: 'oklch(74% 0 0)',
	// 	gray5: 'oklch(68% 0 0)',
	// 	gray6: 'oklch(63% 0 0)',
	// 	gray7: 'oklch(58% 0 0)',
	// 	gray8: 'oklch(53% 0 0)',
	// 	gray9: 'oklch(49% 0 0)',
	// 	gray10: 'oklch(43% 0 0)',
	// 	gray11: 'oklch(37% 0 0)',
	// 	gray12: 'oklch(31%] 0 0)',
	// 	gray13: const'oklch(25% 0 0)',
	// 	gray14: 'oklch(18% 0 0)',
	// 	gray15: 'oklch(10% 0 0)'
	// };

	const md = new MarkdownIt();

	const colors = {
		surface: ['surface-0', 'surface-1', 'surface-2', 'surface-3', 'surface-4'],
		content: ['content-0', 'content-1', 'content-2', 'content-3'],
		primary: ['primary', 'primary-on']
	};

	const buttonVariants = [
		{ class: 'variant-base', label: 'Base', icon: 'i-mdi-arrow-right' },
		{ class: 'variant-primary', label: 'Primary', icon: 'i-mdi-heart' },
		{ class: 'variant-light', label: 'Light' },
		{ class: 'variant-ghost', label: 'Ghost' },
		{ class: 'variant-outline', label: 'Outline' }
	];
</script>

<Layout {...metadata}>
	<section class="space-y-4">
		<div class="grid gap-8 md:grid-cols-3">
			<div class="space-y-4">
				<h3 class="heading-3">Surface Colors</h3>
				<div class="grid gap-2">
					{#each colors.surface as color}
						<div class="flex items-center space-x-2">
							<div
								class="h-8 w-8 rounded-full shadow"
								style="background-color: var(--color-{color})"
							></div>
							<div class="font-mono text-sm">{color}</div>
						</div>
					{/each}
				</div>
			</div>

			<div class="space-y-4">
				<h3 class="heading-3">Content Colors</h3>
				<div class="grid gap-2">
					{#each colors.content as color}
						<div class="flex items-center space-x-2">
							<div
								class="h-8 w-8 rounded-full shadow"
								style="background-color: var(--color-{color})"
							></div>
							<div class="font-mono text-sm">{color}</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Theme Colors -->

			<div class="space-y-4">
				<h3 class="heading-3">Theme Colors</h3>
				<div class="grid gap-2">
					{#each colors.primary as color}
						<div class="flex items-center space-x-2">
							<div
								class="h-8 w-8 rounded-full shadow"
								style="background-color: var(--color-{color})"
							></div>
							<div class="font-mono text-sm">{color}</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="heading-2">Buttons</h2>
		<div class="flex flex-wrap gap-4">
			{#each buttonVariants as variant}
				<button class="btn {variant.class}">
					{variant.label}
					{#if variant.icon}
						<Icon icon={variant.icon} class="h-4 w-4" />
					{/if}
				</button>
			{/each}
			<button disabled class="btn variant-primary">Disabled</button>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="heading-2">Cards</h2>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div class="card surface-1">
				<div class="p-6">
					<h3 class="heading-3 mb-2">Surface 1 Card</h3>
					<p class="text-content-0">Primary content with surface-1 background.</p>
				</div>
			</div>
			<div class="card surface-1">
				<div class="p-6">
					<h3 class="heading-3 mb-2">Surface 2 Card</h3>
					<p class="text-content-1">Secondary content with surface-2 background.</p>
				</div>
			</div>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="heading-2">Form Elements</h2>
		<div class="grid max-w-md gap-4">
			<div class="form-group">
				<label for="text" class="form-label">Text Input</label>
				<input type="text" id="text" class="input" placeholder="Enter text..." />
			</div>
			<div class="form-group">
				<label for="email" class="form-label">Email Input</label>
				<input type="email" id="email" class="input" placeholder="Enter email..." />
			</div>
			<div class="form-group">
				<label for="textarea" class="form-label">Textarea</label>
				<textarea id="textarea" class="input" rows="3" placeholder="Enter long text..."></textarea>
			</div>
			<div class="form-group">
				<button class="btn variant-primary">Submit</button>
			</div>
		</div>
	</section>

	<section
		class="bg-surface-0 relative flex min-h-screen max-w-3xl flex-col justify-center gap-4 overflow-hidden"
	>
		{@html md.render(typographyMD)}
	</section>
</Layout>
