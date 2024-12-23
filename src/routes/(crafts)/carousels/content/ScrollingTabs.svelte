<script lang="ts">
	import Icon from '@iconify/svelte';
	import { data, useScrollingTabs } from './Tabs.svelte';

	const tabs = useScrollingTabs();
	let scrollContainer = $state<HTMLDivElement>();

	$effect(() => {
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

		Object.values(scrollContainer?.children || []).forEach((child, i) => {
			child.setAttribute('data-index', `${i}`);
			observer.observe(child);
		});
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

		const slide = scrollContainer.children[index] as HTMLElement;

		scrollContainer.scrollTo({
			left: slide.offsetLeft,
			behavior: 'smooth'
		});
	};
</script>

<div class="relative grid w-full place-items-center overflow-hidden rounded-lg py-4">
	<div
		class="relative flex snap-x snap-mandatory"
		bind:this={scrollContainer}
		style="overflow: {tabs.isTrigger ? 'hidden' : 'auto'}"
	>
		{#each data as { title, thumbnail }, i}
			<div
				class="flex w-full flex-shrink-0 snap-center flex-col justify-center gap-4 overflow-auto rounded-lg"
				data-index={i}
			>
				<img
					draggable="false"
					src="https://picsum.photos/640/360?random={i}"
					alt={title}
					class="bg-cover shadow-lg"
				/>
			</div>
		{/each}
	</div>

	<div class="mt-2 flex justify-center gap-2">
		{#each data as _, i}
			<button
				aria-label="image-{i}"
				class="btn variant-base rounded-full p-2 shadow"
				style="transition: 0.3s;"
				class:variant-light={tabs.activeIndex === i}
				onclick={() => scrollTab(i)}
			>
			</button>
		{/each}
	</div>

	<button
		class="btn variant-primary absolute left-2 rounded-full p-3 shadow"
		onclick={() => scrollTab(tabs.activeIndex - 1)}
	>
		<Icon icon="carbon-arrow-left" class="h-6 w-6" />
	</button>
	<button
		class="btn variant-primary absolute right-2 rounded-full p-3 shadow"
		onclick={() => scrollTab(tabs.activeIndex + 1)}
	>
		<Icon icon="carbon-arrow-right" class="h-6 w-6" />
	</button>
</div>
