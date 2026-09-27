<script lang="ts">
	import type { Snippet } from 'svelte';
	import DocumentLayout from '$lib/editor/document/DocumentLayout.svelte';
	import DocumentPage from '$lib/editor/document/DocumentPage.svelte';

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

<DocumentPage scrollable role="presentation">
	<DocumentLayout {navigation} {actions} main={editor} editor />
</DocumentPage>
