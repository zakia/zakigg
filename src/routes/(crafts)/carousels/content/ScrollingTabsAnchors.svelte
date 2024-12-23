<script lang="ts">
	const data = ['Slide_1', 'Slide_2', 'Slide_3', 'Slide_4', 'Slide_5'];

	let activeIndex = $state(0);
	let container = $state<HTMLDivElement>();

	$effect(() => {
		initIntersection();
	});

	const initIntersection = () => {
		if (!container) return;

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						activeIndex = Number(entry.target.getAttribute('data-index'));

						// Update your UI based on the active index
						// For example, highlight the active dot, change text, etc.
					}
				});
			},
			{
				root: container, // The carousel container
				threshold: 0.5 // Adjust this threshold based on when you want the item to be considered "active"
			}
		);

		Object.values(container.children).forEach((child, i) => {
			child.setAttribute('data-index', `${i}`);
			observer.observe(child);
		});
	};
</script>

<div class="py-4 rounded-lg mb-4 max-w-md mx-auto">
	<!-- <div class="flex items-center gap-1 mb-4">
		<code class="mr-4">scroll-behavior:</code>
		<code class:saturate-25={isSmooth}>auto</code>
		<Toggle bind:checked={isSmooth}></Toggle>
		<code class:saturate-25={!isSmooth}>smooth</code>
	</div> -->
	<div class="flex mb-4 gap-2 justify-center">
		{#each data as title, i}
			<a
				href="#{title}"
				class="btn rounded-full variant-base"
				style="transition: 0.3s;"
				class:variant-light={activeIndex === i}
			>
				{i + 1}
			</a>
		{/each}
	</div>

	<div
		class="overflow-auto flex h-40 gap-4 pb-4"
		bind:this={container}
		style:scroll-behavior="smooth"
	>
		{#each data as title}
			<div
				class="w-full flex-shrink-0 overflow-auto grid place-content-center border-2 border-base-content rounded-lg"
				id={title}
			>
				<h3>{title.replace('_', ' ')}</h3>
			</div>
		{/each}
	</div>
</div>
