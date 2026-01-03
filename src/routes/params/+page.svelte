<script lang="ts">
	import { useUrlParams } from '$lib/hooks/useUrlParams.svelte';

	const params = useUrlParams({
		sort: 'date',
		language: 'en'
	});
</script>

<p>?{params.toString()}</p>

{#each params as [key]}
	<input
		type="text"
		bind:value={
			() => params.get(key),
			(value) => {
				if (value === null || value === '') {
					params.delete(key);
				} else {
					params.set(key, value);
				}
			}
		}
	/>
{/each}
