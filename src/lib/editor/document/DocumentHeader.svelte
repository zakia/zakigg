<script lang="ts">
	import { Temporal } from 'temporal-polyfill';

	type Props = {
		title: string;
		date?: string;
		wordCount?: number;
	};

	let { title, date = '', wordCount }: Props = $props();

	const formattedDate = $derived(formatDate(date));
	const readingTime = $derived(
		typeof wordCount === 'number' ? Math.max(1, Math.ceil(wordCount / 220)) : undefined
	);

	function formatDate(value: string) {
		if (!value) return '';

		try {
			return Temporal.PlainDate.from(value.split('T')[0]).toLocaleString(undefined, {
				month: 'long',
				day: 'numeric',
				year: 'numeric'
			});
		} catch {
			return value;
		}
	}
</script>

<header class="article-header">
	<h1 class="title">{title}</h1>

	{#if formattedDate || readingTime}
		<p class="meta">
			{#if formattedDate}<time datetime={date}>{formattedDate}</time>{/if}
			{#if formattedDate && readingTime}<span aria-hidden="true">·</span>{/if}
			{#if readingTime}<span>{readingTime} min read</span>{/if}
		</p>
	{/if}
</header>

<style>
	.article-header {
		display: grid;
		gap: var(--s-1);
		padding-bottom: var(--s1);
	}

	.title {
		color: var(--content);
		font-size: var(--s3);
		font-weight: 760;
		letter-spacing: -0.035em;
		line-height: 1.08;
		margin: 0;
		text-wrap: balance;
	}

	.meta {
		align-items: center;
		color: var(--content-1);
		display: flex;
		font-size: var(--s-1);
		gap: var(--s-2);
		margin: 0;
	}
</style>
