import { describe, it, expect } from 'vitest';
import {
	emptyWorkspace,
	loadWorkspace,
	persistWorkspace,
	validateWorkspace,
	WORKSPACE_KEY
} from './workspace-storage';
import { CATEGORY_IDS } from './category-model';
import { applyRules, defaultImportOptions, normalizeTransactions, readCsv } from './processing';
function populated() {
	const workspace = emptyWorkspace();
	const data = readCsv('Date,Description,Amount\n2026-10-02,OPENAI,-25');
	const options = defaultImportOptions(data.headers, 'bank.csv', 'an-import');
	workspace.transactions = normalizeTransactions(data, options).transactions;
	workspace.imports = [
		{ id: 'an-import', name: 'bank.csv', count: 1, amountMode: 'signed', expenses: 'negative' }
	];
	return workspace;
}
describe('workspace storage', () => {
	it('adopts the hierarchy from flat defaults while preserving user names, colors, and rules', () => {
		const workspace = populated();
		workspace.rules = [{ keyword: 'OPENAI', categoryId: CATEGORY_IDS.Business }];
		let saved = '';
		persistWorkspace({ setItem: (_key, value) => (saved = value) }, workspace);
		const flat = JSON.parse(saved);
		flat.version = 3;
		delete flat.tags;
		for (const [id, category] of Object.entries(workspace.categories)) {
			if (category.parentId && id !== CATEGORY_IDS.Groceries) delete flat.categories[id];
		}
		flat.categories[CATEGORY_IDS.Groceries].parentId = null;
		flat.categories[CATEGORY_IDS.Dining].name = 'Dining and Coffee';
		flat.categories[CATEGORY_IDS.Health].name = 'Medical';
		flat.categories[CATEGORY_IDS.Shopping].name = 'Personal';
		flat.categories[CATEGORY_IDS.Business].name = 'My work';
		flat.categories[CATEGORY_IDS.Business].color = '#abcdef';
		const loaded = loadWorkspace({ getItem: () => JSON.stringify(flat) });
		expect(loaded.version).toBe(4);
		expect(loaded.categories[CATEGORY_IDS.Groceries].parentId).toBe(CATEGORY_IDS.Household);
		expect(loaded.categories[CATEGORY_IDS.Dining].name).toBe('Dining');
		expect(loaded.categories[CATEGORY_IDS.Medical].parentId).toBe(CATEGORY_IDS.Health);
		expect(loaded.categories[CATEGORY_IDS.Business]).toMatchObject({
			name: 'My work',
			color: '#abcdef'
		});
		expect(loaded.rules).toEqual(workspace.rules);
		expect(loaded.transactions[0].id).toBe(workspace.transactions[0].id);
	});
	it('starts with categories and zero merchant rules, including after a storage reset', () => {
		const fresh = loadWorkspace({ getItem: () => null });
		expect(fresh.rules).toEqual([]);
		expect(fresh.categories[CATEGORY_IDS.Business].name).toBe('Business');
		const csv = readCsv(
			'Date,Description,Amount\n2026-10-01,OPENAI,-10\n2026-10-02,DIGITALOCEAN,-12\n2026-10-03,DOORDASH,-14\n2026-10-04,PAYROLL,3000\n2026-10-05,PAYMENT RECEIVED - THANK YOU,100'
		);
		const tx = normalizeTransactions(
			csv,
			defaultImportOptions(csv.headers, 'test.csv')
		).transactions;
		expect(tx.map((row) => row.categoryId)).toEqual([
			CATEGORY_IDS.Uncategorized,
			CATEGORY_IDS.Uncategorized,
			CATEGORY_IDS.Uncategorized,
			CATEGORY_IDS.Income,
			CATEGORY_IDS.Savings
		]);
		expect(loadWorkspace({ getItem: () => null }).rules).toEqual([]);
	});
	it('removes all shipped starter rules while preserving user rules', () => {
		const workspace = populated();
		workspace.rules = [
			{ keyword: 'PAYMENT RECEIVED', categoryId: CATEGORY_IDS.Savings, source: 'starter' },
			{ keyword: 'CREDIT CARD PAYMENT', categoryId: CATEGORY_IDS.Savings, source: 'starter' },
			{ keyword: 'PAYROLL', categoryId: CATEGORY_IDS.Income, source: 'starter' },
			{ keyword: 'OPENAI', categoryId: CATEGORY_IDS.Business, source: 'starter' },
			{ keyword: 'Savings transfer', categoryId: CATEGORY_IDS.Savings, source: 'manual' },
			{ keyword: 'OPENAI', categoryId: CATEGORY_IDS.Shopping, source: 'manual' },
			{ keyword: 'DOORDASH', categoryId: CATEGORY_IDS.Dining, source: 'ai' },
			{ keyword: 'Bank hint', categoryId: CATEGORY_IDS.Health, source: 'import' }
		];
		let raw = '';
		persistWorkspace({ setItem: (_key, value) => (raw = value) }, workspace);
		const loaded = loadWorkspace({ getItem: () => raw });
		expect(loaded.rules).toEqual([
			{ keyword: 'Savings transfer', categoryId: CATEGORY_IDS.Savings, source: 'manual' },
			{ keyword: 'OPENAI', categoryId: CATEGORY_IDS.Shopping, source: 'manual' },
			{ keyword: 'DOORDASH', categoryId: CATEGORY_IDS.Dining, source: 'ai' },
			{ keyword: 'Bank hint', categoryId: CATEGORY_IDS.Health, source: 'import' }
		]);
		expect(loaded.transactions[0].id).toBe(workspace.transactions[0].id);
		expect(loaded.transactions[0].categoryId).toBe(CATEGORY_IDS.Shopping);
	});
	it('roundtrips categories, transactions, imports and rules without an API key', () => {
		const workspace = populated();
		workspace.rules = [{ keyword: 'OPENAI', categoryId: CATEGORY_IDS.Business }];
		workspace.transactions = applyRules(workspace.transactions, workspace.rules);
		workspace.ai.enabled = true;
		let saved = '';
		const settingsWithKey = { ...workspace.ai, apiKey: 'SECRET' };
		persistWorkspace(
			{
				setItem: (key, value) => {
					expect(key).toBe(WORKSPACE_KEY);
					saved = value;
				}
			},
			{ ...workspace, ai: settingsWithKey }
		);
		expect(saved).not.toContain('SECRET');
		expect(saved).not.toContain('apiKey');
		expect(loadWorkspace({ getItem: (key) => (key === WORKSPACE_KEY ? saved : null) })).toEqual(
			workspace
		);
	});
	it('rejects corrupted, incompatible and orphaned saved data', () => {
		expect(() => loadWorkspace({ getItem: () => '{bad' })).toThrow();
		let json = '';
		persistWorkspace({ setItem: (_key, value) => (json = value) }, populated());
		const workspace = JSON.parse(json);
		expect(() => validateWorkspace({ ...workspace, version: 99 })).toThrow();
		expect(() =>
			validateWorkspace({
				...workspace,
				transactions: [
					{
						...workspace.transactions[0],
						categoryOverride: { categoryId: 'missing', source: 'manual' }
					}
				]
			})
		).toThrow('relationships');
		expect(() => validateWorkspace({ ...workspace, imports: [] })).toThrow('relationships');
		expect(() =>
			validateWorkspace({
				...workspace,
				transactions: [workspace.transactions[0], workspace.transactions[0]]
			})
		).toThrow('relationships');
	});
	it('migrates version 1 without changing IDs, categories or manual/AI assignments', () => {
		const current = populated();
		const facts = { ...current.transactions[0] };
		delete facts.categoryOverride;
		delete facts.account;
		const legacy = {
			...current,
			version: 1,
			rules: [{ keyword: 'OPENAI', categoryId: CATEGORY_IDS.Dining }],
			transactions: [
				facts,
				{
					...facts,
					id: 'legacy-manual',
					categoryId: CATEGORY_IDS.Health,
					categorySource: 'manual'
				},
				{ ...facts, id: 'legacy-ai', categoryId: CATEGORY_IDS.Business, categorySource: 'ai' }
			]
		};
		const loaded = loadWorkspace({
			getItem: (key) => (key === WORKSPACE_KEY ? JSON.stringify(legacy) : null)
		});
		expect(loaded.version).toBe(4);
		expect(loaded.categories).toEqual(current.categories);
		expect(loaded.transactions.map((row) => row.id)).toEqual([
			facts.id,
			'legacy-manual',
			'legacy-ai'
		]);
		expect(loaded.transactions.map((row) => row.categoryId)).toEqual([
			CATEGORY_IDS.Dining,
			CATEGORY_IDS.Health,
			CATEGORY_IDS.Business
		]);
		expect(loaded.transactions.map((row) => row.categoryOverride)).toEqual([
			null,
			{ categoryId: CATEGORY_IDS.Health, source: 'manual' },
			{ categoryId: CATEGORY_IDS.Business, source: 'ai' }
		]);
		let stored = '';
		persistWorkspace({ setItem: (_key, value) => (stored = value) }, loaded);
		expect(loadWorkspace({ getItem: () => stored })).toEqual(loaded);
	});
	it('propagates unavailable storage so the UI can retain the session and report unsaved data', () => {
		expect(() =>
			persistWorkspace(
				{
					setItem: () => {
						throw new Error('quota');
					}
				},
				populated()
			)
		).toThrow('quota');
	});
});

