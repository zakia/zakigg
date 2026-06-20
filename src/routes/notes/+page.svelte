<script lang="ts">
	import RichNoteEditor from '$lib/notes/RichNoteEditor.svelte';
</script>

<svelte:head>
	<title>Notes | Adham Zaki</title>
	<meta name="description" content="A local-first scratch pad on zaki.gg." />
</svelte:head>

<section class="notes-page">
	<header class="notes-header">
		<div>
			<p class="eyebrow">Scratch Pad</p>
			<h1>Notes</h1>
		</div>
	</header>

	<RichNoteEditor />
</section>

<style>
	.notes-page {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--s0);
		margin-inline: auto;
		max-width: 58rem;
		padding: var(--s1) var(--s0) calc(var(--s4) + 4rem);
		width: min(100%, 58rem);
	}

	.notes-header {
		align-items: end;
		display: flex;
		justify-content: space-between;
	}

	.eyebrow {
		color: var(--content-1);
		font-size: var(--s-1);
		font-weight: 700;
		letter-spacing: 0;
		text-transform: uppercase;
	}

	h1 {
		font-size: var(--s3);
		font-weight: 820;
		line-height: 1.05;
	}

	@media (max-width: 42rem) {
		.notes-page {
			padding-inline: var(--s-1);
		}
	}
</style>
