<script lang="ts">
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import BackLink from '$lib/components/BackLink.svelte';
	import {
		Workspace,
		createPageRecord,
		openRepositoryPage,
		clearRecovery,
		loadPageBySlug,
		titleFromSlug,
		type Page
	} from '$lib/editor';
	import { commitRepositoryCraft, loadRepositoryCraft } from './repository.client';

	let { slug }: { slug: string } = $props();

	let craft = $state<Page | null>(null);
	let loading = $state(true);
	let busy = $state('');
	let notice = $state('');
	let recovery = $state<Page | null>(null);
	let saved = $state(false);
	let save = $state<(page: Page) => Promise<unknown>>();
	let loadVersion = 0;
	let loadedSlug = '';
	let titleInput = $state('');
	let tagsInput = $state('');
	const editCollectionHref = resolve('/crafts');
	onDestroy(() => {
		loadVersion += 1;
	});

	$effect(() => {
		if (loadedSlug === slug) return;

		loadedSlug = slug;
		void loadPage(slug);
	});

	async function loadPage(slug: string) {
		const version = ++loadVersion;
		loading = true;
		craft = null;
		recovery = null;
		notice = '';
		save = undefined;
		saved = false;
		const [local, remote] = await Promise.allSettled([
			loadPageBySlug(slug),
			loadRepositoryCraft(slug)
		]);
		if (version !== loadVersion) return;
		try {
			if (remote.status === 'fulfilled') {
				let document = remote.value;
				// A locally edited slug may differ from the repository's URL.
				if (!document && local.status === 'fulfilled' && local.value) {
					const { loadRepositoryCrafts } = await import('./repository.client');
					const matching = (await loadRepositoryCrafts()).find(
						(page) => page.id === local.value?.id
					);
					if (matching) document = await loadRepositoryCraft(matching.slug);
				}
				if (version !== loadVersion) return;
				if (document) {
					try {
						const backup = await openRepositoryPage(document.page);
						if (version !== loadVersion) return;
						recovery = backup;
					} catch {
						if (version !== loadVersion) return;
						notice = 'Browser storage is unavailable. Save to Git or download to keep changes.';
					}
					craft = document.page;
					saved = true;
				} else craft = local.status === 'fulfilled' ? local.value : null;
				let expectedSha = document?.sha ?? null;
				save = async (page) => {
					const result = await commitRepositoryCraft(page, expectedSha);
					expectedSha = result.sha;
					return result;
				};
			} else {
				craft = local.status === 'fulfilled' ? local.value : null;
				notice =
					'Git is unavailable. Showing the browser copy; saving to Git is disabled until you reload.';
			}
			syncMetadataInputs(craft);
		} catch {
			if (version !== loadVersion) return;
			notice = 'Could not load the latest repository version. Reload to try again.';
		} finally {
			if (version === loadVersion) loading = false;
		}
	}

	function syncMetadataInputs(page: Page | null) {
		titleInput = page?.title ?? titleFromSlug(slug);
		tagsInput = page?.tags.join(', ') ?? '';
	}

	function goBack(event: MouseEvent) {
		// Let modified clicks (new tab, etc.) use the href default.
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
			return;
		}

		event.preventDefault();
		void goto(resolve('/crafts'));
	}

	function handleSaved(page: Page) {
		craft = page;

		if (page.slug !== slug) {
			// Mark this slug as already loaded so the navigation below doesn't
			// re-trigger loadPage() and remount the editor mid-edit.
			loadedSlug = page.slug;
			void navigateToEditCraft(page.slug, {
				replaceState: true,
				keepFocus: true,
				noScroll: true
			});
		}
	}

	async function createHere() {
		busy = 'create';

		try {
			const page = await createPageRecord({
				title: titleInput || titleFromSlug(slug),
				slug,
				tags: parseTagsInput(tagsInput)
			});

			craft = page;
			syncMetadataInputs(page);
			await navigateToEditCraft(page.slug, { replaceState: true });
		} finally {
			busy = '';
		}
	}

	function parseTagsInput(value: string) {
		return value
			.split(',')
			.map((tag) => tag.trim())
			.filter(Boolean);
	}

	function craftHref(slug: string) {
		return resolve('/crafts/[slug]', { slug });
	}

	function navigateToEditCraft(slug: string, options?: Parameters<typeof goto>[1]) {
		return goto(resolve('/admin/crafts/[slug]', { slug }), options);
	}
