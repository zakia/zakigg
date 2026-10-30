import type { Document as StoredPage } from './Document';
import { validateMarkdown, type Diagnostic } from './document/validation';

type SessionOptions = {
	page: StoredPage;
	saved: boolean;
	save?: (page: StoredPage) => Promise<unknown>;
	validate?: (source: string) => Diagnostic[];
};

/** Explicit saves only. CodeMirror owns editing; this module owns the saved baseline. */
export class Session {
	markdown = $state('');
	saving = $state(false);
	error = $state('');
	errorPosition = $state<number | null>(null);
	#savedMarkdown = $state<string | null>(null);
	#options: SessionOptions;
	#savePromise: Promise<StoredPage | null> | null = null;
	#requested: StoredPage | null = null;
	#destroyed = false;
	constructor(options: SessionOptions) {
		this.#options = options;
		this.markdown = options.page.markdown;
		this.#savedMarkdown = options.saved ? this.markdown : null;
	}
	get document() {
		return { id: this.#options.page.id, markdown: this.markdown };
	}
	get dirty() {
		return this.markdown !== this.#savedMarkdown;
	}
	get status() {
		if (this.error) return { state: 'error', label: this.error };
		if (this.saving) return { state: 'saving', label: 'Saving…' };
		if (!this.#options.save) return { state: 'dirty', label: 'Preview · changes are not saved' };
		return this.dirty
			? { state: 'dirty', label: 'Unsaved changes' }
			: { state: 'saved', label: 'Saved' };
	}
	update(markdown: string) {
		if (markdown === this.markdown) return;
		this.markdown = markdown;
		this.error = '';
		this.errorPosition = null;
	}
	save(): Promise<StoredPage | null> {
		if (this.#destroyed || !this.#options.save) return Promise.resolve(null);
		if (this.#savePromise) {
			this.#requested = { id: this.#options.page.id, markdown: this.markdown };
			return this.#savePromise;
		}
		if (!this.dirty) return Promise.resolve(null);
		const page = { id: this.#options.page.id, markdown: this.markdown };
		this.#requested = null;
		this.saving = true;
		this.error = '';
		// Reserve the operation before invoking host callbacks, including synchronous ones.
		this.#savePromise = Promise.resolve().then(() => this.#commit(page));
		return this.#savePromise;
	}
	async #commit(initial: StoredPage): Promise<StoredPage | null> {
		let page: StoredPage | null = initial;
		let saved: StoredPage | null = null;
		try {
			while (page && !this.#destroyed) {
				const diagnostic = (this.#options.validate ?? validateMarkdown)(page.markdown)[0];
				if (diagnostic) {
					this.errorPosition = diagnostic.from;
					const line = page.markdown.slice(0, diagnostic.from).split('\n').length;
					this.error = `Line ${line}: ${diagnostic.message}`;
					return null;
				}
				await this.#options.save!(page);
				this.#savedMarkdown = page.markdown;
				saved = page;
				page = this.#takeRequested();
				this.#requested = null;
				if (page?.markdown === this.#savedMarkdown) page = null;
			}
			return saved;
		} catch (cause) {
			this.error = cause instanceof Error ? cause.message : 'Save failed. Try again.';
			return null;
		} finally {
			this.saving = false;
			this.#savePromise = null;
			this.#requested = null;
		}
	}
	#takeRequested(): StoredPage | null {
		return this.#requested;
	}
	destroy() {
		this.#destroyed = true;
		this.#requested = null;
	}
}
