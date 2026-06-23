<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import markdownIt from 'markdown-it';
	import mdAttr from 'markdown-it-attrs';

	type CardProps = {
		icon?: string;
		company: string;
		subtitle?: string;
		position?: {
			role: string;
			startDate: string;
			endDate?: string;
		};
		description: string[];
		link?: string;
		compact?: boolean;
	};

	const md = new markdownIt().use(mdAttr);

	let props: CardProps = $props();

	const formatDate = (date?: string) => {
		if (!date) return 'Present';

		return new Date(date).toLocaleString(undefined, {
			month: 'short',
			year: 'numeric',
			timeZone: 'UTC'
		});
	};
</script>

<div class="grid">
	<div class="flex">
		<h3 class="mr-auto font-semibold">
			{props.company},
			<span class="text-brand font-normal">{props.position?.role}</span>
		</h3>
		<div class="text-content-1">
			{formatDate(props.position?.startDate)} - {formatDate(props.position?.endDate)}
		</div>
	</div>
	{#if props.subtitle}
		<p class="text-content-1 italic">
			{props.subtitle}
		</p>
	{/if}
	<ul>
		{#each props.description as item}
			<li>
				{@html md.renderInline(item)}
			</li>
		{/each}
	</ul>
</div>
