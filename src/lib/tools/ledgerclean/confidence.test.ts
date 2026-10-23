import { describe, it, expect } from 'vitest';
import { rankCategory } from './local-ai-contract';
import { confidenceLevel } from './confidence';
import { categorizeWithAi, type CategoryClassifier } from './ai';
import { approveLearning, reviewLearningGroups } from './learning';
import { groupMerchantTransactions } from './merchants';
import { DEFAULT_CATEGORIES, CATEGORY_IDS } from './category-model';
import { readCsv, normalizeTransactions, defaultImportOptions } from './processing';
import { emptyWorkspace, loadWorkspace, persistWorkspace } from './workspace-storage';
function rows() {
	const data = readCsv(
		'Date,Description,Amount\n2026-10-01,BAR+ MUSIC STUDIO 001 TORONTO,-50\n2026-10-02,BAR+ MUSIC STUDIO 001 TORONTO,-60\n2026-10-03,BAR+ MUSIC STUDIO 001 TORONTO,-70'
	);
	return normalizeTransactions(
		data,
		defaultImportOptions(data.headers, 'synthetic.csv', 'confidence'),
		[]
	).transactions;
}
describe('merchant confidence and review', () => {
	it('groups identical merchants even when their previous automatic categories differ', () => {
		const tx = rows().map((row, i) => ({
			...row,
			categoryId: i === 2 ? CATEGORY_IDS.Entertainment : CATEGORY_IDS.Uncategorized
		}));
		const groups = groupMerchantTransactions(tx);
		expect(groups).toHaveLength(1);
		expect(groups[0].transactions).toHaveLength(3);
	});
	it('leaves the whole merchant unselected when any member has a weak suggestion', () => {
		const tx = rows();
		const proposal = tx.map((row, i) => ({
			transactionId: row.id,
			categoryId: CATEGORY_IDS.Entertainment,
			confidence: i ? { score: 0.6, margin: 0.2 } : { score: 0.3, margin: 0.01 }
		}));
		const groups = reviewLearningGroups(tx, tx, proposal);
		expect(groups).toHaveLength(1);
		expect(groups[0].selected).toBe(false);
		expect(groups[0].confidence).toEqual({ score: 0.3, margin: 0.01 });
	});
	it('reports the best category and actual score gap while keeping ambiguous matches low', () => {
		const result = rankCategory(
			[1, 0],
			[
				{ name: 'Entertainment', vector: [0.42, 0] },
				{ name: 'Dining and Coffee', vector: [0.4, 0] }
			],
			'Uncategorized'
		);
		expect(result.category).toBe('Uncategorized');
		expect(result.suggestedCategory).toBe('Entertainment');
		expect(result.confidence.score).toBe(0.42);
		expect(result.confidence.margin).toBeCloseTo(0.02);
		expect(confidenceLevel(result.confidence)).toBe('low');
		expect(confidenceLevel({ score: 0.6, margin: 0.2 })).toBe('high');
		expect(confidenceLevel({ score: 0.35, margin: 0.08 })).toBe('medium');
	});
	it('propagates one scored suggestion to the whole merchant group, blocks unreviewed low scores, and saves reviewed confidence', async () => {
		const tx = rows();
		let groupCount = 0;
		const classify: CategoryClassifier = async (input) => {
			groupCount = input.transactions.length;
			return {
				assignments: input.transactions.map((row) => ({
					t: row.t,
					c: 'Entertainment',
					confidence: { score: 0.42, margin: 0.02 }
				}))
			};
		};
		const proposal = await categorizeWithAi(
			classify,
			tx,
			DEFAULT_CATEGORIES,
			new AbortController().signal,
			undefined,
			'',
			[],
			[]
		);
		expect(groupCount).toBe(1);
		expect(
			proposal.every(
				(item) => item.confidence?.score === 0.42 && item.categoryId === CATEGORY_IDS.Entertainment
			)
		).toBe(true);
		expect(() => approveLearning(tx, proposal, tx, [], DEFAULT_CATEGORIES)).toThrow(
			'low-confidence'
		);
		const result = approveLearning(
			tx,
			proposal.map((item) => ({ ...item, reviewed: true })),
			tx,
			[],
			DEFAULT_CATEGORIES
		);
		expect(result.rules).toHaveLength(1);
		expect(result.rules[0].confidence).toEqual({ score: 0.42, margin: 0.02 });
		let raw = '';
		persistWorkspace(
			{ setItem: (_key, value) => (raw = value) },
			{
				...emptyWorkspace(),
				...result,
				imports: [
					{
						id: 'confidence',
						name: 'synthetic.csv',
						count: 3,
						amountMode: 'signed',
						expenses: 'negative'
					}
				]
			}
		);
		expect(loadWorkspace({ getItem: () => raw }).rules[0].confidence).toEqual({
			score: 0.42,
			margin: 0.02
		});
	});
	it('records a corrected group as a manual rule without retaining misleading model confidence', () => {
		const tx = rows();
		const proposal = tx.map((row) => ({
			transactionId: row.id,
			categoryId: CATEGORY_IDS.Entertainment,
			confidence: { score: 0.2, margin: 0.01 },
			manual: true
		}));
		const result = approveLearning(tx, proposal, tx, [], DEFAULT_CATEGORIES);
		expect(result.rules[0].source).toBe('manual');
		expect(result.rules[0].confidence).toBeUndefined();
	});
	it('rejects malformed or out-of-range confidence before a suggestion can be applied', async () => {
		const tx = rows();
		for (const confidence of [
			{ score: 1.1, margin: 0.2 },
			{ score: 0.3, margin: -1 },
			{ score: 0.3 },
			{ score: NaN, margin: 0.1 }
		]) {
			const classify: CategoryClassifier = async (input) => ({
				assignments: input.transactions.map((row) => ({ t: row.t, c: 'Entertainment', confidence }))
			});
			await expect(
				categorizeWithAi(
					classify,
					tx,
					DEFAULT_CATEGORIES,
					new AbortController().signal,
					undefined,
					'',
					[],
					[]
				)
			).rejects.toThrow('invalid category');
		}
	});
	it('saving only a selected strong merchant leaves an unchecked weak merchant unchanged', async () => {
		const tx = [...rows(), { ...rows()[0], id: 'other', description: 'OTHER MERCHANT' }];
		const classify: CategoryClassifier = async (input) => ({
			assignments: input.transactions.map((row) => ({
				t: row.t,
				c: 'Entertainment',
				confidence: row.d.startsWith('BAR+')
					? { score: 0.65, margin: 0.2 }
					: { score: 0.2, margin: 0.01 }
			}))
		});
		const proposal = await categorizeWithAi(
			classify,
			tx,
			DEFAULT_CATEGORIES,
			new AbortController().signal,
			undefined,
			'',
			[],
			[]
		);
		const chosen = proposal.filter((item) => confidenceLevel(item.confidence) !== 'low');
		const result = approveLearning(
			tx,
			chosen,
			tx.filter((row) => row.id !== 'other'),
			[],
			DEFAULT_CATEGORIES
		);
		expect(
			result.transactions
				.filter((row) => row.description.startsWith('BAR+'))
				.every((row) => row.categoryId === CATEGORY_IDS.Entertainment)
		).toBe(true);
		expect(result.transactions.find((row) => row.id === 'other')?.categoryId).toBe(
			CATEGORY_IDS.Uncategorized
		);
		expect(result.rules).toHaveLength(1);
	});
});
