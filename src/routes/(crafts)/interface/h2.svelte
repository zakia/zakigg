<script>
	import Icons from './icons.svelte';
	let props = $props();
</script>

<h2 class="text-brand flex items-center gap-s-4 text-s1">
	<Icons id={props.id} />
	{@render props.children()}
</h2>
