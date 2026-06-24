<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import { downloadNotePageExport } from '$lib/notes/export';
	import {
		deleteNotePage,
		duplicateNotePage,
		initializeNotesDb,
		listNotePages,
		loadNotePageById
	} from '$lib/notes/storage';
	import type { NotePageSummary } from '$lib/notes/types';

	let pages = $state<NotePageSummary[]>([]);
	let loading = $state(true);
	let busy = $state('');
	let toast = $state('');
	let query = $state('');

	const filteredPages = $derived(filterPages(pages));

	onMount(() => {
		void refresh();
	});

	async function refresh() {
		loading = true;

		try {
			await initializeNotesDb();
			pages = await listNotePages();
		} finally {
			loading = false;
		}
	}

	function filterPages(source: NotePageSummary[]) {
		const text = query.trim().toLowerCase();
		if (!text) return source;

		return source.filter((page) =>
			[page.title, page.slug, ...page.tags].join(' ').toLowerCase().includes(text)
		);
	}

	async function exportPage(page: NotePageSummary) {
		const fullPage = await loadNotePageById(page.id);
		if (!fullPage) return;

		busy = `export:${page.id}`;
		try {
			await downloadNotePageExport(fullPage);
			showToast(`Exported ${page.title}`);
		} finally {
			busy = '';
		}
	}

	async function duplicate(page: NotePageSummary) {
		busy = `duplicate:${page.id}`;

		try {
			const copy = await duplicateNotePage(page.id);
			showToast(`Duplicated ${page.title}`);
			await refresh();
			await goto(resolve(`/notes/${copy.slug}`));
		} finally {
			busy = '';
		}
	}

	async function remove(page: NotePageSummary) {
		if (!confirm(`Delete "${page.title}"?`)) return;

		busy = `delete:${page.id}`;

		try {
			await deleteNotePage(page.id);
			showToast(`Deleted ${page.title}`);
			await refresh();
		} finally {
			busy = '';
		}
	}

	function showToast(message: string) {
		toast = message;
		window.setTimeout(() => {
			if (toast === message) toast = '';
		}, 2400);
	}

	function formatDate(value: string) {
		return new Intl.DateTimeFormat(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(new Date(value));
	}
</script>

<svelte:head>
	<title>Notes | Adham Zaki</title>
	<meta name="description" content="A local-first document manager on zaki.gg." />
</svelte:head>

<section class="notes-manager">
	<label class="search-field">
		<Icon icon="mdi:magnify" />
		<input type="search" bind:value={query} placeholder="Search pages" aria-label="Search pages" />
	</label>

	{#if loading}
		<p class="empty-state">Loading notes...</p>
	{:else if !filteredPages.length}
		<p class="empty-state">No pages match this search.</p>
	{:else}
		<div class="page-list">
			{#each filteredPages as page (page.id)}
				<article class="page-row">
					<a class="page-main" href={resolve(`/notes/${page.slug}`)}>
						<span class="page-title">{page.title}</span>
						<span class="page-meta">
							/{page.slug} · {formatDate(page.updatedAt)}
							{#if page.wordCount}
								· {page.wordCount} words
							{/if}
							{#if page.assetCount}
								· {page.assetCount} assets
							{/if}
						</span>
						{#if page.tags.length}
							<span class="page-tags">
								{#each page.tags as tag (tag)}
									<span>{tag}</span>
								{/each}
							</span>
						{/if}
					</a>

					<div class="row-actions" aria-label={`${page.title} actions`}>
						<button
							type="button"
							class="icon-button"
							title="Export page"
							aria-label="Export page"
							disabled={busy === `export:${page.id}`}
							onclick={() => void exportPage(page)}
						>
							<Icon icon="mdi:package-down" />
						</button>
						<button
							type="button"
							class="icon-button"
							title="Duplicate page"
							aria-label="Duplicate page"
							disabled={busy === `duplicate:${page.id}`}
							onclick={() => void duplicate(page)}
						>
							<Icon icon="mdi:content-duplicate" />
						</button>
						<button
							type="button"
							class="icon-button danger"
							title="Delete page"
							aria-label="Delete page"
							disabled={busy === `delete:${page.id}`}
							onclick={() => void remove(page)}
						>
							<Icon icon="mdi:trash-can-outline" />
						</button>
					</div>
				</article>
			{/each}
		</div>
	{/if}

	{#if toast}
		<div class="toast" role="status">{toast}</div>
	{/if}
</section>

<style>
	.notes-manager {
		align-content: start;
		display: grid;
		gap: var(--s0);
		margin-inline: auto;
		max-width: 58rem;
		padding: var(--s2) var(--s0) calc(var(--s4) + 5rem);
		width: 100%;
	}

	.search-field,
	.page-row,
	.page-main,
	.page-tags,
	.row-actions {
		display: flex;
	}

	.search-field {
		align-items: center;
		background: var(--base-1);
		border: 1px solid var(--edge);
		border-radius: var(--s-2);
		color: var(--content-1);
		gap: var(--s-3);
		min-height: 2.75rem;
		padding: 0 var(--s-1);
		width: 100%;
	}

	.search-field :global(svg) {
		height: 1.1rem;
		width: 1.1rem;
	}

	input {
		background: transparent;
		border: 0;
		box-shadow: none;
		color: var(--content);
		min-height: 2.5rem;
		min-width: 0;
		padding-inline: 0;
		width: 100%;
	}

	input:focus {
		outline: none;
	}

	.search-field:focus-within {
		border-color: color-mix(in oklch, var(--brand) 52%, var(--edge));
		box-shadow: var(--focus-ring);
	}

	.page-list {
		display: grid;
	}

	.page-row {
		align-items: center;
		border-bottom: 1px solid color-mix(in oklch, var(--edge) 75%, transparent);
		gap: var(--s0);
		justify-content: space-between;
		padding: var(--s-1) 0;
	}

	.page-row:first-child {
		border-top: 1px solid color-mix(in oklch, var(--edge) 75%, transparent);
	}

	.page-main {
		border-radius: var(--s-3);
		color: inherit;
		flex: 1;
		flex-direction: column;
		gap: var(--s-4);
		min-width: 0;
		padding: var(--s-3) var(--s-2);
		text-decoration: none;
	}

	.page-main:hover,
	.page-main:focus-visible {
		background: color-mix(in oklch, var(--brand) 8%, transparent);
		outline: none;
	}

	.page-title {
		font-size: var(--s0);
		font-weight: 720;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.page-meta {
		color: var(--content-1);
		font-size: var(--s-1);
	}

	.page-tags {
		flex-wrap: wrap;
		gap: var(--s-4);
	}

	.page-tags span {
		color: var(--brand);
		font-size: var(--s-1);
		font-weight: 650;
	}

	.row-actions {
		gap: var(--s-3);
	}

	.icon-button {
		align-items: center;
		background: var(--base-1);
		border: 1px solid color-mix(in oklch, var(--edge) 82%, transparent);
		border-radius: var(--s-2);
		color: var(--content);
		display: inline-flex;
		height: 2.25rem;
		justify-content: center;
		transition:
			background-color 0.16s ease,
			border-color 0.16s ease,
			color 0.16s ease,
			transform 0.16s ease;
		width: 2.25rem;
	}

	.icon-button :global(svg) {
		height: 1.1rem;
		width: 1.1rem;
	}

	.icon-button:hover,
	.icon-button:focus-visible {
		background: color-mix(in oklch, var(--brand) 13%, var(--base-1));
		border-color: color-mix(in oklch, var(--brand) 36%, var(--edge));
		color: var(--content);
		transform: translateY(-1px);
	}

	.icon-button.danger:hover,
	.icon-button.danger:focus-visible {
		background: color-mix(in oklch, var(--error) 12%, var(--base-1));
		border-color: color-mix(in oklch, var(--error) 38%, var(--edge));
	}

	.empty-state {
		border: 1px dashed var(--edge-1);
		border-radius: var(--s-2);
		color: var(--content-1);
		padding: var(--s1);
		text-align: center;
	}

	.toast {
		background: var(--content);
		border-radius: var(--s-2);
		bottom: calc(var(--s2) + 4rem);
		color: var(--base);
		font-size: var(--s-1);
		font-weight: 700;
		left: 50%;
		padding: var(--s-2) var(--s0);
		position: fixed;
		transform: translateX(-50%);
		z-index: 1000;
	}

	@media (max-width: 42rem) {
		.page-row {
			align-items: stretch;
			flex-direction: column;
			gap: var(--s-2);
		}

		.row-actions {
			justify-content: flex-start;
			padding-inline: var(--s-2);
		}
	}
</style>
