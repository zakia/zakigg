<script>
	import Icons from './icons.svelte';
	let props = $props();
</script>

<h2 class="flex text-xl gap-1 items-center -mb-2 text-primary">
	<Icons id={props.id} />
	{@render props.children()}
</h2>
