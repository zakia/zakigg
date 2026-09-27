import { createTimer } from '$lib/editor/timers';
import { formatSaveLabel, type CommitStatus, type SaveState } from './save-state';
import { saveNotePage } from './persistence/storage';
import { createNotePage, type NotePage } from './model';
import { parseMarkdownFrontmatter } from './markdown';
import { readFrontmatter } from './frontmatter-source';

export type DocumentRepositoryAdapter = {
	isEnabled: () => boolean;
	save: (document: NotePage) => Promise<unknown>;
};

type DocumentSessionOptions = {
	getPage: () => NotePage;
	getMarkdown: () => string;
	updateSourceProperty: (key: string, value: string | number | boolean | string[]) => void;
	onSaved?: (page: NotePage) => void;
	repository?: DocumentRepositoryAdapter;
};

export class DocumentSession {
	page = $state({} as NotePage);
	saveState = $state<SaveState>('loading');
	commitStatus = $state<CommitStatus>('disabled');
	lastSavedAt = $state<string>();
	publicationState = $state<'unpublished' | 'published' | 'working' | 'error'>('unpublished');
	publicationExists = $state(false);

	#getMarkdown: () => string;
	#updateSourceProperty: DocumentSessionOptions['updateSourceProperty'];
	#onSaved?: (page: NotePage) => void;
	#repository?: DocumentRepositoryAdapter;
	#pendingSave = false;
	#saveTimer = createTimer();

	constructor({
		getPage,
		getMarkdown,
		updateSourceProperty,
		onSaved,
		repository
	}: DocumentSessionOptions) {
		const page = getPage();
		this.page = page;
		this.lastSavedAt = page.updatedAt;
		this.saveState = 'saved';
		this.#getMarkdown = getMarkdown;
		this.#updateSourceProperty = updateSourceProperty;
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
		if (readFrontmatter(this.#getMarkdown()).error) {
			this.commitStatus = 'error';
			return null;
		}
		const page = await this.persistNow();
		if (!page) return null;

		this.commitStatus = 'committing';
		try {
			await this.#repository.save(page);
			this.commitStatus = 'committed';
			this.publicationExists = page.frontmatter?.draft !== true;
			this.publicationState = this.publicationExists ? 'published' : 'unpublished';
			return page;
		} catch (cause) {
			console.error('Git commit failed', cause);
			this.commitStatus = 'error';
			return null;
		}
	}

	getPropertyValue(key: string) {
		const properties = parseMarkdownFrontmatter(this.#getMarkdown()).properties;
		return (
			properties?.[key] ?? this.page.properties.find((property) => property.key === key)?.value
		);
	}

	getDraftPage(): NotePage {
		return this.#createDraftPage(this.#getMarkdown());
	}

	async togglePublication() {
		if (!this.canPublish || this.publicationState === 'working') return;
		const nextPublished = !this.publicationExists;
		this.publicationState = 'working';
		this.#updateSourceProperty('draft', !nextPublished);

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

	#createDraftPage(markdown: string) {
		return createNotePage({
			...this.page,
			id: this.page.id,
			markdown
		});
	}
}
