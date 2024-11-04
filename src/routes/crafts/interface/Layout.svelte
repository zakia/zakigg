<script module>
	import h2 from './h2.svelte';
	import Layout from '$lib/Layout.svelte';
	export { h2 };
</script>

<script lang="ts">
	import type { Metadata } from '../+page';

	const metadata: Metadata = $props();
</script>

<Layout {...metadata}>
	<slot />
</Layout>
