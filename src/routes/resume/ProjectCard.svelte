<script lang="ts">
	import Icon from '@iconify/svelte';
	import markdownIt from 'markdown-it';
	import mdAttr from 'markdown-it-attrs';

	type CardProps = {
		icon?: string;
		company: string;
		description: string[];
		analytics?: string;
		website?: string;
		code?: string;
	};

	const md = new markdownIt().use(mdAttr);

	let props: CardProps = $props();
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
	<div>
		{#each props.description as item}
			<div class="relative flex gap-2 not-last:mb-2 text-base-8">
				<p>
					{@html md.renderInline(item)}
				</p>
			</div>
		{/each}
	</div>
</div>
