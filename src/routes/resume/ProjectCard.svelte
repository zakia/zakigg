<script lang="ts">
	import Icon from '@iconify/svelte';
	import markdownIt from 'markdown-it';
	import mdAttr from 'markdown-it-attrs';
	import type { projects } from './data';

	const md = new markdownIt().use(mdAttr);

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
	<p>{@html md.renderInline(props.description)}</p>
</div>
