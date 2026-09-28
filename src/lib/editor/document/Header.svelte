<script lang="ts">
	import { resolve } from '$app/paths';
	import Tag from '$lib/components/Tag.svelte';
	import { Temporal } from 'temporal-polyfill';

	type Props = {
		title: string;
		date?: string;
		wordCount?: number;
		tags?: string[];
	};

	let { title, date = '', wordCount, tags = [] }: Props = $props();

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
	{#if tags.length}
		<div class="article-tags" aria-label="Tags">
			{#each tags as tag (tag)}
				<!-- Resolve the pathname before appending the encoded query. -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={`${resolve('/crafts')}?tag=${encodeURIComponent(tag)}`}
					aria-label={`More crafts tagged ${tag}`}><Tag name={tag} /></a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/each}
		</div>
	{/if}
</header>

<style>
	.article-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}
	.article-tags a {
		display: inline-flex;
		text-decoration: none;
		border-radius: 999px;
	}
	.article-tags a:hover {
		filter: brightness(1.1);
	}
	.article-tags a:focus-visible {
		outline: 2px solid var(--brand);
		outline-offset: 2px;
	}

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
