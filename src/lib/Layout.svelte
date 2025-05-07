<script lang="ts">
	import Icon from '@iconify/svelte';
	import { Temporal } from 'temporal-polyfill';
	import type { Metadata } from '../routes/(crafts)/+page';

	const { title, date, description, children }: Metadata = $props();

	const printDate = (isoDate?: string) => {
		if (!isoDate) return 'Invalid Date';
		return Temporal.PlainDate.from(isoDate.split('T')[0]).toLocaleString(undefined, {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	};
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
</svelte:head>

<section class="mx-auto grid w-full max-w-4xl items-start gap-4">
	<a href="/" class="btn text-primary top-[var(--spacing-top)] w-fit p-0 md:sticky">
		<Icon icon="ep:top-left" />Back
	</a>

	<div class="article grid gap-2 w-full">
		<hgroup>
			<h1 class="heading-3">{title}</h1>
			<time class="text-base-content/50">{printDate(date)}</time>
		</hgroup>

		{@render children?.()}
	</div>
</section>

<style>
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
