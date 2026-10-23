import type { CategoryClassifier } from './ai';
import { MODEL_CACHE } from './local-ai-contract';
export { LOCAL_MODEL, MODEL_DOWNLOAD_MB } from './local-ai-contract';
type State = 'idle' | 'loading' | 'ready' | 'error';
class LocalAi {
	status = $state<State>('idle');
	progress = $state(0);
	error = $state('');
	private worker: Worker | null = null;
	private loading: Promise<void> | null = null;
	private nextId = 0;
	private pending = new Map<
		number,
		{ resolve: (value: unknown) => void; reject: (cause: unknown) => void }
	>();
	async load(signal: AbortSignal): Promise<void> {
		signal.throwIfAborted();
		if (this.status === 'ready') return;
		if (this.loading) return this.loading;
		const task = this.initialize(signal);
		this.loading = task;
		try {
			await task;
		} finally {
			if (this.loading === task) this.loading = null;
		}
	}
	private async initialize(signal: AbortSignal) {
		this.status = 'loading';
		this.progress = 0;
		this.error = '';
		try {
			const worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
			this.worker = worker;
			worker.onmessage = ({ data }) => {
				if (data.type === 'progress') {
					this.progress = data.progress;
					return;
				}
				const pending = this.pending.get(data.id);
				if (!pending) return;
				this.pending.delete(data.id);
				if (data.error) pending.reject(new Error(data.error));
				else pending.resolve(data.result);
			};
			worker.onerror = () => {
				this.error = 'Local AI worker failed. Reload the model and retry.';
				this.status = 'error';
				this.stop(new Error(this.error));
			};
			await this.request('load', undefined, signal);
			signal.throwIfAborted();
			this.progress = 1;
			this.status = 'ready';
		} catch (cause) {
			this.stop(cause);
			if (signal.aborted) {
				this.status = 'idle';
				throw cause;
			}
			this.status = 'error';
			this.error =
				cause instanceof Error
					? cause.message
					: 'Could not load local AI. Check your connection and retry.';
			throw new Error(this.error, { cause });
		}
	}
	private request(
		type: 'load' | 'classify',
		input: unknown,
		signal: AbortSignal
	): Promise<unknown> {
		signal.throwIfAborted();
		return new Promise((resolve, reject) => {
			const id = ++this.nextId;
			const abort = () => {
				this.stop(signal.reason ?? new DOMException('Canceled', 'AbortError'));
				this.status = 'idle';
			};
			signal.addEventListener('abort', abort, { once: true });
			const finish = () => signal.removeEventListener('abort', abort);
			this.pending.set(id, {
				resolve: (value) => {
					finish();
					resolve(value);
				},
				reject: (cause) => {
					finish();
					reject(cause);
				}
			});
			this.worker!.postMessage({ id, type, input });
		});
	}
	classify: CategoryClassifier = Object.assign(
		async (input: Parameters<CategoryClassifier>[0], signal: AbortSignal) => {
			if (!this.worker || this.status !== 'ready')
				throw new Error('Load local AI before categorizing.');
			return this.request('classify', input, signal);
		},
		{ rootOnly: true }
	);
	private stop(cause: unknown) {
		this.worker?.terminate();
		this.worker = null;
		for (const pending of this.pending.values()) pending.reject(cause);
		this.pending.clear();
	}
	unload() {
		this.stop(new DOMException('Local AI unloaded', 'AbortError'));
		this.status = 'idle';
		this.loading = null;
	}
	async removeDownload() {
		this.unload();
		for (const key of await caches.keys())
			if (
				key === MODEL_CACHE ||
				key.startsWith('ledgerclean-local-ai-setfit-') ||
				key === 'ledgerclean-local-ai-minilm-v1'
			)
				await caches.delete(key);
	}
}
export const localAi = new LocalAi();
