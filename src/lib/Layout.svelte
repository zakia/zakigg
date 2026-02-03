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

<section class="gap-s0 mx-auto grid w-full items-start">
	<a href="/" class="btn text-brand top-(--vertical-spacing) w-fit p-0 md:sticky">
		<Icon icon="ep:top-left" />Back
	</a>

	<article>
		<hgroup>
			<h1 class="text-s1">{title}</h1>
			<time class="text-content-1">{printDate(date)}</time>
		</hgroup>

		{@render children?.()}
	</article>
</section>

<style>
	section {
		--vertical-spacing: var(--s3);
		max-width: 880px;
		display: grid;
		padding-top: var(--vertical-spacing);
		padding-bottom: calc(var(--vertical-spacing) * 3);
		padding-inline: var(--s0);
		grid-template-columns: 100px 1fr 100px;

		@media (max-width: 768px) {
			grid-template-columns: 1fr;
			padding-top: calc(var(--vertical-spacing) / 2);
			padding-bottom: calc(var(--vertical-spacing) * 2);
		}
	}
</style>
