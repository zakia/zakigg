<script lang="ts">
	import type { YoutubeEmbedViewState } from './youtube-view-state.svelte';

	let { state }: { state: YoutubeEmbedViewState } = $props();

	const embedUrl = $derived(
		`https://www.youtube-nocookie.com/embed/${encodeURIComponent(state.id)}`
	);
</script>

<figure class="youtube-embed" data-youtube-embed-view>
	<div class="youtube-embed__header">
		<div>
			<span class="youtube-embed__eyebrow">Inline component</span>
			<strong>YoutubeEmbed</strong>
		</div>
		<code>id=&quot;{state.id}&quot;</code>
	</div>
	<div class="youtube-embed__frame">
		<iframe
			title="YouTube video {state.id}"
			src={embedUrl}
			allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
			allowfullscreen
		></iframe>
	</div>
</figure>

<style>
	.youtube-embed {
		background: color-mix(in oklch, var(--base-1) 94%, var(--brand) 6%);
		border: 1px solid color-mix(in oklch, var(--edge) 82%, var(--brand) 18%);
		border-radius: var(--radius);
		margin: var(--s1) 0;
		overflow: hidden;
	}

	.youtube-embed__header {
		align-items: center;
		display: flex;
		gap: var(--s0);
		justify-content: space-between;
		padding: var(--s-1) var(--s0);
	}

	.youtube-embed__header > div {
		display: grid;
		gap: var(--s-5);
	}

	.youtube-embed__eyebrow {
		color: var(--brand);
		font-size: var(--s-2);
		font-weight: 750;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.youtube-embed__header code {
		background: var(--base-2);
		border-radius: var(--s-4);
		color: var(--content-1);
		font-family: var(--font-mono);
		font-size: var(--s-1);
		padding: var(--s-3) var(--s-2);
	}

	.youtube-embed__frame {
		aspect-ratio: 16 / 9;
		background: var(--base-2);
	}

	iframe {
		border: 0;
		display: block;
		height: 100%;
		width: 100%;
	}

	@media (max-width: 36rem) {
		.youtube-embed__header {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
