// Callback registry connecting storage.ts mutations to the sync engine
// without a storage -> engine import cycle.
type Listener = () => void;

const listeners = new Set<Listener>();

export function onLocalMutation(listener: Listener): () => void {
	listeners.add(listener);

	return () => listeners.delete(listener);
}

export function emitLocalMutation(): void {
	for (const listener of [...listeners]) listener();
}
