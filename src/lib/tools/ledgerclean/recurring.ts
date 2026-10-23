import { budgetFlow } from './activity';
import { groupMerchantTransactions } from './merchants';
import type { CategoryDictionary } from './category-model';
import type { Rule, Transaction } from './processing';
import { parseDate } from '$lib/utils/date';

export type RecurringSeries = {
	id: string;
	merchant: string;
	transactionIds: string[];
	cadence: 'Weekly' | 'Fortnightly' | 'Monthly' | 'Quarterly' | 'Yearly';
	confidence: number;
	amountCents: number;
};
const intervals = [
	{ cadence: 'Weekly', days: 7, tolerance: 1 },
	{ cadence: 'Fortnightly', days: 14, tolerance: 2 },
	{ cadence: 'Monthly', months: 1, tolerance: 4 },
	{ cadence: 'Quarterly', months: 3, tolerance: 7 },
	{ cadence: 'Yearly', months: 12, tolerance: 10 }
] as const;
/** Payment series, not merchant-wide labels. Three observed charges are required for automatic tags. */
export function detectRecurring(
	rows: readonly Transaction[],
	rules: readonly Rule[],
	categories: CategoryDictionary
): RecurringSeries[] {
	const spending = rows.filter(
		(row) => row.amountCents < 0 && budgetFlow(row, categories) === 'expense'
	);
	const series: RecurringSeries[] = [];
	for (const group of groupMerchantTransactions(
		spending,
		rows,
		rules.filter((rule) => rule.field !== 'sourceCategory'),
		categories
	)) {
		const partitions = new Map<string, Transaction[]>();
		for (const row of group.transactions) {
			const key = JSON.stringify([row.account || 'Main account', row.currency]);
			partitions.set(key, [...(partitions.get(key) ?? []), row]);
		}
		for (const [partition, charges] of partitions) {
			const clusters: Transaction[][] = [];
			for (const row of charges.sort((a, b) => a.date.localeCompare(b.date))) {
				const amount = Math.abs(row.amountCents);
				const cluster = clusters.find((cluster) => {
					const typical = Math.abs(cluster[0].amountCents);
					return Math.abs(typical - amount) <= Math.max(100, typical * 0.15);
				});
				if (cluster) cluster.push(row);
				else clusters.push([row]);
			}
			for (const cluster of clusters) {
				if (cluster.length < 3) continue;
				// Dense everyday purchases are habits, not evidence of a recurring bill.
				if (new Set(cluster.map((row) => row.date)).size !== cluster.length) continue;
				let best: { confidence: number; cadence: RecurringSeries['cadence'] } | null = null;
				for (const interval of intervals) {
					let matched = 0,
						error = 0;
					for (let i = 1; i < cluster.length; i++) {
						const first = parseDate(cluster[i - 1].date)!,
							next = parseDate(cluster[i].date)!;
						const expected =
							'months' in interval
								? first.add({ months: interval.months })
								: first.add({ days: interval.days });
						const difference = Math.abs(expected.until(next).days);
						if (difference <= interval.tolerance) {
							matched++;
							error += difference / (interval.tolerance + 1);
						}
					}
					if (matched !== cluster.length - 1) continue;
					const confidence = Math.max(
						0,
						Math.min(
							1,
							0.85 + Math.min(0.1, (cluster.length - 3) * 0.025) - (error / matched) * 0.1
						)
					);
					if (!best || confidence > best.confidence)
						best = { cadence: interval.cadence, confidence };
				}
				if (!best) continue;
				const amounts = cluster.map((row) => Math.abs(row.amountCents)).sort((a, b) => a - b);
				series.push({
					id: JSON.stringify([
						group.id,
						partition,
						best.cadence,
						amounts[Math.floor(amounts.length / 2)]
					]),
					merchant: group.rule.keyword,
					transactionIds: cluster.map((row) => row.id),
					cadence: best.cadence,
					confidence: best.confidence,
					amountCents: amounts[Math.floor(amounts.length / 2)]
				});
			}
		}
	}
	return series;
}
