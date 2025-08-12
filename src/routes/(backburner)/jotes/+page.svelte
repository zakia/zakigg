<script lang="ts">
	const { data } = $props();
</script>

<div class="container mx-auto p-4">
	<h1 class="mb-4 text-2xl font-bold">Notion Users</h1>

	<div class="grid gap-4">
		{#await data.quotes}
			<div class="rounded-lg border p-4 shadow">Loading...</div>
		{:then quotes}
			{#each quotes.results as quote}
				<div class="rounded-lg border p-4 shadow">
					<pre class="whitespace-pre text-gray-600">{JSON.stringify(quote, null, 2)}</pre>
				</div>
			{/each}
		{/await}
	</div>
</div>
