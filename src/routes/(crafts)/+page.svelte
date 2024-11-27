<script>
	let { data } = $props();
</script>

<div class="layout gap-4 w-full max-w-2xl">
	<h1 class="H4">zaki.gg</h1>
	<div data-parent>
		{#each data.posts as post, i}
			<div class="w-full h-[1px] bg-content-3"></div>
			<a
				href={`/${post.slug}`}
				class="grid grid-cols-[1fr_4fr]"
				data-link
				data-year={post.date.year}
			>
				<div class="border-content-2">
					{#if i === 0 || post.date.year !== data.posts[i - 1].date.year}
						<p class="text-content-2 py-3">
							{post.date.year}
						</p>
					{/if}
				</div>
				<div class="py-3 flex justify-between">
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
	[data-link] {
		transition: opacity 0.3s;
	}

	[data-parent]:hover [data-link] {
		opacity: 0.25;

		&:hover {
			opacity: 1;
		}
	}
</style>
