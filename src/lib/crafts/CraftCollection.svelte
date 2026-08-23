<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { JSONContent } from '@tiptap/core';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import { componentEmbeds } from '$lib/embeds';
	import { unpublishNoteCraft } from '$lib/crafts/publication.remote';
	import SyncControls from '$lib/editor/document/sync/SyncControls.svelte';
	import {
		createNotePageRecord,
		deleteNotePage,
		downloadNotePagesExport,
		importDocumentFiles,
		initializeNotesDb,
		listNotePages,
		loadNotePageById
	} from '$lib/editor/document';
	import type { CraftListItem } from './types';

	type YearGroup = {
		year: number;
		pages: CraftListItem[];
	};

	const READING_WORDS_PER_MINUTE = 200;

	let {
		initialCrafts = [],
		editable = false,
		showEditLink = false,
		pending = false,
		loadError = false,
		onRetry
	}: {
		initialCrafts?: CraftListItem[];
		editable?: boolean;
		showEditLink?: boolean;
		pending?: boolean;
		loadError?: boolean;
		onRetry?: () => void;
	} = $props();

	let pages = $state<CraftListItem[]>(untrack(() => initialCrafts));
	let loading = $state(untrack(() => editable));
	let busy = $state('');
	let toast = $state('');
	let query = $state('');
	let dragActive = $state(false);
	let selectionMode = $state(false);
	let selectedIds = $state(new Set<string>());
	let dragDepth = 0;

	const filteredPages = $derived(filterPages(pages));
	const yearGroups = $derived(groupPagesByYear(filteredPages));
	const editCollectionHref = `${resolve('/crafts')}?edit`;

	onMount(() => {
		if (editable) void refresh();
	});

	async function createCraft() {
		busy = 'create';

		try {
			const page = await createNotePageRecord({
				content: createCraftContent(),
				properties: [{ key: 'date', value: new Date().toISOString().slice(0, 10) }]
			});
			await goto(craftHref(page.slug, true));
		} finally {
			busy = '';
		}
	}

	function createCraftContent(): JSONContent {
		return {
			type: 'doc',
			content: [{ type: 'heading', attrs: { level: 1 } }, { type: 'paragraph' }]
		};
	}

	function eventHasFiles(event: DragEvent) {
		return Array.from(event.dataTransfer?.types ?? []).includes('Files');
	}

	function handleDragEnter(event: DragEvent) {
		if (!editable || !eventHasFiles(event)) return;

		event.preventDefault();
		dragDepth += 1;
		dragActive = true;
	}

	function handleDragOver(event: DragEvent) {
		if (!editable || !eventHasFiles(event)) return;

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
		if (!editable || !eventHasFiles(event)) return;

		event.preventDefault();
		dragDepth = 0;
		dragActive = false;

		await importFiles(Array.from(event.dataTransfer?.files ?? []));
	}

	async function importFiles(files: File[]) {
		busy = 'import';

		try {
			const result = await importDocumentFiles(files, componentEmbeds);
			const importedPages = result.pages.length;
			if (!importedPages) {
				showToast('No supported craft files found.');
				return;
			}

			await refresh();
			showToast(
				`Created ${importedPages} ${importedPages === 1 ? 'craft' : 'crafts'}${result.failed.length ? ` · ${result.failed.length} skipped` : ''}`
			);

			if (importedPages === 1) {
				await goto(craftHref(result.pages[0].slug, true));
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

	function filterPages(source: CraftListItem[]) {
		const text = query.trim().toLowerCase();
		if (!text) return source;

		return source.filter((page) =>
			[page.title, page.slug, ...page.tags].join(' ').toLowerCase().includes(text)
		);
	}

	// The document date (metadata `date` property) drives ordering and
	// grouping — imported historical posts sit under their original year, not
	// the year they were last touched.
	function groupPagesByYear(source: CraftListItem[]) {
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

	function pageYear(page: CraftListItem) {
		const date = new Date(page.date);

		return isDateOnly(page.date) ? date.getUTCFullYear() : date.getFullYear();
	}

	function toggleSelection(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function enterSelectionMode() {
		selectionMode = true;
		selectedIds = new Set();
	}

	function leaveSelectionMode() {
		selectionMode = false;
		selectedIds = new Set();
	}

	function selectAllVisible() {
		const visibleIds = filteredPages.map((page) => page.id);
		const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
		const next = new Set(selectedIds);
		for (const id of visibleIds) allSelected ? next.delete(id) : next.add(id);
		selectedIds = next;
	}

	async function exportSelected() {
		if (!selectedIds.size) return;
		busy = 'export';

		try {
			const selectedPages = (
				await Promise.all([...selectedIds].map((id) => loadNotePageById(id)))
			).filter((page) => page !== null);
			await downloadNotePagesExport(selectedPages);
			showToast(
				`Exported ${selectedPages.length} ${selectedPages.length === 1 ? 'craft' : 'crafts'}`
			);
		} finally {
			busy = '';
		}
	}

	async function deleteSelected() {
		const count = selectedIds.size;
		if (
			!count ||
			!confirm(
				`Delete ${count} selected ${count === 1 ? 'craft' : 'crafts'}? Published copies will also be removed.`
			)
		)
			return;

		busy = 'delete';
		try {
			for (const id of selectedIds) {
				await unpublishNoteCraft(id);
				await deleteNotePage(id);
			}
			leaveSelectionMode();
			await refresh();
			showToast(`Deleted ${count} ${count === 1 ? 'craft' : 'crafts'}`);
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

	function formatDay(page: CraftListItem) {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			...(isDateOnly(page.date) ? { timeZone: 'UTC' } : {})
		}).format(new Date(page.date));
	}

	function readingMinutes(page: CraftListItem) {
		if (!page.wordCount) return 0;

		return Math.max(1, Math.round(page.wordCount / READING_WORDS_PER_MINUTE));
	}

	function craftHref(slug: string, edit = false) {
		const pathname = resolve('/crafts/[slug]', { slug });
		return edit ? `${pathname}?edit` : pathname;
	}
</script>

<section
	class="craft-collection"
	class:editable
	class:drag-active={dragActive}
	ondragenter={handleDragEnter}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	aria-label={editable ? 'Manage crafts' : 'Crafts'}
>
	<header class="collection-header">
		<h1>Crafts</h1>
		{#if editable}
			<a class="mode-link" href={resolve('/crafts')}>Done</a>
		{:else if showEditLink}
			<a class="mode-link" href={editCollectionHref}>
				<Icon icon="mdi:pencil-outline" /> Edit
			</a>
		{/if}
	</header>

	<div class="manager-toolbar">
		<label class="search-field" class:disabled={pending || loadError}>
			<Icon icon="mdi:magnify" />
			<input
				type="search"
				bind:value={query}
				placeholder="Search"
				aria-label="Search crafts"
				disabled={pending || loadError}
			/>
		</label>
		{#if editable && selectionMode}
			<span class="selection-count">{selectedIds.size} selected</span>
			<button type="button" class="quiet-button" onclick={selectAllVisible}>
				{filteredPages.length > 0 && filteredPages.every((page) => selectedIds.has(page.id))
					? 'None'
					: 'All'}
			</button>
			<button
				type="button"
				class="quiet-button"
				disabled={!selectedIds.size || Boolean(busy)}
				onclick={() => void exportSelected()}
			>
				<Icon icon="mdi:download-outline" />
				Download
			</button>
			<button
				type="button"
				class="quiet-button danger"
				disabled={!selectedIds.size || Boolean(busy)}
				onclick={() => void deleteSelected()}
			>
				<Icon icon="mdi:trash-can-outline" />
				Delete
			</button>
			<button type="button" class="quiet-button" onclick={leaveSelectionMode}>Cancel</button>
		{:else if editable}
			<button type="button" class="quiet-button" onclick={enterSelectionMode}>Select</button>
			<button
				type="button"
				class="quiet-button new-craft-button"
				disabled={busy === 'create'}
				onclick={() => void createCraft()}
			>
				<Icon icon="mdi:plus" />
				New
			</button>
			<SyncControls />
		{/if}
	</div>

	{#if pending}
		<div class="collection-pending" role="status" aria-label="Loading crafts">
			{#each Array(6) as _, index}
				<div class="pending-row" style={`--pending-width: ${88 - index * 7}%`}>
					<span></span><span></span>
				</div>
			{/each}
		</div>
	{:else if loadError}
		<div class="collection-error" role="alert">
			<p>Crafts couldn’t be loaded.</p>
			{#if onRetry}
				<button type="button" class="quiet-button" onclick={onRetry}>Try again</button>
			{/if}
		</div>
	{:else if loading}
		<p class="empty-state">Loading crafts...</p>
	{:else if !filteredPages.length}
		<p class="empty-state">No crafts match this search.</p>
	{:else}
		{#each yearGroups as group (group.year)}
			<div class="year-group">
				<span class="year-ghost" aria-hidden="true">{group.year}</span>
				<ul class="year-list list-reset">
					{#each group.pages as page (page.id)}
						<li class="page-row" class:selected={selectedIds.has(page.id)}>
							{#if selectionMode}
								<button
									type="button"
									class="selection-toggle"
									class:checked={selectedIds.has(page.id)}
									aria-label={`${selectedIds.has(page.id) ? 'Deselect' : 'Select'} ${page.title}`}
									aria-pressed={selectedIds.has(page.id)}
									onclick={() => toggleSelection(page.id)}
								>
									<Icon icon="mdi:check" />
								</button>
								<button
									type="button"
									class="page-link selection-link"
									onclick={() => toggleSelection(page.id)}
								>
									<span class="page-title">{page.title}</span>
									<span class="page-meta">
										{formatDay(page)}
										{#if readingMinutes(page)}
											<span class="meta-dot">·</span>
											{readingMinutes(page)}min
										{/if}
									</span>
								</button>
							{:else}
								<a class="page-link" href={craftHref(page.slug, editable)}>
									<span class="page-title">{page.title}</span>
									<span class="page-meta">
										{formatDay(page)}
										{#if readingMinutes(page)}
											<span class="meta-dot">·</span>
											{readingMinutes(page)}min
										{/if}
									</span>
								</a>
							{/if}
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
				<Icon icon="mdi:file-plus-outline" />
				<span>Drop files to create crafts</span>
			</div>
		</div>
	{/if}
</section>

<style>
	.craft-collection {
		align-content: start;
		display: grid;
		margin-inline: auto;
		max-width: 52rem;
		padding: var(--s2) var(--s0) calc(var(--s4) + 5rem);
		position: relative;
		width: 100%;
	}

	.craft-collection.editable {
		padding-bottom: calc(clamp(13rem, 32vh, 20rem) + env(safe-area-inset-bottom, 0px));
	}

	.collection-header {
		align-items: baseline;
		display: flex;
		justify-content: space-between;
		margin-bottom: var(--s0);
	}

	.collection-header h1 {
		font-size: var(--s2);
		letter-spacing: -0.035em;
		margin: 0;
	}

	.mode-link {
		align-items: center;
		color: var(--content-1);
		display: inline-flex;
		font-size: var(--s-1);
		gap: var(--s-4);
		text-decoration: none;
	}

	.mode-link:hover,
	.mode-link:focus-visible {
		color: var(--content);
	}

	.mode-link :global(svg) {
		height: 1rem;
		width: 1rem;
	}

	.manager-toolbar {
		align-items: center;
		display: flex;
		gap: var(--s-3);
	}

	.selection-count {
		color: var(--content-1);
		font-size: var(--s-1);
		white-space: nowrap;
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

	.search-field.disabled {
		opacity: 0.5;
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

	.quiet-button.danger {
		color: var(--error);
	}

	.quiet-button.danger:hover,
	.quiet-button.danger:focus-visible {
		background: color-mix(in oklch, var(--error) 10%, transparent);
	}

	.quiet-button :global(svg) {
		height: 1.05rem;
		width: 1.05rem;
	}

	.year-group {
		padding-top: 3rem;
		position: relative;
	}

	.year-ghost {
		color: color-mix(in oklch, var(--brand) 5%, transparent);
		font-size: clamp(7rem, 13vw, 10rem);
		font-weight: 800;
		left: -0.03em;
		letter-spacing: -0.045em;
		line-height: 1;
		pointer-events: none;
		position: absolute;
		top: 0;
		user-select: none;
	}

	.year-list {
		display: grid;
		padding: 1.85rem 0 0;
		position: relative;
	}

	.page-row {
		align-items: baseline;
		display: flex;
		gap: var(--s-2);
		position: relative;
	}

	.page-row.selected .page-link {
		color: var(--content);
	}

	.page-link {
		align-items: baseline;
		border-radius: var(--s-4);
		color: color-mix(in oklch, var(--content) 78%, transparent);
		display: flex;
		gap: var(--s-2);
		min-width: 0;
		padding: 0.62rem 0;
		text-decoration: none;
		transition: color 0.16s ease;
	}

	button.page-link {
		background: transparent;
		border: 0;
		font: inherit;
		text-align: left;
		width: 100%;
	}

	.page-link:hover,
	.page-link:focus-visible {
		color: var(--content);
		outline: none;
	}

	.page-title {
		font-size: clamp(1.05rem, 2vw, 1.3rem);
		font-weight: 520;
		line-height: 1.25;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.page-meta {
		color: color-mix(in oklch, var(--content-1) 78%, transparent);
		flex-shrink: 0;
		font-size: clamp(0.82rem, 1.45vw, 0.98rem);
		line-height: 1.25;
		white-space: nowrap;
	}

	.meta-dot {
		opacity: 0.6;
		padding-inline: 0.1em;
	}

	.selection-toggle {
		align-items: center;
		background: transparent;
		border: 1.5px solid color-mix(in oklch, var(--content-1) 45%, transparent);
		border-radius: 50%;
		color: transparent;
		display: inline-flex;
		flex: 0 0 auto;
		height: 1.15rem;
		justify-content: center;
		margin-top: 0.85rem;
		padding: 0;
		transition: 0.16s ease;
		width: 1.15rem;
	}

	.selection-toggle :global(svg) {
		height: 0.75rem;
		width: 0.75rem;
	}

	.selection-toggle:hover,
	.selection-toggle:focus-visible {
		border-color: var(--brand);
		outline: none;
	}

	.selection-toggle.checked {
		background: var(--brand);
		border-color: var(--brand);
		color: var(--brand-content);
	}

	.selection-link {
		cursor: pointer;
	}

	.empty-state {
		color: var(--content-1);
		margin-top: var(--s2);
		text-align: center;
	}

	.collection-pending {
		display: grid;
		gap: var(--s0);
		padding-top: var(--s2);
	}

	.pending-row {
		align-items: center;
		display: flex;
		gap: var(--s-1);
		max-width: var(--pending-width);
		padding-block: 0.55rem;
	}

	.pending-row span {
		animation: pending-pulse 1.4s ease-in-out infinite alternate;
		background: color-mix(in oklch, var(--content) 9%, transparent);
		border-radius: 999px;
		display: block;
		height: 1rem;
	}

	.pending-row span:first-child {
		flex: 1;
	}

	.pending-row span:last-child {
		flex: 0 0 4.5rem;
		opacity: 0.65;
	}

	.collection-error {
		align-items: center;
		color: var(--content-1);
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		justify-content: center;
		padding-top: var(--s2);
	}

	.collection-error p {
		margin: 0;
	}

	@keyframes pending-pulse {
		to {
			opacity: 0.42;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pending-row span {
			animation: none;
		}
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
		.manager-toolbar {
			flex-wrap: wrap;
		}

		.search-field {
			flex-basis: 100%;
		}

		.page-link {
			flex-direction: column;
			gap: var(--s-5);
		}
	}
</style>
