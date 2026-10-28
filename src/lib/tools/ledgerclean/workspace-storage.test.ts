import { describe, it, expect } from 'vitest';
import {
	emptyWorkspace,
	loadWorkspace,
	persistWorkspace,
	validateWorkspace,
	WORKSPACE_KEY,
	serializeWorkspace
} from './workspace-storage';
import { CATEGORY_IDS } from './category-model';
import { TAG_IDS, transactionTagMap } from './tags';
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
	it('preserves effective legacy tags even when the new winner assigns the same category', () => {
		for (const categoryId of [CATEGORY_IDS.Cafes, CATEGORY_IDS.Business]) {
			const current = populated();
			current.transactions[0].description = 'COFFEE BAR #123';
			current.transactions[0].tagOverride = { add: [TAG_IDS.Needs], remove: [] };
			const raw = {
				...serializeWorkspace(current),
				version: 4,
				ai: { enabled: true },
				rules: [
					{
						keyword: 'COFFEE',
						match: 'contains',
						source: 'manual',
						categoryId: CATEGORY_IDS.Business,
						tagIds: [TAG_IDS.Work]
					},
					{
						keyword: 'COFFEE BAR #123',
						match: 'exact',
						source: 'ai',
						categoryId,
						tagIds: [TAG_IDS.Social]
					}
				]
			};
			delete (raw as Partial<typeof raw>).starterVersion;
			const loaded = validateWorkspace(raw);
			expect(
				transactionTagMap(loaded.transactions, loaded.rules, loaded.categories, loaded.tags)
					.get(loaded.transactions[0].id)
					?.sort()
			).toEqual([TAG_IDS.Needs, TAG_IDS.Work].sort());
			expect(validateWorkspace(serializeWorkspace(loaded)).transactions[0].tagOverride).toEqual(
				loaded.transactions[0].tagOverride
			);
		}
	});
	it('preserves legacy winners when retired source precedence differs from the new visible order', () => {
		const current = populated();
		current.transactions[0].description = 'COFFEE BAR #123';
		const raw = {
			...serializeWorkspace(current),
			version: 4,
			ai: { enabled: true },
			rules: [
				{ keyword: 'COFFEE BAR', match: 'merchant', source: 'ai', categoryId: CATEGORY_IDS.Cafes },
				{
					keyword: 'COFFEE BAR #123',
					match: 'exact',
					source: 'manual',
					categoryId: CATEGORY_IDS.Business
				}
			]
		};
		delete (raw as Partial<typeof raw>).starterVersion;
		expect(validateWorkspace(raw).transactions[0].categoryId).toBe(CATEGORY_IDS.Business);
		raw.rules = [
			{ keyword: 'COFFEE BAR #123', match: 'exact', source: 'ai', categoryId: CATEGORY_IDS.Cafes },
			{ keyword: 'COFFEE', match: 'contains', source: 'manual', categoryId: CATEGORY_IDS.Business }
		];
		const loaded = validateWorkspace(raw);
		expect(loaded.transactions[0].categoryId).toBe(CATEGORY_IDS.Business);
		expect(loaded.transactions[0].categoryOverride).toEqual({
			categoryId: CATEGORY_IDS.Business,
			source: 'manual'
		});
		expect(validateWorkspace(serializeWorkspace(loaded)).transactions[0].categoryId).toBe(
			CATEGORY_IDS.Business
		);
	});
	it('adopts the hierarchy from flat defaults while preserving user names, colors, and rules', () => {
		const workspace = populated();
		workspace.rules = [{ keyword: 'OPENAI', categoryId: CATEGORY_IDS.Business }];
		let saved = '';
		persistWorkspace({ setItem: (_key, value) => (saved = value) }, workspace);
		const flat = JSON.parse(saved);
		flat.version = 3;
		delete flat.starterVersion;
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
		expect(loaded.version).toBe(5);
		expect(loaded.categories[CATEGORY_IDS.Groceries].parentId).toBe(CATEGORY_IDS.Household);
		expect(loaded.categories[CATEGORY_IDS.Dining].name).toBe('Dining');
		expect(loaded.categories[CATEGORY_IDS.Medical].parentId).toBe(CATEGORY_IDS.Health);
		expect(loaded.categories[CATEGORY_IDS.Business]).toMatchObject({
			name: 'My work',
			color: '#abcdef'
		});
		expect(loaded.rules.filter((rule) => !rule.starterId)).toEqual(workspace.rules);
		expect(loaded.transactions[0].id).toBe(workspace.transactions[0].id);
	});
	it('starts with enabled conservative rules, including after a storage reset', () => {
		const fresh = loadWorkspace({ getItem: () => null });
		expect(fresh.rules.some((rule) => rule.starterId === 'cafes' && rule.enabled)).toBe(true);
		expect(fresh.categories[CATEGORY_IDS.Business].name).toBe('Business');
		const csv = readCsv(
			'Date,Description,Amount\n2026-10-01,OPENAI,-10\n2026-10-02,DIGITALOCEAN,-12\n2026-10-03,DOORDASH,-14\n2026-10-04,PAYROLL,3000\n2026-10-05,PAYMENT RECEIVED - THANK YOU,100'
		);
		const tx = normalizeTransactions(
			csv,
			defaultImportOptions(csv.headers, 'test.csv'),
			fresh.rules
		).transactions;
		expect(tx.map((row) => row.categoryId)).toEqual([
			CATEGORY_IDS.Business,
			CATEGORY_IDS.Business,
			CATEGORY_IDS.Takeaway,
			CATEGORY_IDS.Income,
			CATEGORY_IDS.Savings
		]);
		expect(loadWorkspace({ getItem: () => null }).rules).toEqual(fresh.rules);
	});
	it('replaces legacy shipped presets once while preserving user rules', () => {
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
		const legacy = JSON.parse(raw);
		legacy.version = 4;
		delete legacy.starterVersion;
		legacy.ai = { enabled: true };
		const loaded = loadWorkspace({ getItem: () => JSON.stringify(legacy) });
		expect(loaded.rules.filter((rule) => !rule.starterId)).toEqual([
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
		let saved = '';
		const withLegacySettings = { ...workspace, ai: { enabled: true, apiKey: 'SECRET' } };
		persistWorkspace(
			{
				setItem: (key, value) => {
					expect(key).toBe(WORKSPACE_KEY);
					saved = value;
				}
			},
			withLegacySettings
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
		delete (legacy as Partial<typeof legacy>).starterVersion;
		const loaded = loadWorkspace({
			getItem: (key) => (key === WORKSPACE_KEY ? JSON.stringify(legacy) : null)
		});
		expect(loaded.version).toBe(5);
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
		old.version = 4;
		delete old.starterVersion;
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
		expect(loaded).not.toHaveProperty('ai');
		expect(loaded.categories[child].parentId).toBe(CATEGORY_IDS.Business);
	});
});
