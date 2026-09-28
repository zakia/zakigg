<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { page as route } from '$app/state';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import Tag from '$lib/components/Tag.svelte';
	import type { CraftListItem } from './types';
	import type { Page } from '$lib/editor/Page';

	type YearGroup = {
		year: number;
		pages: CraftListItem[];
	};

	const READING_WORDS_PER_MINUTE = 200;
	const PENDING_ROWS = Array.from({ length: 6 }, (_, index) => index);

	let {
		initialCrafts = [],
		editable = false,
		pending = false,
		loadError = false,
		onRetry
	}: {
		initialCrafts?: CraftListItem[];
		editable?: boolean;
		pending?: boolean;
		loadError?: boolean;
		onRetry?: () => void;
	} = $props();

	let pages = $state<CraftListItem[]>(untrack(() => initialCrafts));
	let repositoryPages = $state<Page[]>([]);
	let loading = $state(untrack(() => editable));
	let localLoadError = $state<'blocked' | 'failed' | null>(null);
	let busy = $state('');
	let toast = $state('');
	let query = $state('');
	let mounted = $state(false);
	let dragActive = $state(false);
	let selectionMode = $state(false);
	let refreshVersion = 0;
	const selectedIds = new SvelteSet<string>();
	let dragDepth = 0;

	const visiblePages = $derived(editable ? pages : initialCrafts);
	const availableTags = $derived(
		[...new Set(visiblePages.flatMap((page) => page.tags))].sort((a, b) => a.localeCompare(b))
	);
	// The collection is prerendered; URL filters apply once the browser mounts it.
	const requestedTag = $derived(mounted ? route.url.searchParams.get('tag') : null);
	const selectedTag = $derived(
		requestedTag && availableTags.includes(requestedTag) ? requestedTag : null
	);
	const filteredPages = $derived(filterPages(visiblePages));
	const yearGroups = $derived(groupPagesByYear(filteredPages));

	$effect(() => {
		if (editable) void refresh();
		else {
			refreshVersion += 1;
			pages = initialCrafts;
			repositoryPages = [];
			loading = false;
			localLoadError = null;
			toast = '';
			dragActive = false;
			leaveSelectionMode();
		}
	});

	onDestroy(() => {
		refreshVersion += 1;
	});
	onMount(() => {
		mounted = true;
		function handleEscape(event: KeyboardEvent) {
			if (event.key === 'Escape') leaveSelectionMode();
		}
		document.addEventListener('keydown', handleEscape);
		return () => document.removeEventListener('keydown', handleEscape);
	});

	async function createCraft() {
		busy = 'create';

		try {
			const { createPageRecord } = await import('$lib/editor/document/persistence/storage');
			const page = await createPageRecord();
			await goto(craftHref(page.slug, true));
		} finally {
			busy = '';
		}
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
			const [{ importDocumentFiles }, { componentEmbeds }] = await Promise.all([
				import('$lib/editor/document/persistence/file-import'),
				import('$lib/embeds')
			]);
			const result = await importDocumentFiles(files, componentEmbeds);
			const importedPages = result.pages.length;
			if (!importedPages) {
				showToast('No supported craft files found.');
				return;
			}

			await refresh();
			showToast(
				`Imported ${importedPages} ${importedPages === 1 ? 'craft' : 'crafts'} locally · Save to Git from the editor${result.failed.length ? ` · ${result.failed.length} skipped` : ''}`
			);

			if (importedPages === 1) {
				await goto(craftHref(result.pages[0].slug, true));
			}
		} finally {
			busy = '';
		}
	}

	async function refresh() {
		const version = ++refreshVersion;
		loading = true;
		localLoadError = null;
		try {
			const [{ listPages, listLocalPages }, { loadRepositoryCrafts }, { summarizePage }] =
				await Promise.all([
					import('$lib/editor/document/persistence/storage'),
					import('./repository.client'),
					import('$lib/editor/Page')
				]);
			const [local, remote] = await Promise.allSettled([listPages(), loadRepositoryCrafts()]);
			if (version !== refreshVersion || !editable) return;
			if (remote.status === 'fulfilled') {
				repositoryPages = remote.value;
				const ids = new Set(repositoryPages.map((page) => page.id));
				const localChanges = local.status === 'fulfilled' ? await listLocalPages() : [];
				if (version !== refreshVersion || !editable) return;
				pages = [
					...repositoryPages.map(summarizePage),
					...localChanges
						.filter((page) => !ids.has(page.id))
						.map((page) => ({ ...page, published: false }))
				];
				if (local.status === 'rejected')
					showToast('Browser backups are unavailable. Showing Git documents.');
			} else if (local.status === 'fulfilled') {
				pages = local.value;
				showToast('Git is unavailable. Showing browser copies.');
			} else throw local.reason;
		} catch (error) {
			if (version !== refreshVersion || !editable) return;
			console.error('Failed to load crafts', error);
			localLoadError =
				error instanceof Error && error.name === 'NotesDatabaseBlockedError' ? 'blocked' : 'failed';
		} finally {
			if (version === refreshVersion) loading = false;
		}
	}

	function selectTag(tag: string | null) {
		const url = new URL(route.url);
		if (tag && tag !== selectedTag) url.searchParams.set('tag', tag);
		else url.searchParams.delete('tag');
		// This URL retains the current resolved pathname; only its query changes.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(url, { keepFocus: true, noScroll: true });
	}

	function filterPages(source: CraftListItem[]) {
		const text = query.trim().toLowerCase();
		return source.filter(
			(page) =>
				(!selectedTag || page.tags.includes(selectedTag)) &&
				(!text || [page.title, page.slug, ...page.tags].join(' ').toLowerCase().includes(text))
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
		if (selectedIds.has(id)) selectedIds.delete(id);
		else selectedIds.add(id);
	}

	function enterSelectionMode() {
		selectionMode = true;
		selectedIds.clear();
	}

	function leaveSelectionMode() {
		selectionMode = false;
		selectedIds.clear();
	}

	async function exportSelected() {
		if (!selectedIds.size) return;
		busy = 'export';

		try {
			const [{ loadPageById }, { downloadPagesExport }] = await Promise.all([
				import('$lib/editor/document/persistence/storage'),
				import('$lib/editor/document/persistence/export')
			]);
			const selectedPages = (
				await Promise.all(
					[...selectedIds].map(
						(id) => repositoryPages.find((page) => page.id === id) ?? loadPageById(id)
					)
				)
			).filter((page) => page !== null);
			await downloadPagesExport(selectedPages);
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
			const [{ deletePage }, { removeRepositoryCraft }] = await Promise.all([
				import('$lib/editor/document/persistence/storage'),
				import('./repository.client')
			]);
			for (const id of selectedIds) {
				await removeRepositoryCraft(id);
				await deletePage(id);
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
		return edit ? resolve('/admin/crafts/[slug]', { slug }) : resolve('/crafts/[slug]', { slug });
	}
</script>

{#snippet rowContent(page: CraftListItem)}
	<span class="page-title">{page.title}</span>
	<span class="page-meta">
		{#if editable}
			<span
				class="publication-status"
				class:published={page.published}
				role="img"
				aria-label={page.published ? 'Published' : 'Unpublished'}
				title={page.published ? 'Published in Git · appears after the site builds' : 'Unpublished'}
			>
				<Icon icon={page.published ? 'mdi:check-circle-outline' : 'mdi:minus-circle-outline'} />
			</span>
		{/if}
		<time datetime={page.date}>{formatDay(page)}</time>
		{#if readingMinutes(page)}
			<span class="meta-dot" aria-hidden="true">·</span>
			<span>{readingMinutes(page)}min</span>
		{/if}
		{#if page.tags.length}
			<span class="row-tags" aria-label="Tags">
				{#each page.tags as tag (tag)}<Tag name={tag} />{/each}
			</span>
		{/if}
	</span>
{/snippet}

<section
	class="craft-collection"
	class:editable
	class:drag-active={dragActive}
	ondragenter={handleDragEnter}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	aria-label="Crafts"
>
	<header class="collection-header">
		<div class="collection-toolbar">
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
			{#if editable}
				<div class="toolbar-actions">
					<div class="toolbar-modes">
						<div
							class="toolbar-mode"
							class:inactive={selectionMode}
							inert={selectionMode}
							aria-hidden={selectionMode}
						>
							<button
								type="button"
								class="quiet-button new-craft-button"
								disabled={Boolean(busy)}
								onclick={() => void createCraft()}
							>
								<Icon icon="mdi:plus" />New
							</button>
							<button
								type="button"
								class="quiet-button"
								aria-label="Refresh from Git"
								title="Refresh from Git"
								disabled={loading || Boolean(busy)}
								onclick={() => void refresh()}
							>
								<Icon icon="mdi:refresh" />
							</button>
						</div>
						<div
							class="toolbar-mode"
							class:inactive={!selectionMode}
							inert={!selectionMode}
							aria-hidden={!selectionMode}
							role="group"
							aria-label="Selected craft actions"
						>
							<button
								type="button"
								class="quiet-button"
								aria-label="Download selected crafts"
								title="Download selected crafts"
								disabled={!selectedIds.size || Boolean(busy)}
								onclick={() => void exportSelected()}
							>
								<Icon icon="mdi:download-outline" />
							</button>
							<button
								type="button"
								class="quiet-button danger"
								aria-label="Delete selected crafts"
								title="Delete selected crafts"
								disabled={!selectedIds.size || Boolean(busy)}
								onclick={() => void deleteSelected()}
							>
								<Icon icon="mdi:trash-can-outline" />
							</button>
						</div>
					</div>
					<button
						type="button"
						class="quiet-button"
						class:active={selectionMode}
						aria-label={selectionMode ? 'Exit selection' : 'Select crafts'}
						title={selectionMode ? 'Exit selection' : 'Select crafts'}
						aria-pressed={selectionMode}
						disabled={Boolean(busy)}
						onclick={() => (selectionMode ? leaveSelectionMode() : enterSelectionMode())}
					>
						<Icon icon={selectionMode ? 'mdi:close' : 'mdi:checkbox-multiple-outline'} />
					</button>
				</div>
			{/if}
		</div>
		{#if availableTags.length}
			<div class="tag-filters" role="group" aria-label="Filter by tag">
				{#each availableTags as tag (tag)}
					<button
						type="button"
						class="tag-filter"
						aria-label={`Filter by ${tag}`}
						aria-pressed={selectedTag === tag}
						onclick={() => selectTag(tag)}><Tag name={tag} /></button
					>
				{/each}
			</div>
		{/if}
	</header>

	{#if pending}
		<div class="collection-pending" role="status" aria-label="Loading crafts">
			{#each PENDING_ROWS as index (index)}
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
	{:else if localLoadError}
		<div class="collection-error" role="alert">
			{#if localLoadError === 'blocked'}
				<p>Another zaki.gg tab has an older editor open.</p>
				<p>Close that tab, then try again.</p>
			{:else}
				<p>Your local crafts couldn’t be opened.</p>
			{/if}
			<button type="button" class="quiet-button" onclick={() => void refresh()}>Try again</button>
		</div>
	{:else if loading}
		<p class="empty-state">Loading crafts...</p>
	{:else if !filteredPages.length}
		<p class="empty-state">
			{query.trim() || selectedTag ? 'No crafts match these filters.' : 'No crafts yet.'}
		</p>
	{:else}
		{#each yearGroups as group (group.year)}
			<div class="year-group">
				<span class="year-ghost" aria-hidden="true">{group.year}</span>
				<ul class="year-list list-reset">
					{#each group.pages as page (page.id)}
						<li class="page-row" class:selected={selectedIds.has(page.id)}>
							{#if editable && selectionMode}
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
									{@render rowContent(page)}
								</button>
							{:else}
								<a class="page-link" href={craftHref(page.slug, editable)}>
									{@render rowContent(page)}
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
	/* Filtering can remove the page scrollbar; keep the available width unchanged. */
	:global(html:has(.craft-collection)) {
		scrollbar-gutter: stable;
	}

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
		display: grid;
		gap: var(--s-2);
		margin-bottom: var(--s0);
	}

	.tag-filters,
	.row-tags {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.375rem;
	}
	.row-tags {
		min-width: 0;
		max-width: 100%;
	}
	.tag-filter {
		background: transparent;
		border: 0;
		border-radius: 999px;
		cursor: pointer;
		padding: 0;
		min-height: 1.9rem;
		display: inline-flex;
		align-items: center;
	}
	.tag-filter:hover :global(.tag-badge),
	.tag-filter[aria-pressed='true'] :global(.tag-badge) {
		background: color-mix(in oklab, var(--tag-color) 20%, var(--base));
		border-color: color-mix(in oklab, var(--tag-color) 65%, var(--base));
	}
	.tag-filter:focus-visible {
		outline: 2px solid var(--brand);
		outline-offset: 2px;
	}
	.collection-toolbar {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-3);
		justify-content: flex-end;
		min-width: 0;
	}

	.toolbar-actions,
	.toolbar-mode {
		align-items: center;
		display: flex;
		gap: var(--s-3);
		justify-content: flex-end;
	}

	.toolbar-actions {
		flex-shrink: 0;
	}

	/* Both modes size the same grid cell, keeping search and filters stationary. */
	.toolbar-modes {
		display: grid;
	}

	.toolbar-mode {
		grid-area: 1 / 1;
	}

	.toolbar-mode.inactive {
		visibility: hidden;
	}

	.new-craft-button {
		color: var(--brand);
		font-weight: 600;
	}

	.search-field {
		align-items: center;
		border-radius: var(--s-2);
		background: transparent;
		border: 1px solid transparent;
		color: color-mix(in oklch, var(--content-1) 72%, transparent);
		display: flex;
		flex: 1 1 16rem;
		gap: var(--s-2);
		min-height: 3rem;
		min-width: 0;
		padding: 0.35rem 0.85rem;
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
		text-decoration: none;
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

	.quiet-button.active {
		color: var(--brand);
		background: color-mix(in oklch, var(--brand) 10%, transparent);
	}

	.publication-status {
		align-self: center;
		display: inline-flex;
		flex-shrink: 0;
		color: color-mix(in oklch, var(--warning) 72%, var(--content));
	}
	.publication-status.published {
		color: color-mix(in oklch, var(--success) 75%, var(--content-1));
	}
	.publication-status :global(svg) {
		width: 0.875rem;
		height: 0.875rem;
	}

	.year-group {
		padding-top: 3rem;
		position: relative;
	}

	.year-ghost {
		-webkit-text-stroke: 4px color-mix(in oklch, var(--brand) 5%, transparent);
		color: transparent;
		font-size: clamp(5rem, 6vw, 8rem);
		left: -0.03em;
		letter-spacing: -0.065em;
		line-height: 1;
		pointer-events: none;
		position: absolute;
		top: 0;
		user-select: none;
	}

	.year-list {
		display: grid;
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

	.editable .page-row {
		padding-inline-start: 1.75rem;
	}

	.page-link {
		align-items: flex-start;
		flex: 1;
		flex-direction: column;
		border-radius: var(--s-4);
		color: color-mix(in oklch, var(--content) 78%, transparent);
		display: flex;
		gap: 0.3rem;
		min-width: 0;
		padding: 0.7rem 0;
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
		max-width: 100%;
		font-size: clamp(1.05rem, 2vw, 1.3rem);
		font-weight: 480;
		line-height: 1.25;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.page-meta {
		flex-wrap: wrap;
		align-items: center;
		display: flex;
		gap: 0.375rem;
		color: color-mix(in oklch, var(--content-1) 78%, transparent);
		flex-shrink: 0;
		font-size: 0.825rem;
		line-height: 1.25;
		white-space: nowrap;
	}

	.meta-dot {
		opacity: 0.6;
	}

	.selection-toggle {
		position: absolute;
		inset-inline-start: 0;
		top: 0.85rem;
		align-items: center;
		background: transparent;
		border: 1.5px solid color-mix(in oklch, var(--content-1) 45%, transparent);
		border-radius: 50%;
		color: transparent;
		display: inline-flex;
		flex: 0 0 auto;
		height: 1.15rem;
		justify-content: center;
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
		.search-field {
			flex-basis: 100%;
		}
	}
</style>
