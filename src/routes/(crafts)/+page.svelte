<script>
	import { page } from '$app/state';

	let { data } = $props();
</script>

<svelte:head>
	<title>Adham Zaki</title>
	<meta
		name="description"
		content="Crafting interfaces. Building polished software and web experiences. Toronto-based Full Stack Developer and Entrepreneur."
	/>
</svelte:head>

<div class="layout w-full max-w-2xl gap-4">
	<h1 class="display-2 mb-2">zaki.gg</h1>
	<div data-parent>
		{#each data.posts.filter((post) => !post.draft || page.url.hostname === 'localhost') as post, i}
			<div class="bg-base-content/10 h-[1px] w-full"></div>
			<a
				href={`/${post.slug}`}
				class="grid grid-cols-[1fr_4fr]"
				data-link
				data-year={post.date.year}
			>
				<div class="border-base-content">
					{#if i === 0 || post.date.year !== data.posts[i - 1].date.year}
						<p class="text-base-content py-3">
							{post.date.year}
						</p>
					{/if}
				</div>
				<div class="flex justify-between py-3">
					<div>
						{post.title}
						{post.draft ? '(Draft)' : ''}
					</div>
					<p class="text-base-content">
						{post.date.toLocaleString(undefined, { month: 'short', day: '2-digit' })}
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
