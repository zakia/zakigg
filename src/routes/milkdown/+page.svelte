<script lang="ts">
	import { Crepe } from '@milkdown/crepe';
	import '@milkdown/crepe/theme/common/style.css';
	import '@milkdown/crepe/theme/frame.css';
	import { onMount } from 'svelte';

	onMount(() => {
		const crepe = new Crepe({
			root: document.getElementById('app'),
			defaultValue: '# Hello, Crepe!\n\nStart writing your markdown...'
		});

		return () => {
			crepe.destroy();
		};
	});
</script>

<div id="app"></div>
