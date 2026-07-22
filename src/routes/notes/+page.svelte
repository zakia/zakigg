<script lang="ts">
	import { onMount } from 'svelte';
	import type { JSONContent } from '@tiptap/core';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import { createMetadataBlockContent } from '$lib/notes/metadata-block';
	import { downloadNotePageExport } from '$lib/notes/export';
	import { importNotesFromZip, isNotesArchiveFile } from '$lib/notes/import';
	import {
		createNotePageRecord,
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
	let dragActive = $state(false);
	let fileInput = $state<HTMLInputElement>();
	let dragDepth = 0;

	const filteredPages = $derived(filterPages(pages));

	onMount(() => {
		void refresh();
	});

	async function createNote() {
		busy = 'create';

		try {
			const page = await createNotePageRecord({ content: createNoteContent() });
			await goto(resolve(`/notes/${page.slug}`));
		} finally {
			busy = '';
		}
	}

	function createNoteContent(): JSONContent {
		return {
			type: 'doc',
			content: [
				createMetadataBlockContent({
					title: '',
					slug: '',
					date: new Date().toISOString().slice(0, 10)
				}),
				{ type: 'heading', attrs: { level: 1 } },
				{ type: 'paragraph' }
			]
		};
	}

	function openImportPicker() {
		fileInput?.click();
	}

	function handlePickedImport(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);

		input.value = '';
		void importFiles(files);
	}

	function eventHasFiles(event: DragEvent) {
		return Array.from(event.dataTransfer?.types ?? []).includes('Files');
	}

	function handleDragEnter(event: DragEvent) {
		if (!eventHasFiles(event)) return;

		event.preventDefault();
		dragDepth += 1;
		dragActive = true;
	}

	function handleDragOver(event: DragEvent) {
		if (!eventHasFiles(event)) return;

		event.preventDefault();

		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
	}

	function handleDragLeave() {
		if (!dragActive) return;

		dragDepth -= 1;

		if (dragDepth <= 0) {
			dragDepth = 0;
			dragActive = false;
		}
	}

	async function handleDrop(event: DragEvent) {
		if (!eventHasFiles(event)) return;

		event.preventDefault();
		dragDepth = 0;
		dragActive = false;

		await importFiles(Array.from(event.dataTransfer?.files ?? []));
	}

	async function importFiles(files: File[]) {
		const archives = files.filter(isNotesArchiveFile);

		if (!archives.length) {
			showToast('Drop a .zip note export to import.');
			return;
		}

		busy = 'import';

		try {
			let importedPages = 0;
			let lastSlug = '';

			for (const file of archives) {
				try {
					const result = await importNotesFromZip(file);
					importedPages += result.pages.length;
					lastSlug = result.pages.at(-1)?.slug ?? lastSlug;
				} catch (error) {
					console.error(error);
					showToast(`Could not import ${file.name}`);
				}
			}

			if (!importedPages) return;

			await refresh();
			showToast(`Imported ${importedPages} ${importedPages === 1 ? 'note' : 'notes'}`);

			if (archives.length === 1 && importedPages === 1 && lastSlug) {
				await goto(resolve(`/notes/${lastSlug}`));
			}
		} finally {
			busy = '';
		}
	}

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

<section
	class="notes-manager"
	class:drag-active={dragActive}
	ondragenter={handleDragEnter}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	aria-label="Notes"
