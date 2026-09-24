<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { renderMarkdownInlineToHtml } from '$lib/markdown/render';
	import type { projects } from './data';

	let props: (typeof projects)[0] = $props();
</script>

<div>
	<div class="gap-s-2 flex items-center justify-between">
		<a href={props.website} target="_blank" class="text-brand">
			{props.company}
		</a>

		<a
			href={props.code}
			target="_blank"
			class="text-brand btn p-s-4 flex items-center rounded-full"
			class:invisible={!props.code}
		>
			<Icon icon="mdi:github" class="size-5" />
		</a>
	</div>
	<p>{@html renderMarkdownInlineToHtml(props.description)}</p>
</div>
