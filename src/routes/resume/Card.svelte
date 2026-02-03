<script lang="ts">
	import Icon from '@iconify/svelte';
	import markdownIt from 'markdown-it';
	import mdAttr from 'markdown-it-attrs';

	type CardProps = {
		icon?: string;
		company: string;
		positions?: {
			role: string;
			startDate: string;
			endDate?: string;
		}[];
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
			year: 'numeric'
		});
	};
</script>

<div class="card bg-base-1 grid gap-s-2 p-s0">
	<div class="flex">
		<div class="text-content mr-auto flex w-fit items-center justify-start gap-s-2 border-b-0">
			<img src={props.icon} alt="icon" class="h-8 w-8 shrink-0" />

			<h3 class="mb-0 font-semibold">
				{props.company}
			</h3>

			<!-- {#if props.link}
				<Icon icon="mdi:external-link" class="w-4 h-4 self-start" />
			{/if} -->
		</div>

		{#if props.positions}
			<div class="pb-s-2 text-end">
				{#each props.positions as position}
					<div class="grid justify-between text-sm">
						<span class="text-brand font-semibold">{position.role}</span>
						<span class="text-content-1">
							{formatDate(position.startDate)} - {formatDate(position.endDate)}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
	<div>
		{#each props.description as item}
			<div class="relative flex gap-s-1 not-last:mb-s-2">
				<Icon icon="fa-solid:dot-circle" class="text-brand mt-1.5 h-3 w-3 shrink-0" />
				<p class="text-content">
					{@html md.renderInline(item)}
				</p>
			</div>
		{/each}
	</div>
</div>
