<script module lang="ts">
	import * as v from 'valibot';
	import type { ComponentEmbedConfig } from '$lib/editor/component-embeds';

	export const overflowTogglePropsSchema = v.object({});

	export const overflowToggleEmbed = {
		id: 'carousels.OverflowToggle',
		label: 'Overflow Toggle',
		icon: 'mdi:toggle-switch-outline',
		props: overflowTogglePropsSchema,
		crafts: ['carousels']
	} satisfies ComponentEmbedConfig<typeof overflowTogglePropsSchema>;
</script>

<script lang="ts">
	import Toggle from '$lib/components/Toggle.svelte';
	import { useScrollingTabs } from './Tabs.svelte';

	const tabs = useScrollingTabs();
</script>

<div class="overflow-toggle">
	<code class="overflow-label">overflow:</code>
	<code class:saturate-25={tabs.isTrigger}>auto</code>
	<Toggle bind:checked={tabs.isTrigger}></Toggle>
	<code class:saturate-25={!tabs.isTrigger}>hidden</code>
</div>

<style>
	.overflow-toggle {
		align-items: center;
		display: flex;
		gap: var(--s-3);
		margin-block: var(--s0);
	}

	.overflow-label {
		margin-right: var(--s-3);
	}
</style>
