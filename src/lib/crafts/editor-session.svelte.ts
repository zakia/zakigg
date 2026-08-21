import type { JSONContent } from '@tiptap/core';
import { auth } from '$lib/auth';
import {
	getCraftPublication,
	publishNoteCraft,
	unpublishNoteCraft
} from '$lib/crafts/publication.remote';
import { isPublishedCraftOutdated } from '$lib/crafts/publication';
import { createTimer } from '$lib/editor/timers';
import {
	normalizeMetadataEntries,
	type MetadataEntry,
	type MetadataProperties
} from '$lib/notes/metadata-block';
import { formatSaveLabel, type SaveState, type SyncLabelStatus } from '$lib/notes/save-state';
import { saveNotePage } from '$lib/notes/storage';
import { startSyncEngine, syncState } from '$lib/notes/sync/engine.svelte';
import { resolveNotePageMetadata, type NotePageV1 } from '$lib/notes/types';

type CraftEditorSessionOptions = {
	getPage: () => NotePageV1;
	getContent: () => JSONContent | undefined;
	onDraftChange: () => void;
	onSaved?: (page: NotePageV1) => void;
};

export class CraftEditorSession {
	page = $state({} as NotePageV1);
	properties = $state<MetadataEntry[]>([]);
	saveState = $state<SaveState>('loading');
	lastSavedAt = $state<string>();
	publicationState = $state<'loading' | 'unpublished' | 'published' | 'working' | 'error'>(
		'loading'
	);
	publicationExists = $state(false);

	#getContent: () => JSONContent | undefined;
	#onDraftChange: () => void;
	#onSaved?: (page: NotePageV1) => void;
	#pendingSave = false;
	#pendingPublicationPage = $state<NotePageV1 | null>(null);
	#publicationUpdateInFlight = false;
	#publicationChecked = false;
	#saveTimer = createTimer();

	constructor({ getPage, getContent, onDraftChange, onSaved }: CraftEditorSessionOptions) {
		const page = getPage();
		this.page = page;
		this.properties = normalizeMetadataEntries($state.snapshot(page.properties));
		this.lastSavedAt = page.updatedAt;
		this.saveState = 'saved';
		this.#getContent = getContent;
		this.#onDraftChange = onDraftChange;
		this.#onSaved = onSaved;

		startSyncEngine();

		$effect(() => {
			if (!auth.ready || !auth.user || this.#publicationChecked) return;
			this.#publicationChecked = true;
			void this.#refreshPublicationState();
		});

		$effect(() => {
			if (
				!auth.user ||
				!this.publicationExists ||
				!this.#pendingPublicationPage ||
				this.#publicationUpdateInFlight ||
				this.publicationState === 'error' ||
				syncState.status !== 'synced'
			) {
				return;
			}

			void this.#updatePublishedCraft();
		});
	}

	get syncLabelStatus(): SyncLabelStatus {
		return auth.user ? syncState.status : 'disabled';
	}

	get saveLabel() {
		return formatSaveLabel(this.saveState, this.lastSavedAt, this.syncLabelStatus);
	}

	get title() {
		return String(this.getPropertyValue('title') ?? this.page.title);
	}

	get date() {
		return String(this.getPropertyValue('date') || this.page.createdAt);
	}

	get canPublish() {
		return Boolean(auth.user);
	}

	markError() {
		this.saveState = 'error';
	}

	markSaving() {
		this.saveState = 'saving';
	}

	scheduleSave() {
		this.saveState = 'saving';
		this.#pendingSave = true;
		this.#saveTimer.schedule(() => {
			void this.persistNow();
		}, 350);
	}

	async persistNow({ notify = true }: { notify?: boolean } = {}) {
		const content = this.#getContent();
		if (!content) return;

		this.#pendingSave = false;

		try {
			const nextPage = await saveNotePage({
				...this.page,
				properties: $state.snapshot(this.properties) as MetadataEntry[],
				content
			});
			this.page = nextPage;
			if (notify) this.#onSaved?.(nextPage);
			this.lastSavedAt = nextPage.updatedAt;
			this.saveState = 'saved';
			if (this.publicationExists) this.#pendingPublicationPage = nextPage;
			return nextPage;
		} catch {
			this.saveState = 'error';
		}
	}

	updateProperties(next: MetadataEntry[]) {
		this.properties = normalizeMetadataEntries(next);
		this.#onDraftChange();
		this.scheduleSave();
	}

	mergeProperties(incoming: MetadataProperties) {
		const merged = [...normalizeMetadataEntries(this.properties)];

		for (const entry of normalizeMetadataEntries(incoming)) {
			const index = merged.findIndex((existing) => existing.key === entry.key);

			if (index >= 0) merged[index] = entry;
			else merged.push(entry);
		}

		this.updateProperties(merged);
	}

	updateTitle(value: string) {
		const next = [...normalizeMetadataEntries(this.properties)];
		const index = next.findIndex((property) => property.key === 'title');

		if (index >= 0) next[index] = { key: 'title', value };
		else next.unshift({ key: 'title', value });

		this.updateProperties(next);
	}

	getPropertyValue(key: string) {
		return this.properties.find((property) => property.key === key)?.value;
	}

	getDraftPage(content: JSONContent): NotePageV1 {
		const draft: NotePageV1 = {
			...this.page,
			properties: $state.snapshot(this.properties) as MetadataEntry[],
			content
		};

		return { ...draft, ...resolveNotePageMetadata(draft, content) };
	}

	async togglePublication() {
		if (this.publicationState === 'working' || this.publicationState === 'loading') return;

		const shouldUnpublish = this.publicationExists && this.publicationState !== 'error';
		this.publicationState = 'working';

		try {
			if (shouldUnpublish) {
				await unpublishNoteCraft(this.page.id);
				this.publicationExists = false;
				this.#pendingPublicationPage = null;
				this.publicationState = 'unpublished';
				return;
			}

			const savedPage = await this.persistNow();
			if (!savedPage) throw new Error('Save failed');

			await publishNoteCraft({ pageJson: JSON.stringify(savedPage) });
			this.publicationExists = true;
			this.#pendingPublicationPage = null;
			this.publicationState = 'published';
		} catch {
			this.publicationState = 'error';
		}
	}

	destroy() {
		this.#saveTimer.cancel();
		if (this.#pendingSave) void this.persistNow({ notify: false });
	}

	async #refreshPublicationState() {
		try {
			const publication = await getCraftPublication(this.page.id);
			this.publicationExists = Boolean(publication);
			this.publicationState = this.publicationExists ? 'published' : 'unpublished';
			if (publication && isPublishedCraftOutdated(this.page, publication)) {
				this.#pendingPublicationPage = this.page;
			}
		} catch {
			this.publicationState = 'error';
		}
	}

	async #updatePublishedCraft() {
		const nextPage = this.#pendingPublicationPage;
		if (!nextPage || this.#publicationUpdateInFlight) return;

		this.#pendingPublicationPage = null;
		this.#publicationUpdateInFlight = true;
		this.publicationState = 'working';

		try {
			await publishNoteCraft({ pageJson: JSON.stringify(nextPage) });
			this.publicationState = 'published';
		} catch {
			this.#pendingPublicationPage = nextPage;
			this.publicationState = 'error';
		} finally {
			this.#publicationUpdateInFlight = false;
		}
	}
}
