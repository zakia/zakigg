<script lang="ts">
	import Icon from '@iconify/svelte';
	import markdownIt from 'markdown-it';
	import mdAttr from 'markdown-it-attrs';
	import type { projects } from './data';

	const md = new markdownIt().use(mdAttr);

	let props: (typeof projects)[0] = $props();
</script>

<div class="grid border-primary rounded-xl gap-1">
	<div class="flex gap-2 items-center justify-between">
		<a href={props.website} target="_blank" class="slide-link">
			<h5 class="font-semibold">
				{props.company}
			</h5>
		</a>

		<a
			href={props.code}
			target="_blank"
			class="flex items-center p-1 rounded-full text-primary btn"
		>
			<Icon icon="mdi:github" class="w-7 h-7" />
		</a>
	</div>
	<div class="grid gap-2">
		<p>{@html md.renderInline(props.description)}</p>
		<!-- {#each props.points as item}
			<div class="relative flex gap-1 text-base-8">
        <Icon icon="fa-solid:dot-circle" class="w-3 h-3 text-primary flex-shrink-0 mt-1.5" />
				<p>
					{@html md.renderInline(item)}
				</p>
			</div>
		{/each} -->
	</div>
</div>
