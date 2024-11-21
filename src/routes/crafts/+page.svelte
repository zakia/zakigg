<script>
	let { data } = $props();
</script>

<div class="layout gap-4 w-full max-w-2xl">
	<h1 class="H4">Crafts</h1>
	<div data-parent>
		{#each data.posts as post, i}
			<a href={`/crafts/${post.slug}`} class="grid grid-cols-[1fr_4fr]" data-link>
				<div
					class:border-t={i === 0 || post.date.year !== data.posts[i - 1].date.year}
					class="border-content-2"
				>
					{#if i === 0 || post.date.year !== data.posts[i - 1].date.year}
						<p class="text-content-2 py-3">
							{post.date.year}
						</p>
					{/if}
				</div>
				<div class="py-3 border-t border-content-2 flex justify-between">
					<div>
						{post.title}
					</div>
					<p class="text-content-2">
						{post.date.toLocaleString(undefined, { month: '2-digit', day: '2-digit' })}
					</p>
				</div>
			</a>
		{/each}
	</div>
</div>

<style scoped>
	[data-parent]:hover [data-link] {
		color: var(--color-content-2);

		&:hover {
			color: var(--color-content-0);
		}
	}

	[data-link] {
		transition: color 0.3s;
	}
</style>
