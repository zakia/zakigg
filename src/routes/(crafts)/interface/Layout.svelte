<script module>
	import h2 from './h2.svelte';
	import Layout from '$lib/Layout.svelte';
	export { h2 };
</script>

<script lang="ts">
	import type { Metadata } from '../+page';

	const props: Metadata = $props();
</script>

<Layout title={props.title} description={props.description} date={props.date} draft={props.draft}>
	{@render props.children()}
</Layout>
