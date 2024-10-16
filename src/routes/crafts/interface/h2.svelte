<script>
	import Icons from './icons.svelte';
	let props = $props();
</script>

<h2 class="flex text-size-base gap-1 items-center -mb-4 text-primary">
	<Icons id={props.id} />
	<slot />
</h2>