</script>

{#snippet navigation()}
	<BackLink href={editCollectionHref} onclick={goBack} />
{/snippet}

<svelte:head>
	<title>{craft?.title ?? titleFromSlug(slug)} – Edit – zaki.gg</title>
	<meta name="description" content="Edit this craft on zaki.gg." />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if loading}
	<section class="craft-state">
		<p>Loading craft...</p>
	</section>
{:else if !craft}
	<section class="craft-state">
		<BackLink href={editCollectionHref} label="Crafts" />
		<div class="missing-craft">
			<h1>{titleFromSlug(slug)}</h1>
			<p>{notice}</p>
			<p>No editable craft exists at /crafts/{slug} yet.</p>
			<form onsubmit={(event) => (event.preventDefault(), void createHere())}>
				<label>
					<span>Title</span>
					<input bind:value={titleInput} />
				</label>
				<label>
					<span>Tags</span>
					<input bind:value={tagsInput} placeholder="ideas, drafts" />
				</label>
				<button type="submit" disabled={busy === 'create'}>
					<Icon icon="mdi:plus" />
					Create craft
				</button>
			</form>
		</div>
	</section>
{:else}
	<section class="craft-edit-page">
		{#if notice}<p class="notice" role="status">{notice}</p>{/if}
		{#key craft.id}
			<Workspace
				page={craft}
				publicHref={craftHref(craft.slug)}
				onSaved={handleSaved}
				{save}
				{saved}
				{recovery}
				onRestore={async () => {
					if (craft) await clearRecovery(craft.id);
					recovery = null;
				}}
				{navigation}
			/>
		{/key}
	</section>
{/if}

<style>
	.craft-state {
		align-content: center;
		display: grid;
		gap: var(--s1);
		margin-inline: auto;
		max-width: 54rem;
		min-height: 60vh;
		padding: var(--s2) var(--s0) calc(var(--s4) + 5rem);
		width: 100%;
	}

	.missing-craft button {
		align-items: center;
		background: var(--base-1);
		border: 1px solid color-mix(in oklch, var(--edge) 82%, transparent);
		border-radius: var(--s-2);
		color: var(--content);
		display: inline-flex;
		justify-content: center;
		transition:
			background-color 0.16s ease,
			border-color 0.16s ease,
			color 0.16s ease,
			transform 0.16s ease;
	}

	.missing-craft button:hover,
	.missing-craft button:focus-visible {
		background: color-mix(in oklch, var(--brand) 13%, var(--base-1));
		border-color: color-mix(in oklch, var(--brand) 36%, var(--edge));
		color: var(--content);
		transform: translateY(-1px);
	}

	.missing-craft button :global(svg) {
		height: 1.1rem;
		width: 1.1rem;
	}

	.notice {
		padding: var(--s0);
		color: var(--content-1);
	}

	.craft-edit-page {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 100vh;
		position: relative;
		width: 100%;
	}

	.missing-craft label {
		display: grid;
		gap: var(--s-5);
		min-width: 0;
	}

	label span {
		color: var(--content-1);
		font-size: var(--s-2);
		font-weight: 700;
	}

	input {
		background: var(--base-2);
		border: 1px solid var(--edge);
		border-radius: var(--s-3);
		color: var(--content);
		min-height: 2rem;
		min-width: 0;
		padding: 0 var(--s-2);
		width: 100%;
	}

	input:focus {
		border-color: color-mix(in oklch, var(--brand) 52%, var(--edge));
		box-shadow: var(--focus-ring);
		outline: none;
	}

	.missing-craft {
		background: var(--base-1);
		border: 1px solid var(--edge);
		border-radius: var(--s-2);
		display: grid;
		gap: var(--s0);
		padding: var(--s1);
	}

	.missing-craft p {
		color: var(--content-1);
		margin: 0;
	}

	.missing-craft form {
		display: grid;
		gap: var(--s-1);
	}

	.missing-craft button {
		background: var(--brand);
		color: var(--brand-content);
		font-weight: 700;
		gap: var(--s-3);
		min-height: 2.5rem;
		padding: 0 var(--s0);
		width: fit-content;
	}
</style>
