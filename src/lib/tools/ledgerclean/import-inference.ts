import { detectedAccountType, type AccountType } from './activity';
import {
	defaultImportOptions,
	parseMoney,
	type Columns,
	type CsvData,
	type ImportOptions
} from './processing';
export type ImportProfile = {
	columns: Columns;
	account: string;
	accountType?: AccountType | 'auto';
	expenses: ImportOptions['expenses'];
	dateOrder: ImportOptions['dateOrder'];
	currency: string;
};
export type ImportQuestion = 'date' | 'description' | 'amount' | 'sign' | 'dateOrder' | 'account';
export function importProfileKey(headers: readonly string[]) {
	return JSON.stringify([...headers].sort());
}
export function inferImport(
	data: CsvData,
	source: string,
	id: string,
	profile?: ImportProfile,
	accounts: readonly { name: string; type: AccountType }[] = [],
	currency = 'CAD'
) {
	const options: ImportOptions = {
		...defaultImportOptions(data.headers, source, id),
		currency,
		...profile
	};
	const questions: ImportQuestion[] = [];
	for (const role of ['date', 'description'] as const)
		if (!options.columns[role]) questions.push(role);
	if (!options.columns.amount && !options.columns.debit && !options.columns.credit)
		questions.push('amount');
	const kind = detectedAccountType(data, options);

	if (!profile && options.amountMode === 'signed' && options.columns.amount) {
		const typedPurchases = data.rows.filter((row) =>
			/^(purchase|debit|withdrawal)$/i.test(row[options.columns.activityType] || '')
		);
		const purchaseSigns = new Set(
			typedPurchases
				.map((row) => Math.sign(parseMoney(row[options.columns.amount]) ?? 0))
				.filter(Boolean)
		);
		const amounts = data.rows
			.map((row) => parseMoney(row[options.columns.amount]))
			.filter((value): value is number => value !== null && value !== 0);
		const canonicalExport =
			!!options.columns.category &&
			!!options.columns.budgetOverride &&
			data.headers.includes('Source');
		const cashAmount = /^(netcashamount|netamount|cashamount)$/.test(
			options.columns.amount.toLowerCase().replace(/[^a-z]/g, '')
		);
		if (purchaseSigns.size === 1) options.expenses = purchaseSigns.has(1) ? 'positive' : 'negative';
		else if (purchaseSigns.size > 1) questions.push('sign');
		else if (!cashAmount && !canonicalExport && kind !== 'cash' && amounts.length) {
			// Count rows, not money: one large repayment must not outweigh many purchases.
			const positiveCount = amounts.filter((amount) => amount > 0).length;
			options.expenses = positiveCount > amounts.length - positiveCount ? 'positive' : 'negative';
		}
	}
	const accountKind = detectedAccountType(data, options);
	if (!options.account) {
		const matching = [
			...new Set(
				accounts.filter((account) => account.type === accountKind).map((account) => account.name)
			)
		];
		options.account =
			matching.length === 1
				? matching[0]
				: accountKind === 'credit'
					? 'Credit card'
					: accountKind === 'cash'
						? 'Bank account'
						: 'Main account';
		if (!options.columns.account && accounts.length) questions.push('account');
	}
	if (!profile && options.columns.date) {
		const numeric = data.rows
			.map((row) => row[options.columns.date].match(/^(\d{1,2})[/. -](\d{1,2})[/. -]\d{4}$/))
			.filter((match) => !!match);
		const orders = new Set(
			numeric.flatMap((match) =>
				Number(match[1]) > 12 ? ['DMY'] : Number(match[2]) > 12 ? ['MDY'] : []
			)
		);
		if (orders.size === 1) options.dateOrder = [...orders][0] as ImportOptions['dateOrder'];
		else if (!orders.size && numeric.some((match) => match[1] !== match[2]))
			questions.push('dateOrder');
	}
	return { options, questions };
}
export function rememberImportProfile(options: ImportOptions): ImportProfile {
	return {
		columns: { ...options.columns },
		account: options.account || 'Main account',
		...(options.accountType ? { accountType: options.accountType } : {}),
		expenses: options.expenses,
		dateOrder: options.dateOrder,
		currency: options.currency
	};
}
