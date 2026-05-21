<script module>
	import h2 from './h2.svelte';
	export { h2 };
</script>

<script lang="ts">
	let props = $props();
</script>

{@render props.children()}