describe('saved category relationships', () => {
	it('preserves saved custom categories and relationships without applying a taxonomy migration', () => {
		const workspace = populated();
		const child = '123456789012345678901';
		workspace.categories[child] = {
			id: child,
			name: 'Cloud',
			parentId: CATEGORY_IDS.Business,
			color: '#abcdef',
			kind: 'expense',
			origin: 'ai'
		};
		workspace.transactions[0].categoryOverride = { categoryId: child, source: 'manual' };
		workspace.rules = [{ keyword: 'OPENAI', categoryId: child, source: 'ai', match: 'exact' }];
		let raw = '';
		persistWorkspace({ setItem: (_key, value) => (raw = value) }, workspace);
		const old = JSON.parse(raw);
		old.ai = {
			baseUrl: 'https://api.deepinfra.com/v1/openai',
			model: 'old-model',
			format: 'schema'
		};
		const loaded = validateWorkspace(old);
		expect(loaded.categories[child]).toEqual(workspace.categories[child]);
		expect(loaded.transactions[0]).toMatchObject({
			id: workspace.transactions[0].id,
			date: workspace.transactions[0].date,
			amountCents: workspace.transactions[0].amountCents,
			categoryOverride: { categoryId: child, source: 'manual' }
		});
		expect(loaded.rules[0].categoryId).toBe(child);
		expect(loaded.ai).toEqual({ enabled: false });
		expect(loaded.categories[child].parentId).toBe(CATEGORY_IDS.Business);
	});
});
