<script lang="ts">
	import { onMount } from 'svelte';
	import type { JSONContent } from '@tiptap/core';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import SyncControls from '$lib/notes/sync/SyncControls.svelte';
	import { downloadNotePageExport } from '$lib/notes/export';
	import { importNotesFromZip, isNotesArchiveFile } from '$lib/notes/import';
	import { importCraftsToNotes } from '$lib/notes/import-crafts';
	import {
		createNotePageRecord,
		deleteNotePage,
		duplicateNotePage,
		initializeNotesDb,
		listNotePages,
		loadNotePageById
	} from '$lib/notes/storage';
	import type { NotePageSummary } from '$lib/notes/types';

	type YearGroup = {
		year: number;
		pages: NotePageSummary[];
	};

	const READING_WORDS_PER_MINUTE = 200;

	let pages = $state<NotePageSummary[]>([]);
	let loading = $state(true);
	let busy = $state('');
	let toast = $state('');
	let query = $state('');
	let dragActive = $state(false);
	let fileInput = $state<HTMLInputElement>();
	let dragDepth = 0;

	const filteredPages = $derived(filterPages(pages));
	const yearGroups = $derived(groupPagesByYear(filteredPages));

	onMount(() => {
		void refresh();
	});

	async function createNote() {
		busy = 'create';

		try {
			const page = await createNotePageRecord({
				content: createNoteContent(),
				properties: [{ key: 'date', value: new Date().toISOString().slice(0, 10) }]
			});
			await goto(resolve(`/notes/${page.slug}`));
		} finally {
			busy = '';
		}
	}

	function createNoteContent(): JSONContent {
		return {
			type: 'doc',
			content: [{ type: 'heading', attrs: { level: 1 } }, { type: 'paragraph' }]
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

	async function importCrafts() {
		busy = 'import-crafts';

		try {
			const result = await importCraftsToNotes();

			if (result.imported.length) await refresh();

			showToast(
				result.imported.length
					? `Imported ${result.imported.length} craft${result.imported.length === 1 ? '' : 's'}`
					: 'No new crafts to import'
			);
		} catch (error) {
			console.error(error);
			showToast('Could not import crafts');
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

	// The document date (metadata `date` property) drives ordering and
	// grouping — imported historical posts sit under their original year, not
	// the year they were last touched.
	function groupPagesByYear(source: NotePageSummary[]) {
		const sorted = [...source].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
		const groups: YearGroup[] = [];

		for (const page of sorted) {
			const year = pageYear(page);
			const current = groups.at(-1);

			if (current?.year === year) current.pages.push(page);
			else groups.push({ year, pages: [page] });
		}

		return groups;
	}

	// Date-only values (`2024-03-16`) parse as UTC midnight; formatting them
	// in the local timezone would shift them back a day west of UTC.
	function isDateOnly(value: string) {
		return /^\d{4}-\d{2}-\d{2}$/.test(value);
	}

	function pageYear(page: NotePageSummary) {
		const date = new Date(page.date);

		return isDateOnly(page.date) ? date.getUTCFullYear() : date.getFullYear();
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

	function formatDay(page: NotePageSummary) {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			...(isDateOnly(page.date) ? { timeZone: 'UTC' } : {})
		}).format(new Date(page.date));
	}

	function readingMinutes(page: NotePageSummary) {
		if (!page.wordCount) return 0;

		return Math.max(1, Math.round(page.wordCount / READING_WORDS_PER_MINUTE));
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
			<input type="search" bind:value={query} placeholder="Search" aria-label="Search pages" />
		</label>
		<button
			type="button"
			class="quiet-button"
			title="Import note export"
			aria-label="Import note export"
			disabled={busy === 'import'}
			onclick={openImportPicker}
		>
			<Icon icon="mdi:package-up" />
		</button>
		<button
			type="button"
			class="quiet-button"
			title="Import craft posts"
			aria-label="Import craft posts"
			disabled={busy === 'import-crafts'}
			onclick={() => void importCrafts()}
		>
			<Icon icon="mdi:script-text-outline" />
		</button>
		<button
			type="button"
			class="quiet-button new-note-button"
			disabled={busy === 'create'}
			onclick={() => void createNote()}
		>
			<Icon icon="mdi:plus" />
			New
		</button>
		<SyncControls />
	</div>

	{#if loading}
		<p class="empty-state">Loading notes...</p>
	{:else if !filteredPages.length}
		<p class="empty-state">No pages match this search.</p>
	{:else}
		{#each yearGroups as group (group.year)}
			<div class="year-group">
				<span class="year-ghost" aria-hidden="true">{group.year}</span>
				<ul class="year-list">
					{#each group.pages as page (page.id)}
						<li class="page-row">
							<a class="page-link" href={resolve(`/notes/${page.slug}`)}>
								<span class="page-title">{page.title}</span>
								<span class="page-meta">
									{formatDay(page)}
									{#if readingMinutes(page)}
										<span class="meta-dot">·</span>
										{readingMinutes(page)}min
									{/if}
								</span>
							</a>

							<span class="row-actions">
								<button
									type="button"
									class="row-action"
									title="Export page"
									aria-label={`Export ${page.title}`}
									disabled={busy === `export:${page.id}`}
									onclick={() => void exportPage(page)}
								>
									<Icon icon="mdi:package-down" />
								</button>
								<button
									type="button"
									class="row-action"
									title="Duplicate page"
									aria-label={`Duplicate ${page.title}`}
									disabled={busy === `duplicate:${page.id}`}
									onclick={() => void duplicate(page)}
								>
									<Icon icon="mdi:content-duplicate" />
								</button>
								<button
									type="button"
									class="row-action danger"
									title="Delete page"
									aria-label={`Delete ${page.title}`}
									disabled={busy === `delete:${page.id}`}
									onclick={() => void remove(page)}
								>
									<Icon icon="mdi:trash-can-outline" />
								</button>
							</span>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
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
		margin-inline: auto;
		max-width: 44rem;
		padding: var(--s2) var(--s0) calc(var(--s4) + 5rem);
		position: relative;
		width: 100%;
	}

	.import-input {
		display: none;
	}

	.manager-toolbar {
		align-items: center;
		display: flex;
		gap: var(--s-3);
	}

	.search-field {
		align-items: center;
		border-radius: var(--s-3);
		color: color-mix(in oklch, var(--content-1) 72%, transparent);
		display: flex;
		flex: 1;
		gap: var(--s-3);
		min-height: 2.25rem;
		min-width: 0;
		padding: 0 var(--s-3);
		transition: color 0.16s ease;
	}

	.search-field:focus-within {
		color: var(--content-1);
	}

	.search-field :global(svg) {
		flex-shrink: 0;
		height: 1rem;
		width: 1rem;
	}

	input[type='search'] {
		background: transparent;
		border: 0;
		box-shadow: none;
		color: var(--content);
		min-height: 2.25rem;
		min-width: 0;
		padding-inline: 0;
		width: 100%;
	}

	input[type='search']:focus {
		outline: none;
	}

	.quiet-button {
		align-items: center;
		background: transparent;
		border: 0;
		border-radius: var(--s-3);
		color: var(--content-1);
		display: inline-flex;
		flex-shrink: 0;
		font-size: var(--s-1);
		font-weight: 650;
		gap: var(--s-4);
		justify-content: center;
		min-height: 2.25rem;
		min-width: 2.25rem;
		padding: 0 var(--s-3);
		transition:
			background-color 0.16s ease,
			color 0.16s ease;
		white-space: nowrap;
	}

	.quiet-button:hover,
	.quiet-button:focus-visible {
		background: color-mix(in oklch, var(--content) 7%, transparent);
		color: var(--content);
		outline: none;
	}

	.quiet-button:disabled {
		cursor: default;
		opacity: 0.5;
	}

	.quiet-button :global(svg) {
		height: 1.05rem;
		width: 1.05rem;
	}

	.year-group {
		padding-top: 3.4rem;
		position: relative;
	}

	.year-ghost {
		color: transparent;
		font-size: clamp(4.6rem, 13vw, 7.5rem);
		font-weight: 800;
		left: -0.03em;
		letter-spacing: -0.02em;
		line-height: 1;
		pointer-events: none;
		position: absolute;
		top: 0;
		user-select: none;
		-webkit-text-stroke: 2px color-mix(in oklch, var(--content) 11%, transparent);
	}

	@supports not (-webkit-text-stroke: 2px black) {
		.year-ghost {
			color: color-mix(in oklch, var(--content) 6%, transparent);
		}
	}

	.year-list {
		display: grid;
		list-style: none;
		margin: 0;
		padding: 1.9rem 0 0;
		position: relative;
	}

	.page-row {
		align-items: baseline;
		display: flex;
		gap: var(--s-2);
	}

	.page-link {
		align-items: baseline;
		border-radius: var(--s-4);
		color: color-mix(in oklch, var(--content) 78%, transparent);
		display: flex;
		gap: var(--s-2);
		min-width: 0;
		padding: var(--s-3) 0;
		text-decoration: none;
		transition: color 0.16s ease;
	}

	.page-link:hover,
	.page-link:focus-visible {
		color: var(--content);
		outline: none;
	}

	.page-title {
		font-size: var(--s0);
		font-weight: 560;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.page-meta {
		color: color-mix(in oklch, var(--content-1) 78%, transparent);
		flex-shrink: 0;
		font-size: var(--s-1);
		white-space: nowrap;
	}

	.meta-dot {
		opacity: 0.6;
		padding-inline: 0.1em;
	}

	.row-actions {
		align-items: center;
		align-self: center;
		display: flex;
		gap: var(--s-5);
		margin-left: auto;
		opacity: 0;
		transition: opacity 0.16s ease;
	}

	.page-row:hover .row-actions,
	.page-row:focus-within .row-actions {
		opacity: 1;
	}

	@media (hover: none) {
		.row-actions {
			opacity: 1;
		}
	}

	.row-action {
		align-items: center;
		background: transparent;
		border: 0;
		border-radius: var(--s-4);
		color: color-mix(in oklch, var(--content-1) 82%, transparent);
		display: inline-flex;
		height: 1.9rem;
		justify-content: center;
		transition:
			background-color 0.16s ease,
			color 0.16s ease;
		width: 1.9rem;
	}

	.row-action :global(svg) {
		height: 1rem;
		width: 1rem;
	}

	.row-action:hover,
	.row-action:focus-visible {
		background: color-mix(in oklch, var(--content) 8%, transparent);
		color: var(--content);
		outline: none;
	}

	.row-action.danger:hover,
	.row-action.danger:focus-visible {
		background: color-mix(in oklch, var(--error) 12%, transparent);
		color: var(--error);
	}

	.row-action:disabled {
		cursor: default;
		opacity: 0.5;
	}

	.empty-state {
		color: var(--content-1);
		margin-top: var(--s2);
		text-align: center;
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
		.page-link {
			flex-direction: column;
			gap: var(--s-5);
		}
	}
</style>
