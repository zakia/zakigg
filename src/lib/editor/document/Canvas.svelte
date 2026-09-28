<script lang="ts">
	import type { Snippet } from 'svelte';
	import Layout from '$lib/editor/document/Layout.svelte';
	import Frame from '$lib/editor/document/Frame.svelte';

	let {
		navigation,
		actions,
		editor
	}: {
		navigation?: Snippet;
		actions?: Snippet;
		editor: Snippet;
	} = $props();
</script>

<Frame scrollable role="presentation">
	<Layout {navigation} {actions} main={editor} editor />
</Frame>
