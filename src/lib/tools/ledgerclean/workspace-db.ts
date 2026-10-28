import { openDB, type IDBPDatabase } from 'idb';
import {
	emptyWorkspace,
	loadWorkspace,
	serializeWorkspace,
	validateWorkspace,
	WORKSPACE_KEY,
	type Workspace
} from './workspace-storage';

const DATABASE = 'ledgerclean';
const STORE = 'workspace';
const CURRENT = 'current';

/** One ordered writer prevents an older asynchronous save from replacing newer edits. */
export class WorkspaceDatabase {
	private database?: Promise<IDBPDatabase>;
	private writing: Promise<unknown> = Promise.resolve();
	constructor(private name = DATABASE) {}
	private open() {
		return (this.database ??= openDB(this.name, 1, {
			upgrade(database) {
				database.createObjectStore(STORE);
			},
			blocking: () => {
				void this.close();
			}
		}));
	}
	async load(legacyStorage: Pick<Storage, 'getItem' | 'removeItem'>): Promise<Workspace> {
		const database = await this.open();
		const stored = await database.get(STORE, CURRENT);
		if (stored !== undefined) return validateWorkspace(stored);
		// Validate before writing anything. Corrupt legacy data remains untouched.
		const legacy = legacyStorage.getItem(WORKSPACE_KEY);
		const workspace = legacy === null ? emptyWorkspace() : loadWorkspace({ getItem: () => legacy });
		await this.save(workspace);
		if (legacy !== null) legacyStorage.removeItem(WORKSPACE_KEY);
		return workspace;
	}
	save(workspace: Workspace): Promise<void> {
		const value = structuredClone(serializeWorkspace(workspace));
		const write = this.writing
			.catch(() => {})
			.then(async () => {
				const database = await this.open();
				await database.put(STORE, value, CURRENT);
			});
		this.writing = write;
		return write;
	}
	async flush(): Promise<void> {
		await this.writing;
	}
	async close() {
		await this.writing.catch(() => {});
		(await this.database)?.close();
		this.database = undefined;
	}
}
