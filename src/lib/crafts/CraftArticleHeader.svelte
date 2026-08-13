<script lang="ts">
	import { Temporal } from 'temporal-polyfill';

	type Props = {
		title: string;
		description?: string;
		date?: string;
		wordCount?: number;
		editable?: boolean;
		onTitleChange?: (value: string) => void;
		onDescriptionChange?: (value: string) => void;
	};

	let {
		title,
		description = '',
		date = '',
		wordCount,
		editable = false,
		onTitleChange,
		onDescriptionChange
	}: Props = $props();

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

<header class="article-header" class:editable>
	{#if editable}
		<textarea
			class="title"
			value={title}
			oninput={(event) => onTitleChange?.(event.currentTarget.value)}
			placeholder="Untitled"
			aria-label="Craft title"
			rows="1"
		></textarea>
		<textarea
			class="description"
			value={description}
			oninput={(event) => onDescriptionChange?.(event.currentTarget.value)}
			placeholder="Add a short description…"
			aria-label="Craft description"
			rows="2"
		></textarea>
	{:else}
		<h1 class="title">{title}</h1>
		{#if description}<p class="description">{description}</p>{/if}
	{/if}

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
		gap: var(--s-2);
		padding-bottom: var(--s2);
	}

	.title,
	.description {
		background: transparent;
		border: 0;
		color: var(--content);
		font: inherit;
		margin: 0;
		padding: 0;
		width: 100%;
	}

	.title {
		font-size: var(--s3);
		font-weight: 760;
		letter-spacing: -0.035em;
		line-height: 1.08;
		text-wrap: balance;
	}

	textarea.title,
	textarea.description {
		field-sizing: content;
		resize: none;
	}

	textarea.title {
		min-height: 1.08em;
	}

	.description {
		color: var(--content-1);
		font-size: var(--s1);
		line-height: 1.45;
		max-width: 38rem;
		text-wrap: pretty;
	}

	textarea.description {
		min-height: 2.9em;
	}

	.meta {
		align-items: center;
		color: var(--content-1);
		display: flex;
		font-size: var(--s-1);
		gap: var(--s-2);
		margin: var(--s-2) 0 0;
	}

	.editable :is(.title, .description):focus {
		outline: none;
	}

	.editable :is(.title, .description)::placeholder {
		color: color-mix(in oklch, var(--content-1) 55%, transparent);
	}
</style>
