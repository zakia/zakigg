import type { JSONContent } from '@tiptap/core';
import { createTimer } from '$lib/editor/timers';
import {
	normalizeMetadataEntries,
	type MetadataEntry,
	type MetadataProperties
} from '$lib/editor/document/metadata';
import {
	formatSaveLabel,
	type SaveState,
	type SyncLabelStatus
} from '$lib/editor/document/save-state';
import { saveNotePage } from '$lib/editor/document/persistence/storage';
import { startSyncEngine, syncState } from '$lib/editor/document/sync/engine.svelte';
import { resolveNotePageMetadata, type NotePageV1 } from '$lib/editor/document/model';

export type DocumentPublicationAdapter = {
	isReady: () => boolean;
	isEnabled: () => boolean;
	load: (documentId: string) => Promise<unknown | null>;
	isOutdated: (document: NotePageV1, publication: unknown) => boolean;
	publish: (document: NotePageV1) => Promise<void>;
	unpublish: (documentId: string) => Promise<void>;
};

type DocumentSessionOptions = {
	getPage: () => NotePageV1;
	getContent: () => JSONContent | undefined;
	onDraftChange: () => void;
	onSaved?: (page: NotePageV1) => void;
	publication?: DocumentPublicationAdapter;
	isSyncEnabled?: () => boolean;
};

export class DocumentSession {
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
	#publication?: DocumentPublicationAdapter;
	#isSyncEnabled: () => boolean;
	#pendingSave = false;
	#pendingPublicationPage = $state<NotePageV1 | null>(null);
	#publicationUpdateInFlight = false;
	#publicationChecked = false;
	#saveTimer = createTimer();

	constructor({
		getPage,
		getContent,
		onDraftChange,
		onSaved,
		publication,
		isSyncEnabled = () => true
	}: DocumentSessionOptions) {
		const page = getPage();
		this.page = page;
		this.properties = normalizeMetadataEntries($state.snapshot(page.properties));
		this.lastSavedAt = page.updatedAt;
		this.saveState = 'saved';
		this.#getContent = getContent;
		this.#onDraftChange = onDraftChange;
		this.#onSaved = onSaved;
		this.#publication = publication;
		this.#isSyncEnabled = isSyncEnabled;
		if (!publication) this.publicationState = 'unpublished';

		startSyncEngine();

		$effect(() => {
			if (
				!this.#publication?.isReady() ||
				!this.#publication.isEnabled() ||
				this.#publicationChecked
			)
				return;
			this.#publicationChecked = true;
			void this.#refreshPublicationState();
		});

		$effect(() => {
			if (
				!this.#publication?.isEnabled() ||
				!this.publicationExists ||
				!this.#pendingPublicationPage ||
				this.#publicationUpdateInFlight ||
				this.publicationState === 'error' ||
				syncState.status !== 'synced'
			) {
				return;
			}

			void this.#updatePublication();
		});
	}

	get syncLabelStatus(): SyncLabelStatus {
		return this.#isSyncEnabled() ? syncState.status : 'disabled';
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
		return Boolean(this.#publication?.isEnabled());
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
		if (!this.#publication) return;
		if (this.publicationState === 'working' || this.publicationState === 'loading') return;

		const shouldUnpublish = this.publicationExists && this.publicationState !== 'error';
		this.publicationState = 'working';

		try {
			if (shouldUnpublish) {
				await this.#publication.unpublish(this.page.id);
				this.publicationExists = false;
				this.#pendingPublicationPage = null;
				this.publicationState = 'unpublished';
				return;
			}

			const savedPage = await this.persistNow();
			if (!savedPage) throw new Error('Save failed');

			await this.#publication.publish(savedPage);
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
		if (!this.#publication) return;
		try {
			const publication = await this.#publication.load(this.page.id);
			this.publicationExists = Boolean(publication);
			this.publicationState = this.publicationExists ? 'published' : 'unpublished';
			if (publication && this.#publication.isOutdated(this.page, publication)) {
				this.#pendingPublicationPage = this.page;
			}
		} catch {
			this.publicationState = 'error';
		}
	}

	async #updatePublication() {
		if (!this.#publication) return;
		const nextPage = this.#pendingPublicationPage;
		if (!nextPage || this.#publicationUpdateInFlight) return;

		this.#pendingPublicationPage = null;
		this.#publicationUpdateInFlight = true;
		this.publicationState = 'working';

		try {
			await this.#publication.publish(nextPage);
			this.publicationState = 'published';
		} catch {
			this.#pendingPublicationPage = nextPage;
			this.publicationState = 'error';
		} finally {
			this.#publicationUpdateInFlight = false;
		}
	}
}
