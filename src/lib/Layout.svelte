<script lang="ts">
	import Icon from '@iconify/svelte';
	import { Temporal } from 'temporal-polyfill';
	import type { Metadata } from '../routes/crafts/+page';

	const { title, date, description }: Metadata = $props();

	const printDate = (isoDate?: string) => {
		if (!isoDate) return 'Invalid Date';
		return Temporal.PlainDate.from(isoDate.split('T')[0]).toLocaleString(undefined, {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	};
</script>

<section class="grid gap-4 w-full items-start mx-auto max-w-4xl">
	<a href="/crafts" class="btn w-fit p-0 text-primary md:sticky top-[var(--spacing-top)]">
		<Icon icon="ep:top-left" />Back
	</a>

	<div class="grid gap-4">
		<hgroup>
			<h1 class="heading-3">{title}</h1>
			<time class="text-content-1">{printDate(date)}</time>
		</hgroup>

		<slot />
	</div>
</section>

<style scoped>
	section {
		--spacing-top: 5rem;
		display: grid;
		padding-top: var(--spacing-top);
		padding-inline: 1rem;
		grid-template-columns: 100px 1fr 100px;

		@media (max-width: 768px) {
			grid-template-columns: 1fr;
			padding-top: calc(var(--spacing-top) / 2);
		}
	}
</style>
