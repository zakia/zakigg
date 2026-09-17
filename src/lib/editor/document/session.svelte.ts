import { createTimer } from '$lib/editor/timers';
import {
	normalizeMetadataEntries,
	type MetadataEntry,
	type MetadataProperties
} from '$lib/editor/document/metadata';
import { formatSaveLabel, type CommitStatus, type SaveState } from './save-state';
import { saveNotePage } from './persistence/storage';
import { createCanonicalMarkdownSource, createNotePage, type NotePage } from './model';

export type DocumentRepositoryAdapter = {
	isEnabled: () => boolean;
	save: (document: NotePage) => Promise<unknown>;
};

type DocumentSessionOptions = {
	getPage: () => NotePage;
	getMarkdown: () => string;
	onDraftChange: () => void;
	onSaved?: (page: NotePage) => void;
	repository?: DocumentRepositoryAdapter;
};

export class DocumentSession {
	page = $state({} as NotePage);
	properties = $state<MetadataEntry[]>([]);
	saveState = $state<SaveState>('loading');
	commitStatus = $state<CommitStatus>('disabled');
	lastSavedAt = $state<string>();
	publicationState = $state<'unpublished' | 'published' | 'working' | 'error'>('unpublished');
	publicationExists = $state(false);

	#getMarkdown: () => string;
	#onDraftChange: () => void;
	#onSaved?: (page: NotePage) => void;
	#repository?: DocumentRepositoryAdapter;
	#pendingSave = false;
	#saveTimer = createTimer();

	constructor({
		getPage,
		getMarkdown,
		onDraftChange,
		onSaved,
		repository
	}: DocumentSessionOptions) {
		const page = getPage();
		this.page = page;
		this.properties = normalizeMetadataEntries($state.snapshot(page.properties));
		this.lastSavedAt = page.updatedAt;
		this.saveState = 'saved';
		this.#getMarkdown = getMarkdown;
		this.#onDraftChange = onDraftChange;
		this.#onSaved = onSaved;
		this.#repository = repository;
		this.commitStatus = repository?.isEnabled() ? 'idle' : 'disabled';
		this.publicationExists = page.frontmatter?.draft !== true;
		this.publicationState = this.publicationExists ? 'published' : 'unpublished';
	}

	get saveLabel() {
		return formatSaveLabel(this.saveState, this.lastSavedAt, this.commitStatus);
	}

	get title() {
		return String(this.getPropertyValue('title') ?? this.page.title);
	}

	get date() {
		return String(this.getPropertyValue('date') || this.page.createdAt);
	}

	get canCommit() {
		return Boolean(this.#repository?.isEnabled());
	}

	get canPublish() {
		return this.canCommit;
	}

	markError() {
		this.saveState = 'error';
	}

	markSaving() {
		this.saveState = 'saving';
	}

	scheduleSave() {
		this.saveState = 'saving';
		if (this.canCommit) this.commitStatus = 'pending';
		this.#pendingSave = true;
		this.#saveTimer.schedule(() => {
			void this.persistNow();
		}, 350);
	}

	async persistNow({ notify = true }: { notify?: boolean } = {}) {
		this.#saveTimer.cancel();
		this.#pendingSave = false;
		try {
			const nextPage = await saveNotePage(this.#createDraftPage(this.#getMarkdown()));
			this.page = nextPage;
			if (notify) this.#onSaved?.(nextPage);
			this.lastSavedAt = nextPage.updatedAt;
			this.saveState = 'saved';
			return nextPage;
		} catch {
			this.saveState = 'error';
			return null;
		}
	}

	async commitNow() {
		if (!this.#repository?.isEnabled() || this.commitStatus === 'committing') return null;
		const page = await this.persistNow();
		if (!page) return null;

		this.commitStatus = 'committing';
		try {
			await this.#repository.save(page);
			this.commitStatus = 'committed';
			return page;
		} catch (cause) {
			console.error('Git commit failed', cause);
			this.commitStatus = 'error';
			return null;
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
		this.setProperty('title', value, true);
	}

	getPropertyValue(key: string) {
		return this.properties.find((property) => property.key === key)?.value;
	}

	getDraftPage(): NotePage {
		return this.#createDraftPage(this.#getMarkdown());
	}

	async togglePublication() {
		if (!this.canPublish || this.publicationState === 'working') return;
		const nextPublished = !this.publicationExists;
		this.publicationState = 'working';
		this.setProperty('draft', !nextPublished, false);
		this.#onDraftChange();
		this.scheduleSave();

		const committed = await this.commitNow();
		if (!committed) {
			this.publicationState = 'error';
			return;
		}

		this.publicationExists = nextPublished;
		this.publicationState = nextPublished ? 'published' : 'unpublished';
	}

	destroy() {
		this.#saveTimer.cancel();
		if (this.#pendingSave) void this.persistNow({ notify: false });
	}

	#setProperties(next: MetadataEntry[]) {
		this.properties = normalizeMetadataEntries(next);
	}

	setProperty(key: string, value: MetadataEntry['value'], schedule = true) {
		const next = [...normalizeMetadataEntries(this.properties)];
		const index = next.findIndex((property) => property.key === key);
		if (index >= 0) next[index] = { key, value };
		else next.push({ key, value });
		this.#setProperties(next);
		if (schedule) {
			this.#onDraftChange();
			this.scheduleSave();
		}
	}

	#createDraftPage(bodyMarkdown: string) {
		const properties = $state.snapshot(this.properties) as MetadataEntry[];
		return createNotePage({
			...this.page,
			id: this.page.id,
			properties,
			markdown: createCanonicalMarkdownSource(properties, bodyMarkdown)
		});
	}
}
