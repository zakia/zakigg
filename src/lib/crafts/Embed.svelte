<script lang="ts">
	import { componentEmbeds } from '#lib/embeds/index.js';
	import Embed from '#lib/editor/components/Embed.svelte';
	let { attrs }: { attrs: unknown } = $props();
</script>

<div class="component-embed-frame" data-component-embed-frame>
	<Embed {attrs} registry={componentEmbeds} />
</div>

<style>
	.component-embed-frame {
		min-width: 0;
		width: 100%;
	}
</style>
