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

<div class="grid border-1.5 border-primary gap-2 p-4 rounded-xl shadow bg-base-200">
	<div class="flex">
		<div class="flex items-center justify-start gap-2 text-base-content border-b-0 w-fit mr-auto">
			<img src={props.icon} alt="icon" class="w-8 h-8 shrink-0" />

			<h3 class="font-semibold mb-0">
				{props.company}
			</h3>

			<!-- {#if props.link}
				<Icon icon="mdi:external-link" class="w-4 h-4 self-start" />
			{/if} -->
		</div>

		{#if props.positions}
			<div class="text-end pb-2">
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
				<Icon icon="fa-solid:dot-circle" class="text-primary w-3 h-3 shrink-0 mt-1.5" />
				<p class="text-base-8">
					{@html md.renderInline(item)}
				</p>
			</div>
		{/each}
	</div>
</div>
