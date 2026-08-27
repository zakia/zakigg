<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/auth';
	import Icon from '$lib/components/Icon.svelte';
	import CraftBackLink from '$lib/crafts/CraftBackLink.svelte';
	import { componentEmbeds } from '$lib/embeds';
	import {
		DocumentEditor,
		createNotePageRecord,
		loadNotePageBySlug,
		titleFromSlug,
		toStoredNotePage,
		type DocumentPublicationAdapter,
		type NotePage
	} from '$lib/editor/document';
	import { getCraftPublication, publishNoteCraft, unpublishNoteCraft } from './publication.remote';
	import { isPublishedCraftOutdated, type PublishedCraftSummary } from './publication';

	let { slug }: { slug: string } = $props();

	let craft = $state<NotePage | null>(null);
	let loading = $state(true);
	let busy = $state('');
	let loadedSlug = '';
	let titleInput = $state('');
	let tagsInput = $state('');
	const editCollectionHref = `${resolve('/crafts')}?edit`;
	const publication: DocumentPublicationAdapter = {
		isReady: () => auth.ready,
		isEnabled: () => Boolean(auth.user),
		load: (documentId) => getCraftPublication(documentId),
		isOutdated: (document, current) =>
			isPublishedCraftOutdated(document, current as PublishedCraftSummary),
		publish: async (document) => {
			await publishNoteCraft({ pageJson: JSON.stringify(toStoredNotePage(document)) });
		},
		unpublish: async (documentId) => {
			await unpublishNoteCraft(documentId);
		}
	};

	$effect(() => {
		if (loadedSlug === slug) return;

		loadedSlug = slug;
		void loadPage(slug);
	});

	async function loadPage(slug: string) {
		loading = true;
		craft = null;

		try {
			const page = await loadNotePageBySlug(slug);
			craft = page;
			syncMetadataInputs(page);
		} finally {
			loading = false;
		}
	}

	function syncMetadataInputs(page: NotePage | null) {
		titleInput = page?.title ?? titleFromSlug(slug);
		tagsInput = page?.tags.join(', ') ?? '';
	}

	function goBack(event: MouseEvent) {
		// Let modified clicks (new tab, etc.) use the href default.
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
			return;
		}

		event.preventDefault();
		// The query string is intentionally composed after resolving the typed route.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(`${resolve('/crafts')}?edit`);
	}

	function handleSaved(page: NotePage) {
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
			const page = await createNotePageRecord({
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
		// The query string is intentionally composed after resolving the typed route.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		return goto(`${resolve('/crafts/[slug]', { slug })}?edit`, options);
	}
</script>

{#snippet navigation()}
	<CraftBackLink href={editCollectionHref} onclick={goBack} />
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
		<CraftBackLink href={editCollectionHref} label="Crafts" />
		<div class="missing-craft">
			<h1>{titleFromSlug(slug)}</h1>
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
		{#key craft.id}
			<DocumentEditor
				page={craft}
				embeds={componentEmbeds}
				publicHref={craftHref(craft.slug)}
				onSaved={handleSaved}
				{publication}
				isSyncEnabled={() => Boolean(auth.user)}
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

	.craft-edit-page {
		display: flex;
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

	@media (max-width: 52rem) {
		.craft-edit-page :global(.document-actions) {
			right: var(--s0);
			top: var(--s0);
			z-index: 6;
		}
	}
</style>
