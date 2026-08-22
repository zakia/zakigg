<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import {
		getAdminCrafts,
		updateMeta,
		renameTag,
		deleteTag,
		type AdminCraft
	} from './admin.remote';

	const craftsQuery = getAdminCrafts();

	let query = $state('');
	let showDrafts = $state(true);
	let activeTag = $state<string | null>(null);

	let renameFrom = $state('');
	let renameTo = $state('');
	let renameBusy = $state(false);
	let toast = $state<string | null>(null);

	function showToast(msg: string) {
		toast = msg;
		setTimeout(() => (toast = null), 2500);
	}

	function allTags(crafts: AdminCraft[]): { tag: string; count: number }[] {
		const counts = new Map<string, number>();
		for (const c of crafts) {
			for (const t of c.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
		}
		return Array.from(counts.entries())
			.map(([tag, count]) => ({ tag, count }))
			.sort((a, b) => b.count - a.count);
	}

	function filter(crafts: AdminCraft[]): AdminCraft[] {
		const q = query.trim().toLowerCase();
		return crafts.filter((c) => {
			if (!showDrafts && c.draft) return false;
			if (activeTag && !c.tags.includes(activeTag)) return false;
			if (!q) return true;
			return [c.title, c.description, c.slug, ...c.tags].join(' ').toLowerCase().includes(q);
		});
	}

	async function save(craft: AdminCraft, patch: Partial<AdminCraft>) {
		const { slug, ...rest } = { ...craft, ...patch };
		try {
			await updateMeta({
				slug,
				meta: {
					title: rest.title,
					description: rest.description,
					tags: rest.tags,
					date: rest.date,
					draft: rest.draft,
					fullBleed: rest.fullBleed
				}
			});
			showToast(`Saved ${slug}`);
		} catch (err) {
			showToast(`Error: ${err instanceof Error ? err.message : 'unknown'}`);
		}
	}

	async function toggleDraft(craft: AdminCraft) {
		await save(craft, { draft: !craft.draft });
	}

	async function toggleFullBleed(craft: AdminCraft) {
		await save(craft, { fullBleed: !craft.fullBleed });
	}

	async function addTag(craft: AdminCraft, tag: string) {
		const t = tag.trim().toLowerCase();
		if (!t || craft.tags.includes(t)) return;
		await save(craft, { tags: [...craft.tags, t] });
	}

	async function removeTag(craft: AdminCraft, tag: string) {
		await save(craft, { tags: craft.tags.filter((t) => t !== tag) });
	}

	async function doRenameTag() {
		if (!renameFrom.trim() || !renameTo.trim()) return;
		renameBusy = true;
		try {
			const result = await renameTag({
				from: renameFrom.trim().toLowerCase(),
				to: renameTo.trim().toLowerCase()
			});
			showToast(`Renamed in ${result.changed} craft${result.changed === 1 ? '' : 's'}`);
			renameFrom = '';
			renameTo = '';
		} catch (err) {
			showToast(`Error: ${err instanceof Error ? err.message : 'unknown'}`);
		} finally {
			renameBusy = false;
		}
	}

	async function doDeleteTag(tag: string) {
		if (!confirm(`Remove "${tag}" from all crafts?`)) return;
		try {
			const result = await deleteTag({ tag });
			showToast(`Removed from ${result.changed} craft${result.changed === 1 ? '' : 's'}`);
			if (activeTag === tag) activeTag = null;
		} catch (err) {
			showToast(`Error: ${err instanceof Error ? err.message : 'unknown'}`);
		}
	}

	function handleTitleBlur(e: FocusEvent, craft: AdminCraft) {
		const el = e.target as HTMLElement;
		const next = el.textContent?.trim() ?? '';
		if (!next || next === craft.title) return;
		save(craft, { title: next });
	}

	function handleDescBlur(e: FocusEvent, craft: AdminCraft) {
		const el = e.target as HTMLElement;
		const next = el.textContent?.trim() ?? '';
		if (next === craft.description) return;
		save(craft, { description: next });
	}

	function handleDateChange(e: Event, craft: AdminCraft) {
		const el = e.target as HTMLInputElement;
		if (!el.value || el.value === craft.date) return;
		save(craft, { date: el.value });
	}

	function handleTagKey(e: KeyboardEvent, craft: AdminCraft) {
		if (e.key === 'Enter') {
			e.preventDefault();
			const input = e.target as HTMLInputElement;
			addTag(craft, input.value);
			input.value = '';
		}
	}
</script>

<svelte:head>
	<title>Crafts admin</title>
</svelte:head>

<section class="admin">
	<header class="head">
		<div>
			<h1>Crafts admin</h1>
			<p class="muted">
				Edit metadata inline. Changes write back to <code>meta.ts</code> instantly.
			</p>
		</div>
		<a href="/crafts" class="btn variant-base"><Icon icon="mdi:arrow-left" /> Back to crafts</a>
	</header>

	{#await craftsQuery}
		<p class="muted">Loading…</p>
	{:then crafts}
		{@const tagCounts = allTags(crafts)}
		{@const rows = filter(crafts)}

		<div class="panel">
			<div class="row">
				<input
					class="input"
					type="search"
					placeholder="Search title, slug, description, tags…"
					bind:value={query}
				/>
				<label class="check">
					<input type="checkbox" bind:checked={showDrafts} />
					Show drafts
				</label>
			</div>

			<div class="tags-bar">
				<button
					class="tag-chip"
					class:active={activeTag === null}
					onclick={() => (activeTag = null)}
				>
					all <span class="count">{crafts.length}</span>
				</button>
				{#each tagCounts as { tag, count }}
					<div class="tag-chip-wrap">
						<button
							class="tag-chip"
							class:active={activeTag === tag}
							onclick={() => (activeTag = activeTag === tag ? null : tag)}
						>
							{tag} <span class="count">{count}</span>
						</button>
						<button
							class="tag-delete"
							title="Remove {tag} from all crafts"
							onclick={() => doDeleteTag(tag)}
						>
							<Icon icon="mdi:close" />
						</button>
					</div>
				{/each}
			</div>

			<div class="rename-row">
				<Icon icon="mdi:tag-edit-outline" />
				<span class="muted">Rename tag:</span>
				<input
					class="input mini"
					placeholder="from"
					bind:value={renameFrom}
					list="tag-list"
					disabled={renameBusy}
				/>
				<datalist id="tag-list">
					{#each tagCounts as { tag }}
						<option value={tag}></option>
					{/each}
				</datalist>
				<Icon icon="mdi:arrow-right" />
				<input class="input mini" placeholder="to" bind:value={renameTo} disabled={renameBusy} />
				<button
					class="btn variant-primary"
					onclick={doRenameTag}
					disabled={renameBusy || !renameFrom.trim() || !renameTo.trim()}
				>
					Rename
				</button>
			</div>
		</div>

		<div class="table">
			<div class="row-head">
				<div>Title / Description</div>
				<div>Tags</div>
				<div>Date</div>
				<div>Flags</div>
			</div>

			{#each rows as craft (craft.slug)}
				<div class="row-item" class:draft={craft.draft}>
					<div class="col-title">
						<div
							class="title"
							contenteditable="true"
							role="textbox"
							tabindex="0"
							aria-label={`Title for ${craft.slug}`}
							aria-multiline="false"
							spellcheck="false"
							onblur={(e) => handleTitleBlur(e, craft)}
							onkeydown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									(e.target as HTMLElement).blur();
								}
							}}
						>
							{craft.title}
						</div>
						<div class="slug"><code>{craft.slug}</code></div>
						<div
							class="description"
							contenteditable="true"
							role="textbox"
							tabindex="0"
							aria-label={`Description for ${craft.slug}`}
							spellcheck="false"
							onblur={(e) => handleDescBlur(e, craft)}
						>
							{craft.description}
						</div>
					</div>

					<div class="col-tags">
						<div class="tag-list">
							{#each craft.tags as tag}
								<span class="chip">
									{tag}
									<button class="chip-x" onclick={() => removeTag(craft, tag)}>
										<Icon icon="mdi:close" />
									</button>
								</span>
							{/each}
						</div>
						<input
							class="tag-input"
							type="text"
							placeholder="+ add tag"
							onkeydown={(e) => handleTagKey(e, craft)}
						/>
					</div>

					<div class="col-date">
						<input
							type="date"
							class="input mini"
							value={craft.date}
							onchange={(e) => handleDateChange(e, craft)}
						/>
					</div>

					<div class="col-flags">
						<button
							class="flag"
							class:on={craft.draft}
							onclick={() => toggleDraft(craft)}
							title="Draft"
						>
							<Icon icon={craft.draft ? 'mdi:eye-off' : 'mdi:eye'} />
							{craft.draft ? 'Draft' : 'Published'}
						</button>
						<button
							class="flag"
							class:on={craft.fullBleed}
							onclick={() => toggleFullBleed(craft)}
							title="Full bleed (skips container chrome)"
						>
							<Icon icon={craft.fullBleed ? 'mdi:arrow-expand-all' : 'mdi:page-layout-body'} />
							{craft.fullBleed ? 'Full bleed' : 'Chrome'}
						</button>
					</div>
				</div>
			{/each}

			{#if rows.length === 0}
				<div class="empty muted">No crafts match.</div>
			{/if}
		</div>
	{:catch err}
		<p class="error">Failed to load: {err.message}</p>
	{/await}

	{#if toast}
		<div class="toast" role="status">{toast}</div>
	{/if}
</section>

<style>
	.admin {
		padding: var(--s0);
		max-width: 1400px;
		margin-inline: auto;
		display: grid;
		gap: var(--s0);
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		flex-wrap: wrap;
		gap: var(--s-1);
	}
	.muted {
		color: color-mix(in oklch, var(--content) 55%, transparent);
	}
	.panel {
		display: grid;
		gap: var(--s-1);
		padding: var(--s-1);
		border-radius: var(--radius);
		background: color-mix(in oklch, var(--content) 3%, transparent);
		border: 1px solid color-mix(in oklch, var(--content) 8%, transparent);
	}
	.row {
		display: flex;
		gap: var(--s-1);
		align-items: center;
		flex-wrap: wrap;
	}
	.row > .input {
		flex: 1;
		min-width: 14rem;
	}
	.check {
		display: inline-flex;
		align-items: center;
		gap: var(--s-3);
		font-size: var(--s-1);
	}
	.tags-bar {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-3);
		align-items: center;
	}
	.tag-chip-wrap {
		display: inline-flex;
		align-items: stretch;
	}
	.tag-chip {
		padding: var(--s-3) var(--s-2);
		border-radius: 9999px 0 0 9999px;
		border: 1px solid color-mix(in oklch, var(--content) 15%, transparent);
		font-size: var(--s-1);
		background: transparent;
		color: var(--content);
		cursor: pointer;
	}
	.tag-chip-wrap .tag-chip {
		border-right: none;
	}
	.tag-chip:not(.tag-chip-wrap > .tag-chip) {
		border-radius: 9999px;
	}
	.tag-chip.active {
		background: var(--brand);
		color: var(--brand-content);
		border-color: var(--brand);
	}
	.tag-chip .count {
		opacity: 0.6;
		margin-left: var(--s-4);
		font-variant-numeric: tabular-nums;
	}
	.tag-delete {
		padding: 0 var(--s-3);
		border-radius: 0 9999px 9999px 0;
		border: 1px solid color-mix(in oklch, var(--content) 15%, transparent);
		background: transparent;
		color: color-mix(in oklch, var(--content) 50%, transparent);
		cursor: pointer;
		display: grid;
		place-items: center;
	}
	.tag-delete:hover {
		color: var(--error, tomato);
		border-color: currentColor;
	}
	.rename-row {
		display: flex;
		gap: var(--s-3);
		align-items: center;
		flex-wrap: wrap;
	}
	.rename-row .input.mini {
		width: 9rem;
	}
	.input.mini {
		width: auto;
	}
	.table {
		display: grid;
		gap: 1px;
		background: color-mix(in oklch, var(--content) 8%, transparent);
		border: 1px solid color-mix(in oklch, var(--content) 8%, transparent);
		border-radius: var(--radius);
		overflow: hidden;
	}
	.row-head,
	.row-item {
		display: grid;
		grid-template-columns: 2.5fr 2fr 0.9fr 1.2fr;
		gap: var(--s-1);
		padding: var(--s-1);
		background: var(--base);
		align-items: start;
	}
	.row-head {
		font-size: var(--s-2);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: color-mix(in oklch, var(--content) 55%, transparent);
		background: color-mix(in oklch, var(--content) 4%, var(--base));
	}
	.row-item.draft {
		opacity: 0.55;
	}
	.col-title {
		display: grid;
		gap: var(--s-4);
		min-width: 0;
	}
	.title {
		font-weight: 600;
		font-size: var(--s0);
		outline: none;
		border-radius: 4px;
	}
	.title:focus,
	.description:focus {
		background: color-mix(in oklch, var(--brand) 10%, transparent);
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--brand) 30%, transparent);
	}
	.slug {
		font-size: var(--s-2);
	}
	.slug code {
		font-family: var(--font-mono, monospace);
		padding: 0 var(--s-4);
		border-radius: 3px;
		background: color-mix(in oklch, var(--content) 8%, transparent);
	}
	.description {
		font-size: var(--s-1);
		color: color-mix(in oklch, var(--content) 75%, transparent);
		outline: none;
		border-radius: 4px;
		white-space: normal;
	}
	.col-tags {
		display: grid;
		gap: var(--s-3);
		align-content: start;
	}
	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-3);
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 0 var(--s-3);
		border-radius: 9999px;
		background: color-mix(in oklch, var(--brand) 15%, transparent);
		font-size: var(--s-2);
	}
	.chip-x {
		background: transparent;
		border: none;
		padding: 0;
		opacity: 0.5;
		display: grid;
		place-items: center;
		cursor: pointer;
	}
	.chip-x:hover {
		opacity: 1;
	}
	.tag-input {
		width: 100%;
		font-size: var(--s-2);
		padding: var(--s-4) var(--s-3);
		border-radius: 4px;
		border: 1px dashed color-mix(in oklch, var(--content) 20%, transparent);
		background: transparent;
		color: var(--content);
	}
	.tag-input:focus {
		border-style: solid;
		border-color: var(--brand);
		outline: none;
	}
	.col-date input {
		font-family: var(--font-mono, monospace);
		font-size: var(--s-2);
	}
	.col-flags {
		display: grid;
		gap: var(--s-4);
	}
	.flag {
		display: inline-flex;
		align-items: center;
		gap: var(--s-4);
		padding: var(--s-4) var(--s-3);
		border-radius: var(--radius);
		border: 1px solid color-mix(in oklch, var(--content) 15%, transparent);
		background: transparent;
		color: var(--content);
		font-size: var(--s-2);
		cursor: pointer;
		justify-content: flex-start;
	}
	.flag.on {
		background: color-mix(in oklch, var(--brand) 20%, transparent);
		border-color: var(--brand);
	}
	.empty {
		padding: var(--s1);
		text-align: center;
		background: var(--base);
	}
	.toast {
		position: fixed;
		bottom: var(--s0);
		left: 50%;
		transform: translateX(-50%);
		background: var(--content);
		color: var(--base);
		padding: var(--s-3) var(--s-1);
		border-radius: 9999px;
		font-size: var(--s-1);
		box-shadow: 0 10px 30px rgb(0 0 0 / 0.2);
	}
	.error {
		color: var(--error, tomato);
	}
</style>
