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

<div class="border-1.5 border-primary bg-bg grid gap-2 rounded-xl p-4 shadow">
	<div class="flex">
		<div class="text-text mr-auto flex w-fit items-center justify-start gap-2 border-b-0">
			<img src={props.icon} alt="icon" class="h-8 w-8 shrink-0" />

			<h3 class="mb-0 font-semibold">
				{props.company}
			</h3>

			<!-- {#if props.link}
				<Icon icon="mdi:external-link" class="w-4 h-4 self-start" />
			{/if} -->
		</div>

		{#if props.positions}
			<div class="pb-2 text-end">
				{#each props.positions as position}
					<div class="grid justify-between text-sm">
						<span class="text-primary font-semibold">{position.role}</span>
						<span class="text-base-6">
							{formatDate(position.startDate)} - {formatDate(position.endDate)}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
	<div>
		{#each props.description as item}
			<div class="relative flex gap-1 not-last:mb-2">
				<Icon icon="fa-solid:dot-circle" class="text-primary mt-1.5 h-3 w-3 shrink-0" />
				<p class="text-base-8">
					{@html md.renderInline(item)}
				</p>
			</div>
		{/each}
	</div>
</div>