>
	<input
		bind:this={fileInput}
		class="import-input"
		type="file"
		accept=".zip,application/zip,application/x-zip-compressed"
		multiple
		onchange={handlePickedImport}
	/>

	<div class="manager-toolbar">
		<label class="search-field">
			<Icon icon="mdi:magnify" />
			<input
				type="search"
				bind:value={query}
				placeholder="Search pages"
				aria-label="Search pages"
			/>
		</label>
		<button
			type="button"
			class="ghost-button"
			disabled={busy === 'import'}
			onclick={openImportPicker}
		>
			<Icon icon="mdi:package-up" />
			Import
		</button>
		<button
			type="button"
			class="new-note-button"
			disabled={busy === 'create'}
			onclick={() => void createNote()}
		>
			<Icon icon="mdi:plus" />
			New note
		</button>
	</div>

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

	{#if dragActive}
		<div class="drop-overlay" aria-hidden="true">
			<div class="drop-overlay-card">
				<Icon icon="mdi:package-down" />
				<span>Drop a note export to import</span>
			</div>
		</div>
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
		position: relative;
		width: 100%;
	}

	.import-input {
		display: none;
	}

	.manager-toolbar,
	.search-field,
	.page-row,
	.page-main,
	.page-tags,
	.row-actions {
		display: flex;
	}

	.manager-toolbar {
		align-items: center;
		gap: var(--s-1);
	}

	.search-field {
		align-items: center;
		background: var(--base-1);
		border: 1px solid var(--edge);
		border-radius: var(--s-2);
		color: var(--content-1);
		flex: 1;
		gap: var(--s-3);
		min-height: 2.75rem;
		min-width: 0;
		padding: 0 var(--s-1);
		width: 100%;
	}

	.new-note-button {
		align-items: center;
		background: var(--brand);
		border: 1px solid transparent;
		border-radius: var(--s-2);
		color: var(--brand-content);
		display: inline-flex;
		flex-shrink: 0;
		font-weight: 700;
		gap: var(--s-3);
		min-height: 2.75rem;
		padding: 0 var(--s0);
		transition:
			filter 0.16s ease,
			transform 0.16s ease;
		white-space: nowrap;
	}

	.new-note-button:hover,
	.new-note-button:focus-visible {
		filter: brightness(1.05);
		outline: none;
		transform: translateY(-1px);
	}

	.new-note-button:disabled {
		cursor: default;
		opacity: 0.6;
		transform: none;
	}

	.new-note-button :global(svg) {
		height: 1.1rem;
		width: 1.1rem;
	}

	.ghost-button {
		align-items: center;
		background: var(--base-1);
		border: 1px solid color-mix(in oklch, var(--edge) 82%, transparent);
		border-radius: var(--s-2);
		color: var(--content);
		display: inline-flex;
		flex-shrink: 0;
		font-weight: 700;
		gap: var(--s-3);
		min-height: 2.75rem;
		padding: 0 var(--s0);
		transition:
			background-color 0.16s ease,
			border-color 0.16s ease,
			transform 0.16s ease;
		white-space: nowrap;
	}

	.ghost-button:hover,
	.ghost-button:focus-visible {
		background: color-mix(in oklch, var(--brand) 13%, var(--base-1));
		border-color: color-mix(in oklch, var(--brand) 36%, var(--edge));
		outline: none;
		transform: translateY(-1px);
	}

	.ghost-button:disabled {
		cursor: default;
		opacity: 0.6;
		transform: none;
	}

	.ghost-button :global(svg) {
		height: 1.1rem;
		width: 1.1rem;
	}

	.drop-overlay {
		align-items: center;
		background: color-mix(in oklch, var(--base) 55%, transparent);
		backdrop-filter: blur(2px);
		border: 2px dashed color-mix(in oklch, var(--brand) 60%, var(--edge));
		border-radius: var(--s-1);
		display: flex;
		inset: var(--s0);
		justify-content: center;
		pointer-events: none;
		position: absolute;
		z-index: 1100;
	}

	.drop-overlay-card {
		align-items: center;
		background: var(--base-1);
		border: 1px solid var(--edge);
		border-radius: var(--s-2);
		box-shadow: 0 12px 30px rgb(0 0 0 / 0.12);
		color: var(--content);
		display: flex;
		font-weight: 700;
		gap: var(--s-2);
		padding: var(--s0) var(--s1);
	}

	.drop-overlay-card :global(svg) {
		color: var(--brand);
		height: 1.4rem;
		width: 1.4rem;
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
