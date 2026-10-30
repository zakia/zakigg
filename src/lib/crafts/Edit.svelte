<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import type { EditorView } from '@codemirror/view';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import BackLink from '#lib/components/BackLink.svelte';
	import {
		Editor,
		Actions,
		Layout,
		Session,
		createPage,
		titleFromSlug,
		updateFrontmatterValue,
		type FrontmatterValue,
		type Page
	} from '#lib/editor/index.js';
	import { commitRepositoryCraft } from './repository.client';

	let {
		slug,
		initialPage = null,
		initialSha = null,
		editable = false
	}: {
		slug: string;
		initialPage?: Page | null;
		initialSha?: string | null;
		editable?: boolean;
	} = $props();

	let craft = $state<Page | null>(untrack(() => initialPage));
	let currentSha = $state<string | null>(untrack(() => initialSha));
	let busy = $state('');
	let notice = $state('');
	let titleInput = $state(untrack(() => initialPage?.title ?? titleFromSlug(slug)));
	let tagsInput = $state(untrack(() => initialPage?.tags.join(', ') ?? ''));
	const editCollectionHref = resolve('crafts');

	let editorMode = $state<'live' | 'source'>('live');
	let editorView = $state<EditorView | undefined>();
	let session = $state<Session | null>(null);
	let currentSessionCraftId: string | null = null;

	$effect(() => {
		const targetCraft = craft;
		if (targetCraft && targetCraft.id !== currentSessionCraftId) {
			currentSessionCraftId = targetCraft.id;
			session?.destroy();
			session = new Session({
				page: targetCraft,
				saved: Boolean(currentSha) || !editable,
				backup: async (nextPage) => nextPage,
				save
			});
		} else if (!targetCraft) {
			currentSessionCraftId = null;
			session?.destroy();
			session = null;
		}
	});

	onDestroy(() => session?.destroy());

	onMount(() => {
		function handleSaveShortcut(event: KeyboardEvent) {
			if (event.key.toLowerCase() !== 's' || (!event.metaKey && !event.ctrlKey)) return;
			event.preventDefault();
			void session?.save();
		}
		function beforeUnload(event: BeforeUnloadEvent) {
			if (!save || !session?.dirty) return;
			event.preventDefault();
			event.returnValue = '';
		}
		window.addEventListener('keydown', handleSaveShortcut);
		window.addEventListener('beforeunload', beforeUnload);
		return () => {
			window.removeEventListener('keydown', handleSaveShortcut);
			window.removeEventListener('beforeunload', beforeUnload);
		};
	});

	function updateSourceProperty(key: string, value: FrontmatterValue) {
		if (!editorView) return;
		const change = updateFrontmatterValue(editorView.state.doc.toString(), key, value);
		if (change) editorView.dispatch({ changes: change, userEvent: 'input' });
	}

	$effect(() => {
		craft = initialPage;
		currentSha = initialSha;
		syncMetadataInputs(initialPage);
	});

	const save = $derived(
		editable
			? async (page: Page) => {
					const result = await commitRepositoryCraft(page, currentSha);
					currentSha = result.sha;
					handleSaved(page);
					return result;
				}
			: undefined
	);

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
		void goto(resolve('crafts'));
	}

	function handleSaved(page: Page) {
		craft = page;

		if (page.slug !== slug) {
			void navigateToEditCraft(page.slug, {
				replaceState: true,
				reset: false
			});
		}
	}

	async function createHere() {
		busy = 'create';
		notice = '';

		try {
			const page = createPage({
				title: titleInput || titleFromSlug(slug),
				slug,
				tags: parseTagsInput(tagsInput),
				published: false
			});

			if (editable) {
				const result = await commitRepositoryCraft(page, null);
				currentSha = result.sha;
			}

			craft = page;
			syncMetadataInputs(page);
			await navigateToEditCraft(page.slug, { replaceState: true });
		} catch (error) {
			notice = error instanceof Error ? error.message : 'Could not create craft.';
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
		return goto(craftHref(slug), options);
	}
</script>

{#snippet navigation()}
	<BackLink href={editCollectionHref} onclick={goBack} />
{/snippet}

<svelte:head>
	<title>{craft?.title ?? titleFromSlug(slug)} – zaki.gg</title>
	<meta name="description" content="Craft on zaki.gg." />
	{#if !craft?.frontmatter?.published}
		<meta name="robots" content="noindex, nofollow" />
	{/if}
</svelte:head>

{#if !craft}
	<section class="craft-state">
		<BackLink href={editCollectionHref} label="Crafts" />
		<div class="missing-craft">
			<h1>{titleFromSlug(slug)}</h1>
			{#if notice}<p>{notice}</p>{/if}
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
		{#if session}
			{@const currentSession = session}
			<Layout {navigation}>
				{#snippet actions()}
					<Actions
						status={currentSession.status}
						saving={currentSession.saving}
						dirty={currentSession.dirty}
						published={currentSession.page.frontmatter?.published === true}
						mode={editorMode}
						onToggleMode={() => (editorMode = editorMode === 'live' ? 'source' : 'live')}
						onSave={save ? () => void currentSession.save() : undefined}
						onSetPublished={(value) => updateSourceProperty('published', value)}
					/>
				{/snippet}
				<Editor
					initialMarkdown={currentSession.markdown}
					mode={editorMode}
					ariaLabel={`${craft.title} editor`}
					autofocus
					onMarkdownChange={(markdown) => currentSession.update(markdown)}
					onReady={(view) => (editorView = view)}
				/>
			</Layout>
		{/if}
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
