<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import Date from '$lib/ui/Date.svelte';
	import { styleGuideSections, type StyleGuideSection } from './embed';

	type Props = {
		section: StyleGuideSection;
		updateProps?: (props: Record<string, unknown>) => void;
	};

	let { section, updateProps }: Props = $props();

	const colorGroups = [
		{ label: 'Surface', values: ['bg-light', 'bg', 'bg-dark'] },
		{ label: 'Content', values: ['text'] },
		{ label: 'Theme', values: ['primary', 'primary-content'] }
	];
	const buttonVariants = [
		{ class: 'variant-base', label: 'Base', icon: 'mdi:arrow-right' },
		{ class: 'variant-primary', label: 'Primary', icon: 'mdi:heart' },
		{ class: 'variant-light', label: 'Light' },
		{ class: 'variant-ghost', label: 'Ghost' },
		{ class: 'variant-outline', label: 'Outline' }
	];

	function changeSection(next: string) {
		if (styleGuideSections.includes(next as StyleGuideSection)) {
			updateProps?.({ section: next });
		}
	}
</script>

<section class="style-guide-preview" aria-label={`${section} style preview`}>
	{#if updateProps}
		<label class="preview-picker">
			<span>Preview</span>
			<select value={section} onchange={(event) => changeSection(event.currentTarget.value)}>
				{#each styleGuideSections as option (option)}
					<option value={option}>{option}</option>
				{/each}
			</select>
		</label>
	{/if}

	{#if section === 'colors'}
		<div class="color-grid">
			{#each colorGroups as group (group.label)}
				<div class="color-group">
					<h3>{group.label}</h3>
					{#each group.values as color (color)}
						<div class="color-row">
							<span class="swatch" style={`background-color: var(--color-${color})`}></span>
							<code>{color}</code>
						</div>
					{/each}
				</div>
			{/each}
		</div>
	{:else if section === 'buttons'}
		<div class="button-grid">
			{#each buttonVariants as variant (variant.label)}
				<button type="button" class={`btn ${variant.class}`}>
					{variant.label}
					{#if variant.icon}<Icon icon={variant.icon} class="h-4 w-4" />{/if}
				</button>
			{/each}
			<button type="button" disabled class="btn variant-primary">Disabled</button>
		</div>
	{:else if section === 'cards'}
		<div class="card-grid">
			<article class="card bg-base">
				<div class="p-s1">
					<h3>Surface 1 Card</h3>
					<p>Primary content with a base background.</p>
				</div>
			</article>
			<article class="card bg-base-1">
				<div class="p-s1">
					<h3>Surface 2 Card</h3>
					<p>Secondary content with a raised background.</p>
				</div>
			</article>
		</div>
	{:else}
		<div class="form-preview">
			<label class="form-group">
				<span class="form-label">Text input</span>
				<input type="text" class="input" placeholder="Enter text…" />
			</label>
			<label class="form-group">
				<span class="form-label">Email input</span>
				<input type="email" class="input" placeholder="name@example.com" />
			</label>
			<label class="form-group">
				<span class="form-label">Textarea</span>
				<textarea class="input" rows="3" placeholder="Enter longer text…"></textarea>
			</label>
			<button type="button" class="btn variant-primary">Submit</button>
			<Date />
		</div>
	{/if}
</section>

<style>
	.style-guide-preview {
		display: grid;
		gap: var(--s0);
		width: 100%;
	}

	.preview-picker {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		justify-self: end;
		font-size: var(--text-s-1);
	}

	.preview-picker select {
		border: 1px solid color-mix(in oklch, currentColor 20%, transparent);
		border-radius: var(--s-3);
		background: var(--bg);
		padding: var(--s-3) var(--s-2);
		color: inherit;
	}

	.color-grid,
	.card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: var(--s1);
	}

	.color-group,
	.form-preview {
		display: grid;
		align-content: start;
		gap: var(--s-1);
	}

	.color-group h3,
	.card h3,
	.card p {
		margin: 0;
	}

	.color-row {
		display: flex;
		align-items: center;
		gap: var(--s-2);
	}

	.swatch {
		display: block;
		width: 2rem;
		aspect-ratio: 1;
		border-radius: 999px;
		box-shadow: var(--shadow-sm);
	}

	.button-grid {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1);
	}

	.form-preview {
		max-width: 32rem;
	}
</style>
