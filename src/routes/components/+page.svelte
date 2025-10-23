<script lang="ts">
	import Filter from './filter.svelte';

	const filterOptions = [
		{
			label: 'All',
			value: 'all'
		},
		{
			label: 'Active',
			value: 'active'
		}
	];
</script>

<section class="flex flex-col gap-4 p-8">
	<Filter options={filterOptions} selected={filterOptions[0].value} />
</section>
