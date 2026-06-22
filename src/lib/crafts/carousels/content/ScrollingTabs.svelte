<script module lang="ts">
	import * as v from 'valibot';
	import type { ComponentEmbedConfig } from '$lib/editor/component-embeds';

	export const scrollingTabsPropsSchema = v.object({});

	export const scrollingTabsEmbed = {
		id: 'carousels.ScrollingTabs',
		label: 'Scrolling Tabs',
		icon: 'mdi:view-carousel-outline',
		props: scrollingTabsPropsSchema,
		crafts: ['carousels']
	} satisfies ComponentEmbedConfig<typeof scrollingTabsPropsSchema>;
</script>

<script lang="ts">
	import Icon from '@iconify/svelte';
	import { data, useScrollingTabs } from './Tabs.svelte';

	const tabs = useScrollingTabs();
	let scrollContainer = $state<HTMLDivElement>();

	$effect(() => {
		if (!scrollContainer) return;

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						tabs.activeIndex = Number(entry.target.getAttribute('data-index'));
					}
				});
			},
			{
				root: scrollContainer,
				threshold: 0.5
			}
		);

		Array.from(scrollContainer.children).forEach((child) => {
			observer.observe(child);
		});

		return () => observer.disconnect();
	});

	const scrollTab = (index: number) => {
		if (!scrollContainer) return;
		if (index < 0) {
			index = scrollContainer.children.length - 1;
		} else if (index >= scrollContainer.children.length) {
			index = 0;
		}

		scrollContainer.style.scrollSnapType = 'none';

		scrollContainer.addEventListener(
			'scrollend',
			() => {
				scrollContainer!.style.scrollSnapType = 'x mandatory';
			},
			{ once: true }
		);

		const slide = scrollContainer.children.item(index) as HTMLElement | null;
		if (!slide) return;

		scrollContainer.scrollTo({
			left: slide.offsetLeft,
			behavior: 'smooth'
		});
	};
</script>

<div class="scrolling-tabs-demo" data-craft-carousel-demo>
	<div
		class="scrolling-tabs-viewport"
		bind:this={scrollContainer}
		style:overflow-x={tabs.isTrigger ? 'hidden' : 'auto'}
	>
		{#each data as { title, icon }, i (title)}
			<section class="scrolling-tabs-slide" data-index={i} aria-label={title}>
				<div class="scrolling-tabs-card">
					<span class="scrolling-tabs-number">{String(i + 1).padStart(2, '0')}</span>
					<span class="scrolling-tabs-icon">
						<Icon {icon} />
					</span>
					<strong>{title}</strong>
				</div>
			</section>
		{/each}
	</div>

	<div class="scrolling-tabs-dots" aria-label="Carousel slides">
		{#each data as { title }, i (title)}
			<button
				type="button"
				aria-label="Show {title}"
				aria-current={tabs.activeIndex === i ? 'true' : undefined}
				class="scrolling-tabs-dot"
				onclick={() => scrollTab(i)}
			>
			</button>
		{/each}
	</div>

	<button
		type="button"
		class="scrolling-tabs-arrow scrolling-tabs-arrow-previous"
		aria-label="Previous slide"
		onclick={() => scrollTab(tabs.activeIndex - 1)}
	>
		<Icon icon="carbon-arrow-left" />
	</button>
	<button
		type="button"
		class="scrolling-tabs-arrow scrolling-tabs-arrow-next"
		aria-label="Next slide"
		onclick={() => scrollTab(tabs.activeIndex + 1)}
	>
		<Icon icon="carbon-arrow-right" />
	</button>
</div>

<style>
	.scrolling-tabs-demo {
		display: grid;
		gap: var(--s-2);
		margin-block: var(--s1);
		max-width: 100%;
		overflow: hidden;
		position: relative;
		width: 100%;
	}

	.scrolling-tabs-viewport {
		border-radius: var(--radius);
		display: flex;
		scroll-snap-type: x mandatory;
		scrollbar-width: thin;
		width: 100%;
	}

	.scrolling-tabs-slide {
		flex: 0 0 100%;
		min-width: 0;
		scroll-snap-align: center;
		width: 100%;
	}

	.scrolling-tabs-card {
		align-content: center;
		background: linear-gradient(
			135deg,
			color-mix(in oklch, var(--brand) 12%, var(--base)) 0%,
			var(--base-2) 58%,
			color-mix(in oklch, var(--content) 5%, var(--base)) 100%
		);
		border: 1px solid var(--edge);
		border-radius: var(--radius);
		color: var(--content);
		display: grid;
		gap: var(--s-3);
		justify-items: center;
		min-height: clamp(13rem, 42vw, 20rem);
		padding: var(--s1);
		position: relative;
		text-align: center;
	}

	.scrolling-tabs-card strong {
		font-size: var(--s1);
		line-height: 1.1;
	}

	.scrolling-tabs-number {
		color: var(--content-1);
		font-family: var(--font-mono);
		font-size: var(--s-1);
		position: absolute;
		right: var(--s0);
		top: var(--s0);
	}

	.scrolling-tabs-icon {
		color: var(--brand);
		font-size: var(--s3);
	}

	.scrolling-tabs-dots {
		display: flex;
		gap: var(--s-4);
		justify-content: center;
	}

	.scrolling-tabs-dot,
	.scrolling-tabs-arrow {
		align-items: center;
		background: color-mix(in oklch, var(--base) 92%, var(--content) 8%);
		border: 1px solid var(--edge);
		color: var(--content);
		cursor: pointer;
		display: inline-flex;
		justify-content: center;
		transition:
			background-color 0.18s ease,
			border-color 0.18s ease,
			color 0.18s ease,
			transform 0.18s ease;
	}

	.scrolling-tabs-dot {
		border-radius: 999px;
		height: 0.65rem;
		padding: 0;
		width: 0.65rem;
	}

	.scrolling-tabs-dot[aria-current='true'] {
		background: var(--brand);
		border-color: var(--brand);
	}

	.scrolling-tabs-arrow {
		border-radius: 999px;
		box-shadow: 0 0.4rem 1.5rem color-mix(in oklch, var(--content) 10%, transparent);
		font-size: var(--s0);
		height: 2.35rem;
		position: absolute;
		top: calc(50% - 1.8rem);
		width: 2.35rem;
	}

	.scrolling-tabs-arrow:hover,
	.scrolling-tabs-arrow:focus-visible {
		background: var(--brand);
		border-color: var(--brand);
		color: var(--brand-content);
		outline: none;
		transform: translateY(-1px);
	}

	.scrolling-tabs-arrow-previous {
		left: var(--s-2);
	}

	.scrolling-tabs-arrow-next {
		right: var(--s-2);
	}

	@media (max-width: 42rem) {
		.scrolling-tabs-card {
			min-height: 12rem;
			padding: var(--s0);
		}

		.scrolling-tabs-arrow {
			height: 2rem;
			width: 2rem;
		}
	}
</style>
