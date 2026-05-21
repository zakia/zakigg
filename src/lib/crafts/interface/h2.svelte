<script>
	import Icons from './icons.svelte';
	let props = $props();
</script>

<h2 class="text-brand gap-s-4 text-s1 flex items-center">
	<Icons id={props.id} />
	{@render props.children()}
</h2>
