import { Temporal } from 'temporal-polyfill';

export type DateOrder = 'MDY' | 'DMY';
export type ParseDateOptions = { order?: DateOrder };

const monthNames = [
	'january',
	'february',
	'march',
	'april',
	'may',
	'june',
	'july',
	'august',
	'september',
	'october',
	'november',
	'december'
];
const namedMonths = new Map(
	monthNames.flatMap(
		(name, index) =>
			[
				[name, index + 1],
				[name.slice(0, 3), index + 1]
			] as const
	)
);
namedMonths.set('sept', 9);

/**
 * Parse a calendar date without applying a time zone. ISO dates go directly to
 * Temporal; statement formats such as "02 Oct 2026" are adapted to date fields.
 * `order` resolves numeric month/day ambiguity only. Invalid dates return null.
 */
export function parseDate(
	value: string,
	{ order = 'MDY' }: ParseDateOptions = {}
): Temporal.PlainDate | null {
	const text = value.trim();
	try {
		return Temporal.PlainDate.from(text).withCalendar('iso8601');
	} catch {
		// Temporal accepts ISO strings, so adapt other statement formats below.
	}

	const parts = text
		.toLowerCase()
		.replace(/[.,/-]/g, ' ')
		.trim()
		.split(/\s+/);
	if (parts.length !== 3) return null;
	const [first, middle, last] = parts;
	let year: string;
	let month: string;
	let day: string;
	if (/^\d{4}$/.test(first)) {
		[year, month, day] = parts;
	} else if (/^\d{4}$/.test(last)) {
		year = last;
		if (namedMonths.has(first)) {
			month = first;
			day = middle;
		} else if (namedMonths.has(middle) || order === 'DMY') {
			month = middle;
			day = first;
		} else {
			month = first;
			day = middle;
		}
	} else {
		return null;
	}
	const monthNumber = namedMonths.get(month) ?? (/^\d{1,2}$/.test(month) ? Number(month) : null);
	if (monthNumber === null || !/^\d{1,2}$/.test(day)) return null;
	try {
		return Temporal.PlainDate.from(
			{ year: Number(year), month: monthNumber, day: Number(day) },
			{ overflow: 'reject' }
		);
	} catch {
		return null;
	}
}

export function formatDate(
	value: string | Temporal.PlainDate,
	options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
	locale = 'en-CA'
): string {
	const date = typeof value === 'string' ? parseDate(value) : value;
	return date?.toLocaleString(locale, options) ?? '';
}

function parseMonth(value: string): Temporal.PlainYearMonth | null {
	try {
		return Temporal.PlainYearMonth.from(value);
	} catch {
		return null;
	}
}

export function formatMonth(value: string, short = false, locale = 'en-CA'): string {
	return (
		parseMonth(value)
			?.toPlainDate({ day: 1 })
			.toLocaleString(locale, {
				month: short ? 'short' : 'long',
				year: 'numeric'
			}) ?? ''
	);
}

export function shiftMonth(value: string, months: number): string | null {
	return parseMonth(value)?.add({ months }).toString() ?? null;
}
