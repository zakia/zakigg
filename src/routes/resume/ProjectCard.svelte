<script lang="ts">
	import Icon from '@iconify/svelte';
	import markdownIt from 'markdown-it';
	import mdAttr from 'markdown-it-attrs';
	import type { projects } from './data';

	const md = new markdownIt().use(mdAttr);

	let props: (typeof projects)[0] = $props();
</script>

<div class="card p-s-1 grid gap-s-4 bg-base-1">
	<div class="flex items-center justify-between gap-s-2">
		<a href={props.website} target="_blank" class="slide-link">
			<h5 class="font-semibold">
				{props.company}
			</h5>
		</a>

		<a
			href={props.code}
			target="_blank"
			class="text-brand btn flex items-center rounded-full p-s-4"
		>
			<Icon icon="mdi:github" class="h-7 w-7" />
		</a>
	</div>
	<p>{@html md.renderInline(props.description)}</p>
	<!-- {#each props.points as item}
			<div class="relative flex gap-s-4 text-content">
        <Icon icon="fa-solid:dot-circle" class="w-3 h-3 text-brand flex-shrink-0 mt-1.5" />
				<p>
					{@html md.renderInline(item)}
				</p>
			</div>
		{/each} -->
</div>
