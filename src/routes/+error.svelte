<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { page } from '$app/state';
	import { crafts } from '$lib/crafts/registry';

	const status = $derived(page.status);
	const message = $derived(page.error?.message ?? '');

	const attempted = $derived(page.url.pathname.replace(/^\/+/, '').split('/')[0] ?? '');

	function editDistance(a: string, b: string): number {
		if (!a) return b.length;
		if (!b) return a.length;
		const m = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
		for (let i = 0; i <= a.length; i++) m[i][0] = i;
		for (let j = 0; j <= b.length; j++) m[0][j] = j;
		for (let i = 1; i <= a.length; i++) {
			for (let j = 1; j <= b.length; j++) {
				const cost = a[i - 1] === b[j - 1] ? 0 : 1;
				m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
			}
		}
		return m[a.length][b.length];
	}

	const suggestion = $derived.by(() => {
		if (status !== 404 || !attempted) return null;
		let best: { slug: string; title: string; distance: number } | null = null;
		for (const c of crafts) {
			if (c.draft) continue;
			const distance = editDistance(attempted.toLowerCase(), c.slug.toLowerCase());
			if (!best || distance < best.distance) {
				best = { slug: c.slug, title: c.title, distance };
			}
		}
		const threshold = Math.max(2, Math.floor(attempted.length / 3));
		return best && best.distance <= threshold ? best : null;
	});

	const headline = $derived.by(() => {
		if (status === 404) return 'Page not found';
		if (status >= 500) return 'Something broke';
		if (status >= 400) return 'Request failed';
		return 'Error';
	});
</script>

<svelte:head>
	<title>{status} — {headline}</title>
</svelte:head>

<section class="layout gap-s0 error">
	<div class="status">{status}</div>

	<h1 class="headline">{headline}</h1>

	{#if message && message !== headline}
		<p class="message">{message}</p>
	{:else if status === 404}
		<p class="message">
			The page <code>{page.url.pathname}</code> doesn't exist, or has moved.
		</p>
	{/if}

	{#if suggestion}
		<p class="suggestion">
			Did you mean
			<a href={`/crafts/${suggestion.slug}`} class="text-brand">{suggestion.title}</a>?
		</p>
	{/if}

	<div class="actions">
		<a href="/crafts" class="btn variant-primary">
			<Icon icon="mdi:arrow-left" />
			Browse crafts
		</a>
		<a href="/" class="btn variant-base">
			<Icon icon="mdi:home" />
			Home
		</a>
	</div>
</section>

<style>
	.error {
		place-items: center;
		text-align: center;
		min-height: 60vh;
		align-content: center;
	}

	.status {
		font-family: var(--font-mono, monospace);
		font-size: clamp(4rem, 18vw, 10rem);
		line-height: 1;
		font-weight: 600;
		color: color-mix(in oklch, var(--brand) 80%, var(--content));
		letter-spacing: -0.05em;
		user-select: none;
	}

	.headline {
		font-size: var(--s2);
		margin: 0;
	}

	.message {
		color: color-mix(in oklch, var(--content) 70%, transparent);
		max-width: 40ch;
	}

	.message code {
		font-family: var(--font-mono, monospace);
		font-size: 0.9em;
		padding: 0.1em 0.35em;
		border-radius: 4px;
		background: color-mix(in oklch, var(--content) 10%, transparent);
	}

	.suggestion {
		color: color-mix(in oklch, var(--content) 80%, transparent);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1);
		justify-content: center;
		margin-top: var(--s0);
	}
</style>
