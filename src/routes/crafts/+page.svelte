<script>
	let { data } = $props();
</script>

<div class="layout">
	{#each data.posts as post}
		<a href={`/crafts/${post.slug}`}>
			{post.title}
			{#if post.date}
				<p>{post.date} {new Date(post.date)}</p>
			{/if}
		</a>
	{/each}
</div>
