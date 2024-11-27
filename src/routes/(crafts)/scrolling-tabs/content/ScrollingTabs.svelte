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
		if (index < 0 || index >= scrollContainer.children.length) return;

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

<div class="py-4 rounded-lg overflow-hidden w-full">
	<div class="flex mb-8 justify-center gap-2">
		{#each data as { icon }, i}
			<button
				class="btn p-4 rounded-full shadow bg-base-3"
				style="transition: 0.3s;"
				class:bg-primary-3={tabs.activeIndex === i}
				class:text-primary-content={tabs.activeIndex === i}
				onclick={() => scrollTab(i)}
			>
				<Icon class="w-8 h-8" {icon}></Icon>
			</button>
		{/each}
	</div>

	<div
		class="flex gap-8 relative snap-x snap-mandatory"
		bind:this={scrollContainer}
		style="overflow: {tabs.isTrigger ? 'hidden' : 'auto'}"
	>
		{#each data as { title, Content }, i}
			<div
				class="w-full flex-shrink-0 overflow-auto flex flex-col snap-center pb-4 gap-4"
				data-index={i}
			>
				<h3 class="H3">{title}</h3>
				<Content></Content>
				<button
					class="btn bg-primary-3 text-primary-content ml-a mx-4 rounded-full p-4 shadow"
					class:invisible={tabs.activeIndex === data.length - 1}
					onclick={() => scrollTab(tabs.activeIndex + 1)}
				>
					<Icon icon="carbon-arrow-right" class="w-8 h-8" />
				</button>
			</div>
		{/each}
	</div>
</div>
