import { createTimer } from './timers';
import { readPage, type Page } from './Page';
import { readFrontmatter } from './features/frontmatter/source';

type SessionOptions = {
	page: Page;
	/** Whether the initial source was read from the repository. */
	saved: boolean;
	backup: (page: Page) => Promise<Page>;
	save?: (page: Page) => Promise<unknown>;
	onSaved?: (page: Page) => void;
};

/** One editing session. Source, browser backup, and repository baseline have separate ownership. */
export class Session {
	markdown = $state('');
	saving = $state(false);
	error = $state('');
	backupError = $state(false);
	#savedMarkdown = $state<string | null>(null);
	#backedUpMarkdown = $state<string | null>(null);
	#options: SessionOptions;
	#timer = createTimer();
	#backups: Promise<Page | null> = Promise.resolve(null);
	#savePromise: Promise<Page | null> | null = null;
	#destroyed = false;

	constructor(options: SessionOptions) {
		this.#options = options;
		this.markdown = options.page.markdown;
		this.#savedMarkdown = options.saved ? this.markdown : null;
		// Loading is read-only: existing recoverable text isn't overwritten here.
		this.#backedUpMarkdown = this.markdown;
	}

	get page() {
		return readPage(this.markdown, this.#options.page);
	}

	get dirty() {
		return this.markdown !== this.#savedMarkdown;
	}

	get backupPending() {
		return this.markdown !== this.#backedUpMarkdown;
	}

	get status() {
		if (this.error) return { state: 'error', label: this.error };
		if (this.saving) return { state: 'saving', label: 'Saving to Git…' };
		if (!this.dirty) return { state: 'clean', label: 'Saved to Git' };
		if (this.backupError)
			return { state: 'error', label: 'Browser backup failed. Save to Git or download Markdown.' };
		if (this.backupPending) return { state: 'dirty', label: 'Backing up in this browser…' };
		return { state: 'dirty', label: 'Local changes · not saved to Git' };
	}

	update(markdown: string) {
		if (markdown === this.markdown) return;
		this.markdown = markdown;
		this.error = '';
		this.#timer.schedule(() => void this.backup(), 350);
	}

	backup(): Promise<Page | null> {
		this.#timer.cancel();
		const page = this.page;
		// Serialize writes so an older autosave cannot finish after a newer one.
		this.#backups = this.#backups.then(async () => {
			try {
				const saved = await this.#options.backup(page);
				this.#backedUpMarkdown = page.markdown;
				this.backupError = false;
				if (!this.#destroyed && page.markdown === this.markdown) this.#options.onSaved?.(saved);
				return saved;
			} catch {
				this.backupError = true;
				return null;
			}
		});
		return this.#backups;
	}

	save(): Promise<Page | null> {
		if (this.#savePromise) return this.#savePromise;
		if (!this.#options.save || !this.dirty) return Promise.resolve(null);
		const page = this.page;
		const parsed = readFrontmatter(page.markdown);
		const error =
			parsed.error ||
			(parsed.values?.id !== page.id ? 'Frontmatter id must match this document.' : null);
		if (error) {
			this.error = error;
			return Promise.resolve(null);
		}
		this.saving = true;
		this.error = '';
		this.#savePromise = this.#commit(page);
		return this.#savePromise;
	}

	async #commit(page: Page) {
		try {
			// A failed local backup doesn't prevent saving recoverable text to Git.
			await this.backup();
			await this.#options.save!(page);
			this.#savedMarkdown = page.markdown;
			return page;
		} catch (cause) {
			this.error = cause instanceof Error ? cause.message : 'Save to Git failed. Try again.';
			return null;
		} finally {
			this.saving = false;
			this.#savePromise = null;
		}
	}

	destroy() {
		this.#destroyed = true;
		this.#timer.cancel();
		if (this.backupPending) void this.backup();
	}
}
