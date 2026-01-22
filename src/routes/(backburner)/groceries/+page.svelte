<script lang="ts">
	let { data } = $props();
</script>

<div class="layout gap-4">
	<a
		target="_blank"
		class="slide-link w-fit"
		href="https://ethanchlebowski.notion.site/c914dea983aa453d814775a0e7a12883?v=e139f1bcd4e64c50ae019d39459ee27f"
		>The list</a
	>
	<div class="grid grid-cols-2 gap-4">
		{#each Object.entries(data) as [key, value]}
			<div>
				<h2>{value.icon} {key}</h2>
				<ul>
					{#each value.items as item}
						<li class="flex items-center gap-1"><input type="checkbox" />{item}</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
</div>
