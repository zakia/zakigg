<script>
	import Icons from './icons.svelte';
	let props = $props();
</script>

<h2 class="text-primary -mb-2 flex items-center gap-1 text-xl">
	<Icons id={props.id} />
	{@render props.children()}
</h2>
