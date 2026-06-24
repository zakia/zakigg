<script lang="ts">
	import typographyMD from './typography.md?raw';
	import Icon from '$lib/components/Icon.svelte';
	import MarkdownIt from 'markdown-it';
	import Date from '$lib/ui/Date.svelte';

	const md = new MarkdownIt();

	const colors = {
		surface: ['bg-light', 'bg', 'bg-dark'],
		content: ['text'],
		primary: ['primary', 'primary-content']
	};

	const buttonVariants = [
		{ class: 'variant-base', label: 'Base', icon: 'i-mdi-arrow-right' },
		{ class: 'variant-primary', label: 'Primary', icon: 'i-mdi-heart' },
		{ class: 'variant-light', label: 'Light' },
		{ class: 'variant-ghost', label: 'Ghost' },
		{ class: 'variant-outline', label: 'Outline' }
	];
</script>

<section class="gap-s0 grid">
	<div class="gap-s2 grid md:grid-cols-3">
		<div class="gap-s0 grid">
			<h3 class="heading-3">Surface Colors</h3>
			<div class="gap-s-2 grid">
				{#each colors.surface as color}
					<div class="gap-s-2 flex items-center">
						<div
							class="h-8 w-8 rounded-full shadow"
							style="background-color: var(--color-{color})"
						></div>
						<div class="text-s-1 font-mono">{color}</div>
					</div>
				{/each}
			</div>
		</div>

		<div class="gap-s0 grid">
			<h3 class="heading-3">Content Colors</h3>
			<div class="gap-s-2 grid">
				{#each colors.content as color}
					<div class="gap-s-2 flex items-center">
						<div
							class="h-8 w-8 rounded-full shadow"
							style="background-color: var(--color-{color})"
						></div>
						<div class="text-s-1 font-mono">{color}</div>
					</div>
				{/each}
			</div>
		</div>

		<div class="gap-s0 grid">
			<h3 class="heading-3">Theme Colors</h3>
			<div class="gap-s-2 grid">
				{#each colors.primary as color}
					<div class="gap-s-2 flex items-center">
						<div
							class="h-8 w-8 rounded-full shadow"
							style="background-color: var(--color-{color})"
						></div>
						<div class="text-s-1 font-mono">{color}</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
</section>

<section class="gap-s0 grid">
	<h2 class="heading-2">Buttons</h2>
	<div class="gap-s0 flex flex-wrap">
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

<section class="gap-s0 grid">
	<h2 class="heading-2">Cards</h2>
	<div class="gap-s0 grid grid-cols-1 md:grid-cols-2">
		<div class="card bg-base">
			<div class="p-s1">
				<h3 class="heading-3">Surface 1 Card</h3>
				<p class="text-content">Primary content with base background.</p>
			</div>
		</div>
		<div class="card bg-base-1">
			<div class="p-s1">
				<h3 class="heading-3">Surface 2 Card</h3>
				<p class="text-content">Secondary content with base-1 background.</p>
			</div>
		</div>
	</div>
</section>

<section class="gap-s0 grid">
	<h2 class="heading-2">Form Elements</h2>
	<div class="gap-s0 grid max-w-md">
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
		<Date />
	</div>
</section>

{@html md.render(typographyMD)}
