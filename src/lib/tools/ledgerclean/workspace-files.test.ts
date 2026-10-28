import { describe, expect, it } from 'vitest';
import { emptyWorkspace } from './workspace-storage';
import {
	importRuleBundle,
	restoreWorkspaceBackup,
	rulesBackup,
	workspaceBackup
} from './workspace-files';
import { CATEGORY_IDS } from './category-model';
import {
	applyRules,
	defaultImportOptions,
	normalizeTransactions,
	readCsv,
	setCategory
} from './processing';

describe('portable workspace files', () => {
	it('restores facts, explicit exceptions, customized defaults and ordering without any AI settings', () => {
		const workspace = emptyWorkspace();
		const data = readCsv('Date,Description,Amount\n2026-10-01,LOCAL COFFEE,-5');
		workspace.transactions = applyRules(
			setCategory(
				normalizeTransactions(data, defaultImportOptions(data.headers, 'synthetic.csv', 'import'))
					.transactions,
				'import:0',
				CATEGORY_IDS.Business
			),
			workspace.rules
		);
		workspace.transactions = setCategory(
			workspace.transactions,
			workspace.transactions[0].id,
			CATEGORY_IDS.Business
		);
		workspace.imports = [
			{ id: 'import', name: 'synthetic.csv', count: 1, amountMode: 'signed', expenses: 'negative' }
		];
		workspace.rules[0].enabled = false;
		const text = workspaceBackup(workspace);
		expect(text).not.toContain('apiKey');
		expect(restoreWorkspaceBackup(text)).toEqual(workspace);
	});
	it('exports reusable rules without transaction IDs, and imports changes without replacing transactions', () => {
		const source = emptyWorkspace();
		source.rules = [
			{
				keyword: 'COFFEE',
				match: 'words',
				categoryId: CATEGORY_IDS.Cafes,
				excludedTransactionIds: ['private-id'],
				enabled: false
			}
		];
		const text = rulesBackup(source);
		expect(text).not.toContain('private-id');
		const current = emptyWorkspace();
		const result = importRuleBundle(text, current);
		expect(result.rules[0]).toMatchObject({ keyword: 'COFFEE', enabled: false });
		expect(result.transactions).toEqual(current.transactions);
		expect(current.rules.some((rule) => rule.keyword === 'COFFEE')).toBe(false);
	});
	it('rejects invalid expressions and orphaned categories before changing anything', () => {
		const current = emptyWorkspace();
		const bundle = JSON.parse(rulesBackup(current));
		bundle.rules = [{ keyword: '[', match: 'regex', categoryId: CATEGORY_IDS.Business }];
		expect(() => importRuleBundle(JSON.stringify(bundle), current)).toThrow(
			'invalid matching pattern'
		);
		bundle.rules = [{ keyword: 'SHOP', categoryId: 'missing' }];
		expect(() => importRuleBundle(JSON.stringify(bundle), current)).toThrow('relationships');
	});
});
